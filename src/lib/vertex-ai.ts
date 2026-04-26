/**
 * Shared Vertex AI (Gemini) client for LumiKin cron jobs.
 *
 * Auth: service account JSON stored in GOOGLE_CREDENTIALS_JSON env var.
 * Uses a JWT to obtain a short-lived access token; token is cached for 55 min.
 *
 * callGeminiTool  — structured output via function calling (replaces Bedrock tool_use)
 * callGeminiText  — plain text generation (replaces Bedrock plain messages)
 */

import { createSign } from 'crypto'

// ─── Config ───────────────────────────────────────────────────────────────────

export const VERTEX_PROJECT  = 'curametrics-492614'
export const GEMINI_FLASH    = 'gemini-2.5-flash'   // main scoring model
export const GEMINI_FAST     = 'gemini-2.5-flash'   // translation / cheap tasks

const BASE_URL = `https://aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/global/publishers/google/models`

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Auth ─────────────────────────────────────────────────────────────────────

type ServiceAccountKey = {
  client_email: string
  private_key:  string
}

let _tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 60_000) {
    return _tokenCache.token
  }

  const keyJson = process.env.GOOGLE_CREDENTIALS_JSON
  if (!keyJson) throw new Error('GOOGLE_CREDENTIALS_JSON not set')

  const key: ServiceAccountKey = JSON.parse(keyJson)
  const now = Math.floor(Date.now() / 1000)

  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss:   key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  })).toString('base64url')

  const unsigned  = `${header}.${payload}`
  const sign      = createSign('RSA-SHA256')
  sign.update(unsigned)
  const signature = sign.sign(key.private_key, 'base64url')
  const jwt       = `${unsigned}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })

  if (!res.ok) throw new Error(`Vertex AI token exchange failed: ${await res.text()}`)
  const data = await res.json()

  _tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in * 1000) }
  return data.access_token
}

// ─── Tool calling ─────────────────────────────────────────────────────────────

// Matches the Anthropic tool schema shape used in the crons so callers don't change.
export type GeminiTool = {
  name:         string
  description:  string
  input_schema: Record<string, unknown>  // JSON Schema — passed directly as Gemini parameters
}

export async function callGeminiTool<T>(
  prompt:   string,
  tool:     GeminiTool,
  model     = GEMINI_FLASH,
  attempt   = 0,
): Promise<T> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}/${model}:generateContent`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{
        functionDeclarations: [{
          name:        tool.name,
          description: tool.description,
          parameters:  tool.input_schema,
        }],
      }],
      toolConfig: {
        functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [tool.name] },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      await sleep(Math.pow(2, attempt) * 5000)
      return callGeminiTool<T>(prompt, tool, model, attempt + 1)
    }
    throw new Error(`Vertex AI ${res.status}: ${err.slice(0, 300)}`)
  }

  const data  = await res.json()
  const parts = data.candidates?.[0]?.content?.parts ?? []
  const call  = parts.find((p: Record<string, unknown>) => p.functionCall)

  if (!call?.functionCall) {
    if (attempt < 3) {
      await sleep(Math.pow(2, attempt) * 5000)
      return callGeminiTool<T>(prompt, tool, model, attempt + 1)
    }
    throw new Error(`Gemini did not return a function call (finish: ${data.candidates?.[0]?.finishReason})`)
  }

  return call.functionCall.args as T
}

// ─── Plain text generation ────────────────────────────────────────────────────

export async function callGeminiText(
  prompt:  string,
  model    = GEMINI_FAST,
  attempt  = 0,
): Promise<string> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}/${model}:generateContent`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      await sleep(Math.pow(2, attempt) * 5000)
      return callGeminiText(prompt, model, attempt + 1)
    }
    throw new Error(`Vertex AI ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    if (attempt < 3) {
      await sleep(Math.pow(2, attempt) * 5000)
      return callGeminiText(prompt, model, attempt + 1)
    }
    throw new Error('Gemini returned no text')
  }
  return text
}
