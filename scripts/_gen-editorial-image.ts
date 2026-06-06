/**
 * _gen-editorial-image.ts — generate a house-style editorial illustration via
 * Imagen 4.0 on Vertex (project curametrics-492614, region us-central1).
 *
 * House style (locked, see memory project_editorial_illustration):
 *   linocut / engraving, deep charcoal ink on warm cream paper, single
 *   crimson-red accent. Colors in WORDS never hex. Hard no-text negatives.
 *
 * Auth: GOOGLE_CREDENTIALS_JSON (service-account JSON) — same as vertex-ai.ts.
 *
 *   npx tsx scripts/_gen-editorial-image.ts <key> <aspect> [count]
 *     <key>    one of the PROMPTS keys below
 *     <aspect> 1:1 | 3:4 | 4:3 | 16:9 | 9:16
 *     [count]  samples to generate (default 2) → .tmp/gen/<key>-<n>.png
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createSign } from 'crypto'
import { mkdirSync, writeFileSync } from 'fs'

const PROJECT = 'curametrics-492614'
const MODEL = 'imagen-4.0-generate-001'
const ENDPOINT = `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/us-central1/publishers/google/models/${MODEL}:predict`

const STYLE =
  'Bold linocut / woodcut engraving print. Deep charcoal-black ink on warm cream ' +
  'paper, with a single crimson-red spot-color accent. Hand-carved relief texture, ' +
  'visible gouge marks and hatching. Vintage children\'s-book printmaking feel, ' +
  'warm and inviting, gaming-positive. The composition fills the entire frame edge ' +
  'to edge with balanced visual weight — no large empty margins.'

const NEGATIVE =
  'no text, no words, no letters, no numbers, no typography, no captions, no logos, ' +
  'no watermark, no signature, no labels on any object, every object blank and ' +
  'unmarked, no UI, no photograph, no 3d render, no gradient mesh, no neon, ' +
  'no empty corners, not a centered vignette on blank background.'

const PROMPTS: Record<string, string> = {
  // Guide: base-game scoring / a single purchase that bundles single-player +
  // online. A full-bleed scene, not a centered motif on void.
  'bundled-online-modes':
    'A single open game box in the lower center, its lid raised, two worlds growing ' +
    'out of it and spreading across the whole width: to the LEFT a quiet single-player ' +
    'adventure — rolling mountains, a winding path, a lone small hero; to the RIGHT a ' +
    'lively shared online arena — several small friendly figures playing together, ' +
    'banners and arches. The two halves mirror each other and reach the left and right ' +
    'edges, one connected landscape. ' + STYLE,

  // Homepage hero — wide backdrop. Visual weight pushed RIGHT so the left stays
  // calmer for the headline overlay. Inviting "storybook of play".
  'hero':
    'A wide panoramic scene. On the RIGHT, a large open atlas-like book stands upright; ' +
    'out of its pages a whole world of play rises like a paper pop-up — friendly ' +
    'mountains, a small castle, building blocks, stars, a kite, a gentle dragon, a tiny ' +
    'controller, children exploring. The wonder is densest on the right and tapers ' +
    'gently toward the LEFT, which is open calm sky and a few drifting stars. Warm, ' +
    'expansive, reassuring — a parent\'s guide to the worlds their children play in. ' +
    STYLE,
}

type SAKey = { client_email: string; private_key: string }

async function getAccessToken(): Promise<string> {
  const keyJson = process.env.GOOGLE_CREDENTIALS_JSON
  if (!keyJson) throw new Error('GOOGLE_CREDENTIALS_JSON not set')
  const key: SAKey = JSON.parse(keyJson)
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })).toString('base64url')
  const unsigned = `${header}.${payload}`
  const sign = createSign('RSA-SHA256'); sign.update(unsigned)
  const jwt = `${unsigned}.${sign.sign(key.private_key, 'base64url')}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`token exchange failed: ${await res.text()}`)
  return (await res.json()).access_token
}

async function main() {
  const [key, aspect = '4:3', countStr = '2'] = process.argv.slice(2)
  const prompt = PROMPTS[key]
  if (!prompt) throw new Error(`unknown key "${key}" — have: ${Object.keys(PROMPTS).join(', ')}`)
  const count = parseInt(countStr, 10)

  const token = await getAccessToken()
  console.log(`Generating ${count}× "${key}" @ ${aspect} …`)
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: count,
        aspectRatio: aspect,
        negativePrompt: NEGATIVE,
        addWatermark: false,
        personGeneration: 'allow_all',
      },
    }),
  })
  if (!res.ok) throw new Error(`Imagen ${res.status}: ${(await res.text()).slice(0, 500)}`)
  const data = await res.json()
  const preds = data.predictions ?? []
  if (preds.length === 0) throw new Error(`no predictions: ${JSON.stringify(data).slice(0, 400)}`)

  mkdirSync(resolve(process.cwd(), '.tmp/gen'), { recursive: true })
  preds.forEach((p: { bytesBase64Encoded?: string }, i: number) => {
    if (!p.bytesBase64Encoded) return
    const out = resolve(process.cwd(), `.tmp/gen/${key}-${i + 1}.png`)
    writeFileSync(out, Buffer.from(p.bytesBase64Encoded, 'base64'))
    console.log(`  wrote ${out}`)
  })
}

main().catch((e) => { console.error(e); process.exit(1) })
