/**
 * Nintendo Parental Controls (Moon) API client
 *
 * Auth chain:
 *   Nintendo OAuth (PKCE) → session_token_code → session_token → access_token → Moon API
 *
 * Client ID 54789befb391a838 belongs to the official Nintendo Switch Parental Controls app.
 * The redirect URI is a custom app scheme (npf...://auth) — users must paste the
 * redirect URL back into our app. This is a one-time setup.
 */

import crypto from 'crypto'

// ─── Constants ────────────────────────────────────────────────────────────────

export const CLIENT_ID   = '54789befb391a838'
export const REDIRECT_URI = `npf${CLIENT_ID}://auth`
const NA_AUTHORIZE = 'https://accounts.nintendo.com/connect/1.0.0/authorize'
const NA_SESSION   = 'https://accounts.nintendo.com/connect/1.0.0/api/session_token'
const NA_TOKEN     = 'https://accounts.nintendo.com/connect/1.0.0/api/token'
const MOON_BASE    = 'https://api-lp1.pctl.srv.nintendo.net/moon/v1'

const MOON_SCOPES = [
  'openid', 'user', 'user.mii',
  'moonUser:administration', 'moonDevice:create',
  'moonOwnedDevice:administration', 'moonParentalControlSetting',
  'moonParentalControlSetting:update', 'moonParentalControlSettingState',
  'moonPairingState', 'moonSmartDevice:administration',
  'moonDailySummary', 'moonMonthlySummary',
].join(' ')

// ─── PKCE ─────────────────────────────────────────────────────────────────────

export function generateVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function generateChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

// ─── Auth URL ─────────────────────────────────────────────────────────────────

export function buildAuthUrl(verifier: string): string {
  const challenge = generateChallenge(verifier)
  const state     = crypto.randomBytes(16).toString('hex')
  const params = new URLSearchParams({
    state,
    redirect_uri:                       REDIRECT_URI,
    client_id:                          CLIENT_ID,
    scope:                              MOON_SCOPES,
    response_type:                      'session_token_code',
    session_token_code_challenge:       challenge,
    session_token_code_challenge_method:'S256',
    theme:                              'login_form',
  })
  return `${NA_AUTHORIZE}?${params}`
}

// ─── Token exchange ───────────────────────────────────────────────────────────

/** Exchange the session_token_code (from the redirect URL) for a session_token */
export async function exchangeCode(sessionTokenCode: string, verifier: string): Promise<string> {
  const res = await fetch(NA_SESSION, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Accept':        'application/json',
      'User-Agent':    'NASDKAPI; Android',
    },
    body: new URLSearchParams({
      client_id:                    CLIENT_ID,
      session_token_code:           sessionTokenCode,
      session_token_code_verifier:  verifier,
    }),
  })
  if (!res.ok) throw new Error(`Nintendo session_token exchange failed: ${res.status}`)
  const data = await res.json() as { session_token: string }
  if (!data.session_token) throw new Error('No session_token in response')
  return data.session_token
}

/** Exchange a session_token for an access_token (expires in ~900s) */
export async function getAccessToken(sessionToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(NA_TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      'User-Agent':   'Dalvik/2.1.0 (Linux; U; Android 8.0.0)',
    },
    body: JSON.stringify({
      client_id:     CLIENT_ID,
      session_token: sessionToken,
      grant_type:    'urn:ietf:params:oauth:grant-type:jwt-bearer-session-token',
    }),
  })
  if (!res.ok) throw new Error(`Nintendo access_token exchange failed: ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  if (!data.access_token) throw new Error('No access_token in response')
  return {
    accessToken: data.access_token,
    expiresAt:   new Date(Date.now() + data.expires_in * 1000),
  }
}

/** Extract Nintendo Account ID from the JWT access_token sub claim */
export function getNaId(accessToken: string): string {
  const payload = accessToken.split('.')[1]
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { sub: string }
  return decoded.sub
}

// ─── Moon API helpers ─────────────────────────────────────────────────────────

function moonHeaders(accessToken: string) {
  return {
    'Authorization':              `Bearer ${accessToken}`,
    'X-Moon-App-Id':              'com.nintendo.znma',
    'X-Moon-Os':                  'ANDROID',
    'X-Moon-App-Version':         '1.21.0',
    'X-Moon-App-Version-Code':    '294',
    'X-Moon-App-Area':            'X',
    'X-Moon-App-Language':        'en-US',
    'X-Moon-App-Display-Version': '1.21.0',
    'Accept':                     'application/json',
    'Accept-Language':            'en-US',
  }
}

async function moonGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${MOON_BASE}${path}`, { headers: moonHeaders(accessToken) })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Moon API ${path} → ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── Moon API calls ───────────────────────────────────────────────────────────

export type MoonDevice = {
  deviceId:       string
  label:          string | null
  registeredAt:   string | null
  [key: string]:  unknown
}

export async function getDevices(naId: string, accessToken: string): Promise<MoonDevice[]> {
  const data = await moonGet<{ items?: MoonDevice[]; [k: string]: unknown }>(`/users/${naId}/devices`, accessToken)
  return data.items ?? (Array.isArray(data) ? data as MoonDevice[] : [])
}

export type DevicePlayerTitle = {
  applicationId:  string
  playingTime:    number   // minutes
  firstPlayDate:  string
}

export type PlayedTitle = {
  applicationId: string
  title:         string
  imageUri?:     Record<string, string>
  firstPlayDate: string
}

export type DailySummary = {
  date:           string   // YYYY-MM-DD
  playingTime:    number
  playedApps:     PlayedTitle[]
  devicePlayers:  Array<{ playingTime: number; playedApps: DevicePlayerTitle[] }>
  anonymousPlayer: { playingTime: number; playedApps: DevicePlayerTitle[] } | null
}

export async function getDailySummaries(deviceId: string, accessToken: string): Promise<DailySummary[]> {
  const data = await moonGet<{ items?: DailySummary[]; [k: string]: unknown }>(`/devices/${deviceId}/daily_summaries`, accessToken)
  return data.items ?? (Array.isArray(data) ? data as DailySummary[] : [])
}

/** Aggregate per-app play time (minutes) across all players in a daily summary */
export function aggregatePlayTime(summary: DailySummary): Map<string, { playTimeMinutes: number; title: string; imageUrl: string | null }> {
  const titles = new Map<string, { title: string; imageUrl: string | null }>()
  for (const app of summary.playedApps ?? []) {
    titles.set(app.applicationId, {
      title:    app.title,
      imageUrl: app.imageUri?.small ?? app.imageUri?.medium ?? null,
    })
  }

  const result = new Map<string, { playTimeMinutes: number; title: string; imageUrl: string | null }>()

  function addTime(appId: string, mins: number) {
    const info    = titles.get(appId) ?? { title: appId, imageUrl: null }
    const current = result.get(appId)
    result.set(appId, { playTimeMinutes: (current?.playTimeMinutes ?? 0) + mins, ...info })
  }

  for (const player of summary.devicePlayers ?? [])
    for (const app of player.playedApps ?? []) addTime(app.applicationId, app.playingTime)

  for (const app of summary.anonymousPlayer?.playedApps ?? []) addTime(app.applicationId, app.playingTime)

  return result
}

/** Parse session_token_code out of the pasted Nintendo redirect URL */
export function parseRedirectUrl(pastedUrl: string): string {
  // URL looks like: npf54789befb391a838://auth#session_token_code=XXX&...
  // or might be copied as just the fragment part
  const match = pastedUrl.match(/session_token_code=([^&\s]+)/)
  if (!match) throw new Error('Could not find session_token_code in URL. Please copy the full URL from the browser.')
  return match[1]
}
