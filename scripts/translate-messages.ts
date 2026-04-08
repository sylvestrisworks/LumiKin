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

import fs from 'fs'
import path from 'path'
import { GoogleGenAI } from '@google/genai'

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = ['es', 'fr', 'sv', 'de']

const LOCALE_NAMES: Record<string, string> = {
  es: 'Spanish (Latin American)',
  fr: 'French',
  sv: 'Swedish',
  de: 'German',
}

const MESSAGES_DIR = path.join(process.cwd(), 'messages')
const EN_FILE      = path.join(MESSAGES_DIR, 'en.json')

const args    = process.argv.slice(2)
const langArg = args.find(a => a.startsWith('--lang='))?.split('=')[1]
         ?? args[args.indexOf('--lang') + 1]
const force   = args.includes('--force')

const targetLocales = langArg
  ? langArg.split(',').map(l => l.trim()).filter(l => SUPPORTED_LOCALES.includes(l))
  : SUPPORTED_LOCALES

// ─── Gemini setup ─────────────────────────────────────────────────────────────

const googleAI = new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT ?? 'playsmart-457410', location: 'us-central1' })
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

  const prompt = `You are a professional translator for a children's game rating website called "Curascore by Good Game Parent".
Translate the following JSON values from English to ${langName}.

CRITICAL RULES:
1. Return ONLY valid JSON — no markdown, no code fences, no commentary.
2. Keep ALL keys exactly as-is.
3. Preserve ICU placeholders exactly: {count}, {year}, {query}, {platforms}, {current}, {total}, {min}, {n} etc.
4. Preserve HTML-like rich text tags exactly: <yellow>…</yellow> — only translate text inside them.
5. Keep plural ICU patterns intact: {count, plural, one {# game} other {# games}} — only translate the English words inside.
6. Brand names are NEVER translated: "Curascore", "Good Game Parent", "ESRB", "Metacritic", "Gemini", "PlaySmart".
7. Keep game-rating terms consistent: BDS = "Benefit Density Score", RIS = "Risk Intensity Score".
8. Use natural, friendly tone appropriate for parents.

Input JSON:
${JSON.stringify(strings, null, 2)}

Output: translated JSON with same keys.`

  const res = await googleAI.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json' },
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
    const outFile = path.join(MESSAGES_DIR, `${locale}.json`)

    if (fs.existsSync(outFile) && !force) {
      console.log(`⏭  ${locale}: file exists — use --force to overwrite`)
      continue
    }

    console.log(`\n→ Translating to ${LOCALE_NAMES[locale] ?? locale}…`)

    // Split into batches of 50 key-value pairs to avoid token limits
    const entries = Object.entries(flat)
    const BATCH_SIZE = 60
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
          if (status === 429 && attempt < 4) {
            const delay = Math.pow(2, attempt) * 10_000
            console.log(`[429 — waiting ${delay / 1000}s]`)
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
