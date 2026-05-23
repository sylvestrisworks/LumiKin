/**
 * Stage-2 translation audit — LLM judge.
 *
 * Picks gameTranslations rows in the "mid-flag" band (quality_score between
 * MID_FLAG_LO and MID_FLAG_HI) where the lint already saw something but
 * couldn't tell whether the translation is genuinely bad. Batches them to
 * Gemini and asks for a verdict + reason.
 *
 * Cost shape: we send ~BATCH_SIZE (source, translation) pairs per Gemini call
 * and ask the model to return JSON listing ONLY flagged indices. Rows that
 * pass produce zero output tokens, so cost scales with the failure rate.
 *
 * Default is --dry: prints the cost estimate, sends ZERO calls, exits.
 * Pass --run to actually call Gemini and persist judge issues.
 *
 * Flags:
 *   --dry                 (default) print plan + cost estimate, no API calls
 *   --run                 perform real Gemini calls and write back
 *   --locale=sv           restrict to one locale
 *   --limit=N             cap rows judged
 *   --max-cost=USD        abort before exceeding this Gemini spend (default 2.00)
 *   --lo=40 --hi=70       override mid-flag score band
 *   --field=executiveSummary  only judge this field (default: all 6)
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import {
  gameTranslations,
  gameScores,
  reviews,
  games,
  type TranslationIssue,
} from '@/lib/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { callGeminiText } from '@/lib/vertex-ai'

// ─── Config ───────────────────────────────────────────────────────────────────

const LOCALES = ['sv', 'de', 'fr', 'es'] as const
type Locale = typeof LOCALES[number]

const LANGUAGE_NAMES: Record<Locale, string> = {
  sv: 'Swedish',
  de: 'German',
  fr: 'French',
  es: 'Spanish (Latin American)',
}

const TRANSLATABLE_FIELDS = [
  'executiveSummary',
  'benefitsNarrative',
  'risksNarrative',
  'parentTip',
  'parentTipBenefits',
  'bechdelNotes',
] as const
type Field = typeof TRANSLATABLE_FIELDS[number]

// Default mid-flag band.
const DEFAULT_LO = 40
const DEFAULT_HI = 70

// Severity if the judge flags a pair.
const JUDGE_SEVERITY = 25

// Batch size: 1 Gemini call covers this many (source, translation) pairs.
const BATCH_SIZE = 12

// Cost model (Gemini 2.5 Flash, public pricing as of 2026-05 — adjust if it
// moves). Input ~$0.30 / Moutput ~$2.50 / M. Be conservative.
const COST_PER_M_INPUT  = 0.30
const COST_PER_M_OUTPUT = 2.50

// Rough char→token ratio (Gemini ~4 chars/token for Latin scripts).
const CHARS_PER_TOKEN = 4

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY = !args.includes('--run')
const localeArg = args.find(a => a.startsWith('--locale='))?.split('=')[1] as Locale | undefined
const limitArg  = args.find(a => a.startsWith('--limit='))?.split('=')[1]
const loArg     = args.find(a => a.startsWith('--lo='))?.split('=')[1]
const hiArg     = args.find(a => a.startsWith('--hi='))?.split('=')[1]
const fieldArg  = args.find(a => a.startsWith('--field='))?.split('=')[1] as Field | undefined
const costArg   = args.find(a => a.startsWith('--max-cost='))?.split('=')[1]

const LIMIT     = limitArg ? parseInt(limitArg, 10) : undefined
const SCORE_LO  = loArg ? parseInt(loArg, 10) : DEFAULT_LO
const SCORE_HI  = hiArg ? parseInt(hiArg, 10) : DEFAULT_HI
const MAX_COST  = costArg ? parseFloat(costArg) : 2.00
const TARGET_LOCALES: readonly Locale[] = localeArg ? [localeArg] : LOCALES
const TARGET_FIELDS: readonly Field[] = fieldArg ? [fieldArg] : TRANSLATABLE_FIELDS

// ─── Source loader (mirrors audit-translations.ts) ────────────────────────────

type SourceRow = {
  gameId: number
  title:             string | null
  executiveSummary:  string | null
  benefitsNarrative: string | null
  risksNarrative:    string | null
  parentTip:         string | null
  parentTipBenefits: string | null
  bechdelNotes:      string | null
}

async function loadSources(gameIds: number[]): Promise<Map<number, SourceRow>> {
  if (gameIds.length === 0) return new Map()
  const rows = await db
    .select({
      gameId:            gameScores.gameId,
      title:             games.title,
      executiveSummary:  gameScores.executiveSummary,
      benefitsNarrative: reviews.benefitsNarrative,
      risksNarrative:    reviews.risksNarrative,
      parentTip:         reviews.parentTip,
      parentTipBenefits: reviews.parentTipBenefits,
      bechdelNotes:      reviews.bechdelNotes,
    })
    .from(gameScores)
    .leftJoin(reviews, eq(reviews.id, gameScores.reviewId))
    .leftJoin(games,   eq(games.id, gameScores.gameId))
    .where(inArray(gameScores.gameId, gameIds))
  return new Map(rows.map(r => [r.gameId, r as SourceRow]))
}

// ─── Pair selection ───────────────────────────────────────────────────────────

type Pair = {
  rowId: number
  gameId: number
  locale: Locale
  field: Field
  title: string
  source: string
  translation: string
}

async function loadCandidates(): Promise<Pair[]> {
  const rows = await db
    .select({
      id:                gameTranslations.id,
      gameId:            gameTranslations.gameId,
      locale:            gameTranslations.locale,
      qualityScore:      gameTranslations.qualityScore,
      executiveSummary:  gameTranslations.executiveSummary,
      benefitsNarrative: gameTranslations.benefitsNarrative,
      risksNarrative:    gameTranslations.risksNarrative,
      parentTip:         gameTranslations.parentTip,
      parentTipBenefits: gameTranslations.parentTipBenefits,
      bechdelNotes:      gameTranslations.bechdelNotes,
    })
    .from(gameTranslations)
    .where(and(
      inArray(gameTranslations.locale, TARGET_LOCALES as unknown as string[]),
      sql`${gameTranslations.qualityScore} BETWEEN ${SCORE_LO} AND ${SCORE_HI}`,
    ))
    .orderBy(gameTranslations.qualityScore)
    .limit(LIMIT ?? 5_000)

  const gameIds = Array.from(new Set(rows.map(r => r.gameId)))
  const sources = await loadSources(gameIds)

  const pairs: Pair[] = []
  for (const r of rows) {
    const src = sources.get(r.gameId)
    if (!src || !src.title) continue
    for (const field of TARGET_FIELDS) {
      const source = src[field]
      const translation = r[field]
      if (!source || !translation) continue
      const s = source.trim(), t = translation.trim()
      if (s.length === 0 || t.length === 0) continue
      pairs.push({
        rowId: r.id,
        gameId: r.gameId,
        locale: r.locale as Locale,
        field,
        title: src.title,
        source: s,
        translation: t,
      })
    }
  }
  return pairs
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(locale: Locale, batch: Pair[]): string {
  const lang = LANGUAGE_NAMES[locale]
  const numbered = batch.map((p, i) =>
    `### Pair ${i}\n` +
    `Game: ${p.title}\n` +
    `Field: ${p.field}\n` +
    `English source:\n${p.source}\n\n` +
    `${lang} translation:\n${p.translation}\n`,
  ).join('\n---\n')

  return `You are a strict ${lang} editor reviewing AI-generated game-review translations for parents.

For each pair below, decide if the ${lang} translation has SERIOUS problems. Only flag a pair when ONE of these is true:
- meaning differs from the English source (mistranslation, dropped content, added content not in source)
- ${lang} is ungrammatical, awkward, or reads like a machine output
- tone is wrong (English source is informative/parent-friendly — translation must match)
- proper nouns / game / brand / character names altered or translated when they shouldn't be
- text contains untranslated English chunks (excluding cited titles)

Do NOT flag for: minor stylistic preferences, slight rephrasing, idiomatic differences, or length variation that does not change meaning.

Return ONLY a valid JSON array. Each element flags ONE problematic pair:
[{"i": <pair index>, "reason": "<short reason, ${lang} or English, max 20 words>"}]

If nothing is wrong, return [].

Pairs:
${numbered}`
}

// ─── Cost estimate ────────────────────────────────────────────────────────────

function estimateCost(pairs: Pair[]): {
  callCount: number
  inputTokens: number
  outputTokens: number
  usd: number
} {
  const byLocale = new Map<Locale, Pair[]>()
  for (const p of pairs) {
    const a = byLocale.get(p.locale) ?? []
    a.push(p)
    byLocale.set(p.locale, a)
  }

  let inputChars = 0
  let callCount = 0
  for (const [loc, list] of byLocale) {
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const batch = list.slice(i, i + BATCH_SIZE)
      const prompt = buildPrompt(loc, batch)
      inputChars += prompt.length
      callCount++
    }
  }
  const inputTokens = Math.ceil(inputChars / CHARS_PER_TOKEN)
  // Pessimistic: assume 30% of pairs get flagged with ~40 chars of JSON.
  const outputTokens = Math.ceil((pairs.length * 0.3 * 40) / CHARS_PER_TOKEN)
  const usd = (inputTokens / 1_000_000) * COST_PER_M_INPUT
            + (outputTokens / 1_000_000) * COST_PER_M_OUTPUT
  return { callCount, inputTokens, outputTokens, usd }
}

// ─── Judge runner ─────────────────────────────────────────────────────────────

type JudgeHit = { i: number; reason: string }

async function judgeBatch(locale: Locale, batch: Pair[]): Promise<JudgeHit[]> {
  const prompt = buildPrompt(locale, batch)
  const text = await callGeminiText(prompt)
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) {
    console.warn(`[judge] No JSON array in response: ${text.slice(0, 120)}`)
    return []
  }
  try {
    const parsed = JSON.parse(m[0])
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x: unknown): x is JudgeHit =>
        !!x && typeof (x as JudgeHit).i === 'number' && typeof (x as JudgeHit).reason === 'string')
      .filter(h => h.i >= 0 && h.i < batch.length)
  } catch (e) {
    console.warn(`[judge] JSON parse failed: ${(e as Error).message}`)
    return []
  }
}

async function applyJudgement(pair: Pair, reason: string): Promise<void> {
  // Append a new issue; preserve any existing lint issues; recompute score.
  const [row] = await db
    .select({ qualityIssues: gameTranslations.qualityIssues, qualityScore: gameTranslations.qualityScore })
    .from(gameTranslations)
    .where(eq(gameTranslations.id, pair.rowId))
    .limit(1)

  const prevIssues: TranslationIssue[] = (row?.qualityIssues as TranslationIssue[] | null) ?? []
  // Don't double-add if a judge issue for this field already exists.
  const alreadyJudged = prevIssues.some(i => i.rule === 'judge_flag' && i.field === pair.field)
  if (alreadyJudged) return

  const next: TranslationIssue[] = [
    ...prevIssues,
    { rule: 'judge_flag', field: pair.field, severity: JUDGE_SEVERITY, detail: reason },
  ]
  const prevScore = row?.qualityScore ?? 100
  const newScore = Math.max(0, prevScore - JUDGE_SEVERITY)
  await db.update(gameTranslations)
    .set({
      qualityIssues:    next,
      qualityScore:     newScore,
      needsRetranslate: newScore < 70,
      auditedAt:        new Date(),
    })
    .where(eq(gameTranslations.id, pair.rowId))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `[judge] locales=${TARGET_LOCALES.join(',')} ` +
    `fields=${TARGET_FIELDS.join(',')} ` +
    `score=[${SCORE_LO},${SCORE_HI}] ` +
    `limit=${LIMIT ?? 'none'} ` +
    `dry=${DRY}`,
  )

  const pairs = await loadCandidates()
  console.log(`[judge] found ${pairs.length} candidate pairs across ${new Set(pairs.map(p => p.gameId)).size} games`)

  const byLocale = new Map<Locale, Pair[]>()
  for (const p of pairs) {
    const a = byLocale.get(p.locale) ?? []
    a.push(p)
    byLocale.set(p.locale, a)
  }
  for (const loc of LOCALES) {
    const n = byLocale.get(loc)?.length ?? 0
    if (n > 0) console.log(`  ${loc}: ${n}`)
  }

  const est = estimateCost(pairs)
  console.log(
    `\n[judge] estimated ${est.callCount} Gemini calls, ` +
    `~${est.inputTokens.toLocaleString()} in / ~${est.outputTokens.toLocaleString()} out tokens, ` +
    `~$${est.usd.toFixed(3)} USD (cap $${MAX_COST.toFixed(2)})`,
  )

  if (DRY) {
    console.log('\n[dry — no API calls. pass --run to execute.]')
    process.exit(0)
  }
  if (est.usd > MAX_COST) {
    console.error(`[judge] ABORTING — estimated cost $${est.usd.toFixed(3)} exceeds --max-cost $${MAX_COST.toFixed(2)}`)
    console.error('         re-run with --max-cost=<higher> or tighten --limit/--locale/--field')
    process.exit(2)
  }

  let calls = 0, flagged = 0, errored = 0
  const CONCURRENCY = 5

  const allBatches: Array<{ locale: Locale; batch: Pair[] }> = []
  for (const [locale, list] of byLocale) {
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      allBatches.push({ locale, batch: list.slice(i, i + BATCH_SIZE) })
    }
  }
  console.log(`[judge] ${allBatches.length} batches at ${CONCURRENCY}x concurrency`)

  let cursor = 0
  const worker = async () => {
    while (cursor < allBatches.length) {
      const idx = cursor++
      const { locale, batch } = allBatches[idx]
      try {
        const hits = await judgeBatch(locale, batch)
        calls++
        for (const h of hits) {
          await applyJudgement(batch[h.i], h.reason)
          flagged++
        }
        if (calls % 20 === 0) {
          console.log(`[judge] ${calls}/${allBatches.length} calls — ${flagged} flagged, ${errored} errored`)
        }
      } catch (e) {
        errored++
        console.warn(`[judge] batch ${idx} (${locale}) failed: ${(e as Error).message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  console.log(`\n[judge] done — ${calls} calls, ${flagged} pairs flagged, ${errored} errored`)
  process.exit(0)
}

main().catch(e => {
  console.error('[judge] fatal:', e)
  process.exit(1)
})
