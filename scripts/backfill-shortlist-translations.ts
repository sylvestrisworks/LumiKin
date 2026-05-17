/**
 * backfill-shortlist-translations.ts
 *
 * Forces translation rows for the homepage FeaturedGame shortlist across all
 * supported locales (sv, de, fr, es). Mirrors src/app/api/cron/translate-content
 * but scoped to the 7 shortlist slugs so the homepage never renders a half-
 * English featured box.
 *
 *   npx tsx scripts/backfill-shortlist-translations.ts
 *   npx tsx scripts/backfill-shortlist-translations.ts --dry-run
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { eq, and, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, reviews, gameTranslations } from '@/lib/db/schema'
import { callGeminiText } from '@/lib/vertex-ai'

const SHORTLIST = [
  'stardew-valley',
  'minecraft',
  'the-legend-of-zelda-breath-of-the-wild',
  'mario-kart-8-deluxe',
  'roblox',
  'celeste',
  'animal-crossing-new-horizons',
]

const LOCALES = ['sv', 'de', 'fr', 'es'] as const
type Locale = typeof LOCALES[number]

const LANGUAGE_NAMES: Record<Locale, string> = {
  sv: 'Swedish',
  de: 'German',
  fr: 'French',
  es: 'Spanish (Latin American)',
}

const dryRun = process.argv.includes('--dry-run')

type TranslatableContent = {
  executiveSummary:  string | null
  benefitsNarrative: string | null
  risksNarrative:    string | null
  parentTip:         string | null
  parentTipBenefits: string | null
  bechdelNotes:      string | null
}

async function translateToLocales(
  content: TranslatableContent,
  locales: Locale[],
): Promise<Partial<Record<Locale, TranslatableContent>>> {
  const toTranslate: Partial<TranslatableContent> = {}
  for (const [k, v] of Object.entries(content)) {
    if (v && v.trim()) toTranslate[k as keyof TranslatableContent] = v
  }
  if (Object.keys(toTranslate).length === 0) return {}

  const localeList = locales.map(l => LANGUAGE_NAMES[l]).join(', ')
  const localeKeys = locales.map(l => `"${l}"`).join(', ')

  const prompt = `Translate the following game review content from English into ${localeList}.

Rules:
- Return ONLY a valid JSON object with locale codes as top-level keys: ${localeKeys}
- Each value is an object with the same keys as the input
- Keep the parent-friendly, informative tone
- Do NOT translate game titles, character names, brand names, or developer/publisher names — keep those exactly as-is
- Do not add explanations or markdown — just the JSON object

Input:
${JSON.stringify(toTranslate, null, 2)}`

  const text = await callGeminiText(prompt)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON in response: ${text.slice(0, 200)}`)

  const parsed = JSON.parse(jsonMatch[0]) as Partial<Record<Locale, Partial<TranslatableContent>>>
  const out: Partial<Record<Locale, TranslatableContent>> = {}
  for (const locale of locales) {
    const r = parsed[locale]
    if (!r) continue
    out[locale] = {
      executiveSummary:  r.executiveSummary  ?? null,
      benefitsNarrative: r.benefitsNarrative ?? null,
      risksNarrative:    r.risksNarrative    ?? null,
      parentTip:         r.parentTip         ?? null,
      parentTipBenefits: r.parentTipBenefits ?? null,
      bechdelNotes:      r.bechdelNotes      ?? null,
    }
  }
  return out
}

type FieldKey = keyof TranslatableContent
const ALL_FIELDS: FieldKey[] = [
  'executiveSummary', 'benefitsNarrative', 'risksNarrative',
  'parentTip', 'parentTipBenefits', 'bechdelNotes',
]

async function main() {
  if (!process.env.GOOGLE_CREDENTIALS_JSON) {
    console.error('GOOGLE_CREDENTIALS_JSON not set in env')
    process.exit(1)
  }

  const rows = await db
    .select({
      gameId:           games.id,
      slug:             games.slug,
      executiveSummary: gameScores.executiveSummary,
      reviewId:         gameScores.reviewId,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(inArray(games.slug, SHORTLIST))

  console.log(`Found ${rows.length}/${SHORTLIST.length} shortlist games in DB`)

  let translatedFields = 0
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    // Build EN source content
    let source: TranslatableContent = {
      executiveSummary:  row.executiveSummary,
      benefitsNarrative: null,
      risksNarrative:    null,
      parentTip:         null,
      parentTipBenefits: null,
      bechdelNotes:      null,
    }
    if (row.reviewId) {
      const [review] = await db
        .select({
          benefitsNarrative: reviews.benefitsNarrative,
          risksNarrative:    reviews.risksNarrative,
          parentTip:         reviews.parentTip,
          parentTipBenefits: reviews.parentTipBenefits,
          bechdelNotes:      reviews.bechdelNotes,
        })
        .from(reviews)
        .where(eq(reviews.id, row.reviewId))
        .limit(1)
      if (review) source = { ...source, ...review }
    }

    // Existing locale rows (may have null fields)
    const existing = await db
      .select()
      .from(gameTranslations)
      .where(and(
        eq(gameTranslations.gameId, row.gameId),
        sql`${gameTranslations.locale} = ANY(ARRAY['sv','de','fr','es'])`,
      ))
    const existingByLocale = new Map(existing.map(r => [r.locale as Locale, r]))

    // Per-locale, which source-present fields are missing locally?
    const perLocaleMissing = new Map<Locale, FieldKey[]>()
    for (const locale of LOCALES) {
      const row = existingByLocale.get(locale)
      const missing: FieldKey[] = []
      for (const f of ALL_FIELDS) {
        const src = source[f]
        if (!src || !src.trim()) continue
        const cur = row ? (row as Record<string, unknown>)[f] : null
        if (cur == null || (typeof cur === 'string' && cur.trim() === '')) {
          missing.push(f)
        }
      }
      if (missing.length > 0) perLocaleMissing.set(locale, missing)
    }

    if (perLocaleMissing.size === 0) {
      console.log(`  ${row.slug}: all locales/fields present`)
      skipped++
      continue
    }

    // Union of fields to translate — one Gemini call covers everyone
    const needed = new Set<FieldKey>()
    for (const fs of perLocaleMissing.values()) for (const f of fs) needed.add(f)
    const partial: TranslatableContent = {
      executiveSummary:  needed.has('executiveSummary')  ? source.executiveSummary  : null,
      benefitsNarrative: needed.has('benefitsNarrative') ? source.benefitsNarrative : null,
      risksNarrative:    needed.has('risksNarrative')    ? source.risksNarrative    : null,
      parentTip:         needed.has('parentTip')         ? source.parentTip         : null,
      parentTipBenefits: needed.has('parentTipBenefits') ? source.parentTipBenefits : null,
      bechdelNotes:      needed.has('bechdelNotes')      ? source.bechdelNotes      : null,
    }

    const localesToCall = Array.from(perLocaleMissing.keys())
    const summary = Array.from(perLocaleMissing.entries())
      .map(([l, fs]) => `${l}[${fs.join(',')}]`)
      .join(' ')
    console.log(`  ${row.slug} → ${summary}`)

    if (dryRun) {
      for (const fs of perLocaleMissing.values()) translatedFields += fs.length
      continue
    }

    try {
      const results = await translateToLocales(partial, localesToCall)
      for (const [locale, missingFields] of perLocaleMissing.entries()) {
        const result = results[locale]
        if (!result) { errors++; continue }

        const hasRow = existingByLocale.has(locale)
        if (!hasRow) {
          await db.insert(gameTranslations).values({
            gameId: row.gameId,
            locale,
            ...Object.fromEntries(missingFields.map(f => [f, result[f] ?? null])),
          }).onConflictDoNothing()
        } else {
          // Only set the fields we actually translated; leave others untouched
          const patch: Record<string, string | null> = {}
          for (const f of missingFields) {
            const v = result[f]
            if (v) patch[f] = v
          }
          if (Object.keys(patch).length > 0) {
            await db.update(gameTranslations)
              .set(patch)
              .where(and(eq(gameTranslations.gameId, row.gameId), eq(gameTranslations.locale, locale)))
          }
        }
        translatedFields += missingFields.length
      }
    } catch (err) {
      console.error(`  ${row.slug}: ERROR`, err)
      errors++
    }
  }

  console.log(`\nDone. translatedFields=${translatedFields} skipped=${skipped} errors=${errors}${dryRun ? ' (dry-run)' : ''}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
