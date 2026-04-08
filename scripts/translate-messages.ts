/**
 * translate-messages.ts
 *
 * Translates messages/en.json into target languages using Gemini Flash.
 * Only translates values — keys and ICU placeholders ({count}, <yellow>…</yellow>) are preserved.
 *
 * Usage:
 *   npx tsx scripts/translate-messages.ts                    # all languages
 *   npx tsx scripts/translate-messages.ts --lang es          # Spanish only
 *   npx tsx scripts/translate-messages.ts --lang fr,sv,de    # multiple
 *   npx tsx scripts/translate-messages.ts --force            # overwrite existing files
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

import fs from 'fs'
import nodePath from 'path'
import { GoogleGenAI } from '@google/genai'

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
const langIdx = args.indexOf('--lang')
const langArg = args.find(a => a.startsWith('--lang='))?.split('=')[1]
         ?? (langIdx !== -1 ? args[langIdx + 1] : undefined)

const targetLocales = langArg
  ? langArg.split(',').map(l => l.trim()).filter(l => SUPPORTED_LOCALES.includes(l))
  : SUPPORTED_LOCALES

// ─── Gemini setup ─────────────────────────────────────────────────────────────

const googleAI = new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_PROJECT_ID!, location: process.env.GOOGLE_LOCATION ?? 'us-central1' })
const MODEL    = 'gemini-2.5-flash'

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

  const prompt = `You are a local copywriter for a children's game rating website called "Curascore by Good Game Parent". You are NOT doing a literal translation — you are writing copy that feels native and natural in ${langName}, as if it were written by a local for a local audience.

${voiceNote}

The site is GAMING POSITIVE — it empowers parents rather than scaring them. Benefits always come before risks. The tone is informed and confident, never preachy or alarmist.

RULES (non-negotiable):
1. Return ONLY valid JSON — no markdown, no code fences, no commentary.
2. Keep ALL keys exactly as-is.
3. Preserve ICU placeholders exactly: {count}, {year}, {query}, {platforms}, {current}, {total}, {min}, {n} etc.
4. Preserve HTML-like rich text tags exactly: <yellow>…</yellow> — only translate the text inside them, never the tags themselves.
5. Keep plural ICU patterns intact: {count, plural, one {# game} other {# games}} — only translate the English words inside the curly braces.
6. Brand names are NEVER translated: "Curascore", "Good Game Parent", "ESRB", "Metacritic", "Gemini", "PlaySmart".
7. Keep scoring terms consistent: BDS = "Benefit Density Score", RIS = "Risk Intensity Score" (these stay in English as proper nouns).

Input JSON (English source):
${JSON.stringify(strings, null, 2)}

Output: localized JSON with the same keys, copy that sounds like it was written by a native speaker.`

  const res = await googleAI.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })

  const text = res.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    console.error(`  [parse error] raw response:\n${text.slice(0, 500)}`)
    throw new Error(`Failed to parse Gemini JSON response for ${targetLang}`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const enJson: JsonObj = JSON.parse(fs.readFileSync(EN_FILE, 'utf-8'))
  const flat = flatten(enJson)
  const totalKeys = Object.keys(flat).length

  console.log(`\nTranslating ${totalKeys} strings from en.json`)
  console.log(`Target languages: ${targetLocales.join(', ')}`)
  if (force) console.log('Force mode: will overwrite existing files\n')

  for (const locale of targetLocales) {
    const outFile = nodePath.join(MESSAGES_DIR, `${locale}.json`)

    if (fs.existsSync(outFile) && !force) {
      console.log(`⏭  ${locale}: file exists — use --force to overwrite`)
      continue
    }

    console.log(`\n→ Translating to ${LOCALE_NAMES[locale] ?? locale}…`)

    // Split into batches of 50 key-value pairs to avoid token limits
    const entries = Object.entries(flat)
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
          const isNetworkErr = (err as { code?: string })?.code === 'UND_ERR_HEADERS_TIMEOUT'
            || String(err).includes('fetch failed')
            || String(err).includes('ECONNRESET')
          if ((status === 429 || isNetworkErr) && attempt < 5) {
            const delay = Math.pow(2, attempt) * 8_000
            console.log(`[${status ?? 'network error'} — waiting ${delay / 1000}s]`)
            await new Promise(r => setTimeout(r, delay))
            attempt++
          } else {
            throw err
          }
        }
      }
    }

    // Rebuild nested structure
    const nested = unflatten(translated)
    fs.writeFileSync(outFile, JSON.stringify(nested, null, 2) + '\n', 'utf-8')
    console.log(`  ✓ Written to messages/${locale}.json`)
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
