/**
 * Translate platformExperiences narrative content (summary, benefits, risks,
 * parentTip) into all locales. Mirrors the prompt structure used by
 * /api/cron/translate-content but operates on experienceScores → experienceTranslations.
 *
 * Defaults:
 *   - Locales:  sv, de, fr, es
 *   - Skips experiences that already have a translation row for all 4 locales.
 *
 * Usage:
 *   npx tsx scripts/translate-experiences.ts                 # full run
 *   npx tsx scripts/translate-experiences.ts --limit=50      # sample
 *   npx tsx scripts/translate-experiences.ts --locale=sv     # one locale
 *   npx tsx scripts/translate-experiences.ts --dry           # cost estimate only
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import {
  platformExperiences,
  experienceScores,
  experienceTranslations,
  games,
} from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { callGeminiText } from '@/lib/vertex-ai'

const LOCALES = ['sv', 'de', 'fr', 'es'] as const
type Locale = typeof LOCALES[number]

const LANGUAGE_NAMES: Record<Locale, string> = {
  sv: 'Swedish',
  de: 'German',
  fr: 'French',
  es: 'Spanish (Latin American)',
}

type TranslatableContent = {
  summary:           string | null
  benefitsNarrative: string | null
  risksNarrative:    string | null
  parentTip:         string | null
}

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const localeArg = args.find(a => a.startsWith('--locale='))?.split('=')[1] as Locale | undefined
const limitArg  = args.find(a => a.startsWith('--limit='))?.split('=')[1]
const LIMIT     = limitArg ? parseInt(limitArg, 10) : undefined
const TARGET_LOCALES: readonly Locale[] = localeArg ? [localeArg] : LOCALES

async function translateToLocales(
  content: TranslatableContent,
  locales: Locale[],
  dntTerms: string[],
): Promise<Partial<Record<Locale, TranslatableContent>>> {
  const toTranslate: Partial<TranslatableContent> = {}
  for (const [k, v] of Object.entries(content)) {
    if (v && v.trim()) toTranslate[k as keyof TranslatableContent] = v
  }
  if (Object.keys(toTranslate).length === 0) return {}

  const localeList = locales.map(l => LANGUAGE_NAMES[l]).join(', ')
  const localeKeys = locales.map(l => `"${l}"`).join(', ')
  const dntBlock = dntTerms.length > 0
    ? `\nDO NOT TRANSLATE these terms — they MUST appear verbatim in the translation if they appear in the source:\n${dntTerms.map(t => `  - ${t}`).join('\n')}\n`
    : ''

  const prompt = `You are translating game-review content from English into ${localeList} for parents. Faithfulness matters more than fluency.

FORMAT:
- Return ONLY a valid JSON object with locale codes as top-level keys: ${localeKeys}
- Each value has the same keys as the input.
- No explanations or markdown around the JSON — just the JSON object.

CONTENT FIDELITY (most important):
- Translate what is there. Do NOT add information not in the source.
- Do NOT summarize or compress. Translate every sentence.
- Each translated field's length should be 80–130% of the source.
- Keep the same number of sentences as the source (±1).
- Do NOT invent facts about the experience, gameplay, or risks.
${dntBlock}
TONE:
- Parent-friendly and informative, never fear-based.
- Match the source register.

Input:
${JSON.stringify(toTranslate, null, 2)}`

  const text = await callGeminiText(prompt)
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error(`No JSON in response: ${text.slice(0, 200)}`)
  const parsed = JSON.parse(m[0]) as Partial<Record<Locale, Partial<TranslatableContent>>>

  const out: Partial<Record<Locale, TranslatableContent>> = {}
  for (const locale of locales) {
    const r = parsed[locale]
    if (!r) continue
    out[locale] = {
      summary:           r.summary           ?? null,
      benefitsNarrative: r.benefitsNarrative ?? null,
      risksNarrative:    r.risksNarrative    ?? null,
      parentTip:         r.parentTip         ?? null,
    }
  }
  return out
}

async function main() {
  console.log(`[translate-exp] locales=${TARGET_LOCALES.join(',')} limit=${LIMIT ?? 'none'} dry=${DRY}`)

  // Pull experiences with score content + count existing translations.
  const pending = await db
    .select({
      experienceId:      platformExperiences.id,
      slug:              platformExperiences.slug,
      title:             platformExperiences.title,
      creatorName:       platformExperiences.creatorName,
      platformTitle:     games.title,
      summary:           experienceScores.summary,
      benefitsNarrative: experienceScores.benefitsNarrative,
      risksNarrative:    experienceScores.risksNarrative,
      parentTip:         experienceScores.parentTip,
    })
    .from(platformExperiences)
    .innerJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .leftJoin(games, eq(games.id, platformExperiences.platformId))
    .where(sql`(
      SELECT COUNT(*) FROM experience_translations et
       WHERE et.experience_id = ${platformExperiences.id}
         AND et.locale = ANY(ARRAY[${sql.join(TARGET_LOCALES.map(l => sql`${l}`), sql`, `)}]::varchar[])
    ) < ${TARGET_LOCALES.length}`)
    .limit(LIMIT ?? 5000)

  console.log(`[translate-exp] ${pending.length} experiences need work`)

  if (DRY) {
    const approxTokensPerCall = 3500    // rough — translate-content avg
    const totalTokens = pending.length * approxTokensPerCall
    const usd = (totalTokens / 1_000_000) * 0.30 + (totalTokens / 1_000_000) * 0.5 * 2.50
    console.log(`[translate-exp] estimated ~${pending.length} Gemini calls, ~${totalTokens.toLocaleString()} tokens, ~$${usd.toFixed(2)} USD`)
    process.exit(0)
  }

  let translated = 0, errored = 0, skipped = 0
  const CONCURRENCY = 5
  let cursor = 0

  const worker = async () => {
    while (cursor < pending.length) {
      const idx = cursor++
      const row = pending[idx]
      try {
        const existing = await db
          .select({ locale: experienceTranslations.locale })
          .from(experienceTranslations)
          .where(eq(experienceTranslations.experienceId, row.experienceId))
        const doneSet = new Set(existing.map(r => r.locale))
        const missing = TARGET_LOCALES.filter(l => !doneSet.has(l))
        if (missing.length === 0) { skipped++; continue }

        const dnt = [row.title, row.creatorName, row.platformTitle]
          .filter((s): s is string => !!s && s.trim().length > 0)

        const results = await translateToLocales(
          {
            summary:           row.summary,
            benefitsNarrative: row.benefitsNarrative,
            risksNarrative:    row.risksNarrative,
            parentTip:         row.parentTip,
          },
          missing as Locale[],
          dnt,
        )

        for (const locale of missing) {
          const r = results[locale]
          if (!r) { errored++; continue }
          await db.insert(experienceTranslations).values({
            experienceId:      row.experienceId,
            locale,
            summary:           r.summary,
            benefitsNarrative: r.benefitsNarrative,
            risksNarrative:    r.risksNarrative,
            parentTip:         r.parentTip,
          }).onConflictDoNothing()
          translated++
        }

        if (translated % 100 < 5) {
          console.log(`[translate-exp] ${idx + 1}/${pending.length} — translated=${translated} skipped=${skipped} errored=${errored}`)
        }
      } catch (e) {
        errored++
        console.warn(`[translate-exp] ${row.slug} failed: ${(e as Error).message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  console.log(`\n[translate-exp] done — translated=${translated} skipped=${skipped} errored=${errored}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
