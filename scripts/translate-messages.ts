/**
 * translate-messages.ts
 *
 * Translates messages/en.json into target languages using Vertex AI (Gemini Flash).
 * Only translates values — keys and ICU placeholders ({count}, <yellow>…</yellow>) are preserved.
 *
 * Usage:
 *   npx tsx scripts/translate-messages.ts --missing          # fill keys absent from locale files
 *   npx tsx scripts/translate-messages.ts --lang es          # Spanish only (with --missing or --force)
 *   npx tsx scripts/translate-messages.ts --lang fr,sv,de    # multiple
 *   npx tsx scripts/translate-messages.ts --force            # full overwrite (clobbers hand-tuning)
 *
 * Default is --missing — safer than --force. Use --force only when you want to
 * regenerate everything from scratch.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import fs from 'fs'
import nodePath from 'path'
import { callGeminiText } from '@/lib/vertex-ai'

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = ['es', 'fr', 'sv', 'de']

const LOCALE_NAMES: Record<string, string> = {
  es: 'Spanish (Latin American)',
  fr: 'French',
  sv: 'Swedish',
  de: 'German',
}

// Copywriting notes per locale — voice, tone, and things to avoid
const LOCALE_VOICE: Record<string, string> = {
  es: `Voice: warm, direct, empowering. Latin American Spanish. Use "tú" not "usted". Avoid overly formal or Castilian phrasing. Parents are savvy — don't talk down to them.`,
  fr: `Voice: clear, confident, slightly warm. Metropolitan French. Avoid overly literal English constructions. French parents appreciate precision — keep it crisp, not bureaucratic.`,
  sv: `Voice: calm, direct, trustworthy — classic Swedish "lagom" tone. Never stiff or overly formal. Avoid literal English word-for-word translations that sound unnatural in Swedish. Use everyday Swedish vocabulary a parent would use, not academic or corporate language. Contractions and conversational phrasing are fine. Examples of what to avoid: "Säker swap" → prefer "Bättre alternativ"; "Bläddra bland alla spel" is fine but "Utforska alla spel" may feel more natural. Think BabyBjörn brand copy, not IKEA instruction manual.`,
  de: `Voice: straightforward, trustworthy, approachable — not stiff Hochdeutsch. German parents value clarity and directness. Avoid overly long compound words where a simpler phrase works. Du-form (informal) is appropriate throughout. Think Hornbach ad copy, not legal document.`,
}

const MESSAGES_DIR = nodePath.join(process.cwd(), 'messages')
const EN_FILE      = nodePath.join(MESSAGES_DIR, 'en.json')

const args    = process.argv.slice(2)
const force   = args.includes('--force')
// --missing is the default; flag accepted but not required.
const langIdx = args.indexOf('--lang')
const langArg = args.find(a => a.startsWith('--lang='))?.split('=')[1]
         ?? (langIdx !== -1 ? args[langIdx + 1] : undefined)

const targetLocales = langArg
  ? langArg.split(',').map(l => l.trim()).filter(l => SUPPORTED_LOCALES.includes(l))
  : SUPPORTED_LOCALES

// ─── Flatten/unflatten helpers ────────────────────────────────────────────────

type JsonObj = Record<string, unknown>

function flatten(obj: JsonObj, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(result, flatten(v as JsonObj, key))
    } else if (typeof v === 'string') {
      result[key] = v
    }
  }
  return result
}

function unflatten(flat: Record<string, string>): JsonObj {
  const result: JsonObj = {}
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cur: any = result
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {}
      cur = cur[parts[i]]
    }
    cur[parts[parts.length - 1]] = value
  }
  return result
}

// ─── Translation ──────────────────────────────────────────────────────────────

async function translateBatch(
  strings: Record<string, string>,
  targetLang: string,
): Promise<Record<string, string>> {
  const langName = LOCALE_NAMES[targetLang] ?? targetLang

  const voiceNote = LOCALE_VOICE[targetLang] ?? `Voice: natural, friendly, appropriate for parents.`

  const prompt = `You are a local copywriter for a children's game rating website called "LumiKin". You are NOT doing a literal translation — you are writing copy that feels native and natural in ${langName}, as if it were written by a local for a local audience.

${voiceNote}

The site is GAMING POSITIVE — it empowers parents rather than scaring them. Benefits always come before risks. The tone is informed and confident, never preachy or alarmist.

RULES (non-negotiable):
1. Return ONLY valid JSON — no markdown, no code fences, no commentary.
2. Keep ALL keys exactly as-is.
3. Preserve ICU placeholders exactly: {count}, {year}, {query}, {platforms}, {current}, {total}, {min}, {n} etc.
4. Preserve HTML-like rich text tags exactly: <yellow>…</yellow> — only translate the text inside them, never the tags themselves.
5. Keep plural ICU patterns intact: {count, plural, one {# game} other {# games}} — only translate the English words inside the curly braces.
6. Brand names are NEVER translated: "LumiKin", "ESRB", "Metacritic", "Gemini", "LumiKin".
7. Keep scoring terms consistent: BDS = "Benefit Density Score", RIS = "Risk Intensity Score" (these stay in English as proper nouns).

Input JSON (English source):
${JSON.stringify(strings, null, 2)}

Output: localized JSON with the same keys, copy that sounds like it was written by a native speaker.`

  const text = await callGeminiText(prompt)

  // Be tolerant of code fences or pre-text — pull out the largest {...} block.
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error(`No JSON object in Gemini response: ${text.slice(0, 200)}`)
  const parsed = JSON.parse(m[0]) as Record<string, unknown>

  // Validate shape: same keys, string values.
  const out: Record<string, string> = {}
  for (const key of Object.keys(strings)) {
    const v = parsed[key]
    if (typeof v !== 'string') {
      throw new Error(`Missing or non-string value for key "${key}" in ${targetLang} batch`)
    }
    out[key] = v
  }
  return out
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const enJson: JsonObj = JSON.parse(fs.readFileSync(EN_FILE, 'utf-8'))
  const enFlat = flatten(enJson)
  const totalKeys = Object.keys(enFlat).length

  console.log(`\nen.json has ${totalKeys} strings`)
  console.log(`Target languages: ${targetLocales.join(', ')}`)
  console.log(`Mode: ${force ? 'force (overwrite)' : 'missing (delta only)'}\n`)

  for (const locale of targetLocales) {
    const outFile = nodePath.join(MESSAGES_DIR, `${locale}.json`)
    const exists  = fs.existsSync(outFile)

    let existingFlat: Record<string, string> = {}
    if (exists && !force) {
      const existingJson: JsonObj = JSON.parse(fs.readFileSync(outFile, 'utf-8'))
      existingFlat = flatten(existingJson)
    }

    // Pick which keys to translate: missing mode = (in en, not in locale); force = all.
    const toTranslate: Record<string, string> = force
      ? enFlat
      : Object.fromEntries(
          Object.entries(enFlat).filter(([k]) => !(k in existingFlat)),
        )

    const targetCount = Object.keys(toTranslate).length
    if (targetCount === 0) {
      console.log(`✓ ${locale}: nothing to translate`)
      continue
    }
    console.log(`→ ${locale}: translating ${targetCount}${force ? '' : ' new'} strings…`)

    const entries = Object.entries(toTranslate)
    const BATCH_SIZE = 25
    const translated: Record<string, string> = {}

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = Object.fromEntries(entries.slice(i, i + BATCH_SIZE))
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(entries.length / BATCH_SIZE)
      process.stdout.write(`  Batch ${batchNum}/${totalBatches}… `)

      let attempt = 0
      while (true) {
        try {
          const result = await translateBatch(batch, locale)
          Object.assign(translated, result)
          console.log('✓')
          break
        } catch (err: unknown) {
          const status = (err as { status?: number })?.status
          const msg = String(err)
          const isNetworkErr = (err as { code?: string })?.code === 'UND_ERR_HEADERS_TIMEOUT'
            || msg.includes('fetch failed')
            || msg.includes('ECONNRESET')
          // Gemini sometimes drops a key or returns malformed JSON — retry the same batch.
          const isShapeErr = msg.includes('Missing or non-string value') || msg.includes('No JSON object')
          if ((status === 429 || isNetworkErr || isShapeErr) && attempt < 5) {
            const delay = isShapeErr ? 1_500 : Math.pow(2, attempt) * 8_000
            console.log(`[${status ?? (isShapeErr ? 'shape error' : 'network error')} — retry in ${delay / 1000}s]`)
            await new Promise(r => setTimeout(r, delay))
            attempt++
          } else {
            throw err
          }
        }
      }
    }

    // Merge new translations on top of existing (force replaces all).
    const merged = force ? translated : { ...existingFlat, ...translated }
    const nested = unflatten(merged)
    fs.writeFileSync(outFile, JSON.stringify(nested, null, 2) + '\n', 'utf-8')
    console.log(`  ✓ wrote messages/${locale}.json (${Object.keys(merged).length} keys)`)
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
