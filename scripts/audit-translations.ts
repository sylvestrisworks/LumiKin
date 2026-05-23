/**
 * Stage-1 translation audit — pure-code lint, no LLM.
 *
 * Walks every gameTranslations row, compares each of the 6 translatable
 * fields against its English source, and writes:
 *   - qualityScore     (100 − Σ severity, floored at 0)
 *   - qualityIssues    (array of { rule, field, severity, detail })
 *   - needsRetranslate (true when qualityScore < RETRANSLATE_THRESHOLD)
 *   - auditedAt
 *
 * Rules implemented:
 *   1. empty_with_source            severity 30
 *   2. no_locale_diacritic          severity 30
 *   3. english_stopword_leak        severity 10
 *   4. length_ratio_outlier         severity 10
 *   5. dnt_violation                severity 20
 *   6. sentence_drift               severity 5
 *   7. markdown_drift               severity 5
 *   8. prompt_artifact              severity 20
 *   9. cross_locale_duplicate       severity 30
 *  10. punctuation_parity           severity 5
 *
 * Usage:
 *   npx tsx scripts/audit-translations.ts            # audit + write
 *   npx tsx scripts/audit-translations.ts --dry      # report only, no writes
 *   npx tsx scripts/audit-translations.ts --locale=sv
 *   npx tsx scripts/audit-translations.ts --limit=200
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

// ─── Config ───────────────────────────────────────────────────────────────────

const LOCALES = ['sv', 'de', 'fr', 'es'] as const
type Locale = typeof LOCALES[number]

const TRANSLATABLE_FIELDS = [
  'executiveSummary',
  'benefitsNarrative',
  'risksNarrative',
  'parentTip',
  'parentTipBenefits',
  'bechdelNotes',
] as const
type Field = typeof TRANSLATABLE_FIELDS[number]

// Min char length before we believe rule 2 (short strings legitimately may lack diacritics).
const DIACRITIC_MIN_LEN = 80

// Severity weights — match the audit plan.
const SEVERITY = {
  empty_with_source:      30,
  no_locale_diacritic:    30,
  english_stopword_leak:  10,
  length_ratio_outlier:   10,
  dnt_violation:          20,
  sentence_drift:          5,
  markdown_drift:          5,
  prompt_artifact:        20,
  cross_locale_duplicate: 30,
  punctuation_parity:      5,
} as const

const RETRANSLATE_THRESHOLD = 70  // <70 → flagged for re-translation

// Rule-3 stopwords chosen to avoid overlap with target-language words.
// Excluded: "will" (collides w/ German "wants"), "die" (collides w/ German article).
const ENGLISH_STOPWORDS = [
  'the', 'and', 'your', 'child', 'parent', 'this', 'that',
  'when', 'where', 'time', 'would', 'should', 'with', 'what',
  'these', 'those', 'their', 'about', 'because',
]
const STOPWORD_RE = new RegExp(`\\b(${ENGLISH_STOPWORDS.join('|')})\\b`, 'gi')
const STOPWORD_THRESHOLD = 3

// Rule-4 length-ratio bounds per locale. German routinely runs longer.
const LENGTH_BOUNDS: Record<Locale, [number, number]> = {
  sv: [0.55, 1.8],
  de: [0.7,  2.0],
  fr: [0.55, 1.8],
  es: [0.55, 1.8],
}
const LENGTH_MIN_SOURCE = 40  // skip very short fields

// Rule-8 prompt-artifact patterns. Note: "locale" removed from the list because
// it collides with the French/Spanish/Italian word "locale" (feminine of "local").
// The camelCase field names are vanishingly unlikely to appear in natural text.
const ARTIFACT_RE = /\b(executiveSummary|benefitsNarrative|risksNarrative|parentTipBenefits|parentTip|bechdelNotes|JSON)\b/

// Rule-5 — words that are too generic to enforce as DNT (would over-flag).
const DNT_STOPLIST = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at',
  'game', 'world', 'edition', 'remake', 'remaster', 'remastered',
])

// Diacritic / locale-marker character classes.
const LOCALE_DIACRITICS: Record<Locale, RegExp> = {
  sv: /[åäöÅÄÖ]/,
  de: /[äöüßÄÖÜ]/,
  fr: /[àâçéèêëîïôûùüÿÀÂÇÉÈÊËÎÏÔÛÙÜŸœŒ]/,
  es: /[áéíóúñ¿¡ÁÉÍÓÚÑ]/,
}

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const localeArg = args.find(a => a.startsWith('--locale='))?.split('=')[1] as Locale | undefined
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
const LIMIT = limitArg ? parseInt(limitArg, 10) : undefined
const TARGET_LOCALES: readonly Locale[] = localeArg ? [localeArg] : LOCALES

// ─── Source-of-truth fetch ────────────────────────────────────────────────────

type SourceRow = {
  gameId: number
  executiveSummary:  string | null
  benefitsNarrative: string | null
  risksNarrative:    string | null
  parentTip:         string | null
  parentTipBenefits: string | null
  bechdelNotes:      string | null
  title:             string | null
  developer:         string | null
  publisher:         string | null
}

async function loadSources(gameIds: number[]): Promise<Map<number, SourceRow>> {
  if (gameIds.length === 0) return new Map()

  // executiveSummary lives on gameScores; the other 5 live on reviews (joined via gameScores.reviewId).
  // games row gives us title + developer + publisher for the DNT rule.
  const rows = await db
    .select({
      gameId:            gameScores.gameId,
      executiveSummary:  gameScores.executiveSummary,
      benefitsNarrative: reviews.benefitsNarrative,
      risksNarrative:    reviews.risksNarrative,
      parentTip:         reviews.parentTip,
      parentTipBenefits: reviews.parentTipBenefits,
      bechdelNotes:      reviews.bechdelNotes,
      title:             games.title,
      developer:         games.developer,
      publisher:         games.publisher,
    })
    .from(gameScores)
    .leftJoin(reviews, eq(reviews.id, gameScores.reviewId))
    .leftJoin(games,   eq(games.id, gameScores.gameId))
    .where(inArray(gameScores.gameId, gameIds))

  return new Map(rows.map(r => [r.gameId, r as SourceRow]))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normalizeForMatch(s: string): string {
  return stripDiacritics(s).toLowerCase()
}

function stripQuotedSpans(s: string): string {
  // Remove "…", “…”, „…“, '…' so quoted English titles don't trigger rule 3.
  return s
    .replace(/"[^"]*"/g, ' ')
    .replace(/[“”][^“”]*[“”]/g, ' ')
    .replace(/„[^“‟]*[“‟]/g, ' ')
    .replace(/'[^']{2,}'/g, ' ')
}

function countMarkdownBold(s: string): number {
  return (s.match(/\*\*[^*]+\*\*/g) || []).length
}
function countLeadingBullets(s: string): number {
  return (s.match(/(^|\n)\s*[-*•]\s/g) || []).length
}
function countParagraphBreaks(s: string): number {
  return (s.match(/\n\s*\n/g) || []).length
}
function countSentences(s: string): number {
  return (s.trim().match(/[.!?]+(?=\s|$)/g) || []).length
}

// ─── Rules ────────────────────────────────────────────────────────────────────

function ruleEmptyWithSource(
  source: string | null,
  translation: string | null,
  field: Field,
): TranslationIssue | null {
  const srcHas = !!(source && source.trim())
  const trnHas = !!(translation && translation.trim())
  if (srcHas && !trnHas) {
    return {
      rule: 'empty_with_source',
      field,
      severity: SEVERITY.empty_with_source,
      detail: `source length ${source!.trim().length}`,
    }
  }
  return null
}

function ruleNoLocaleDiacritic(
  translation: string | null,
  field: Field,
  locale: Locale,
): TranslationIssue | null {
  if (!translation) return null
  const trimmed = translation.trim()
  if (trimmed.length < DIACRITIC_MIN_LEN) return null
  if (LOCALE_DIACRITICS[locale].test(trimmed)) return null
  return {
    rule: 'no_locale_diacritic',
    field,
    severity: SEVERITY.no_locale_diacritic,
    detail: `${trimmed.length} chars, no ${locale} diacritic — likely untranslated`,
  }
}

function ruleEnglishStopwordLeak(
  translation: string | null,
  field: Field,
): TranslationIssue | null {
  if (!translation) return null
  const stripped = stripQuotedSpans(translation)
  const matches = stripped.match(STOPWORD_RE) || []
  if (matches.length < STOPWORD_THRESHOLD) return null
  return {
    rule: 'english_stopword_leak',
    field,
    severity: SEVERITY.english_stopword_leak,
    detail: `${matches.length} unquoted English stopword(s): ${[...new Set(matches.map(m => m.toLowerCase()))].slice(0, 6).join(', ')}`,
  }
}

function ruleLengthRatioOutlier(
  source: string | null,
  translation: string | null,
  field: Field,
  locale: Locale,
): TranslationIssue | null {
  if (!source || !translation) return null
  const src = source.trim()
  const trn = translation.trim()
  if (src.length < LENGTH_MIN_SOURCE) return null
  if (trn.length === 0) return null  // covered by empty_with_source
  const ratio = trn.length / src.length
  const [lo, hi] = LENGTH_BOUNDS[locale]
  if (ratio >= lo && ratio <= hi) return null
  return {
    rule: 'length_ratio_outlier',
    field,
    severity: SEVERITY.length_ratio_outlier,
    detail: `len ratio ${ratio.toFixed(2)} outside [${lo}, ${hi}] (src=${src.length}, trn=${trn.length})`,
  }
}

function ruleDntViolation(
  source: string | null,
  translation: string | null,
  field: Field,
  dntTerms: string[],
): TranslationIssue | null {
  if (!source || !translation || dntTerms.length === 0) return null
  const srcNorm = normalizeForMatch(source)
  const trnNorm = normalizeForMatch(translation)
  const missing: string[] = []
  for (const term of dntTerms) {
    const t = normalizeForMatch(term)
    if (!t || t.length < 4) continue
    if (DNT_STOPLIST.has(t)) continue
    if (srcNorm.includes(t) && !trnNorm.includes(t)) {
      missing.push(term)
    }
  }
  if (missing.length === 0) return null
  return {
    rule: 'dnt_violation',
    field,
    severity: SEVERITY.dnt_violation,
    detail: `do-not-translate term(s) missing from translation: ${missing.slice(0, 3).join(', ')}`,
  }
}

function ruleSentenceDrift(
  source: string | null,
  translation: string | null,
  field: Field,
): TranslationIssue | null {
  if (!source || !translation) return null
  const srcN = countSentences(source)
  const trnN = countSentences(translation)
  if (srcN < 2) return null
  if (Math.abs(srcN - trnN) <= 1) return null
  return {
    rule: 'sentence_drift',
    field,
    severity: SEVERITY.sentence_drift,
    detail: `sentence count drift src=${srcN} trn=${trnN}`,
  }
}

function ruleMarkdownDrift(
  source: string | null,
  translation: string | null,
  field: Field,
): TranslationIssue | null {
  if (!source || !translation) return null
  const diffs: string[] = []
  const checks: Array<[string, (s: string) => number]> = [
    ['bold',    countMarkdownBold],
    ['bullets', countLeadingBullets],
    ['paras',   countParagraphBreaks],
  ]
  for (const [name, fn] of checks) {
    const a = fn(source), b = fn(translation)
    if (Math.abs(a - b) > 1) diffs.push(`${name} ${a}→${b}`)
  }
  if (diffs.length === 0) return null
  return {
    rule: 'markdown_drift',
    field,
    severity: SEVERITY.markdown_drift,
    detail: diffs.join('; '),
  }
}

function rulePromptArtifact(
  translation: string | null,
  field: Field,
): TranslationIssue | null {
  if (!translation) return null
  const trimmed = translation.trim()
  if (ARTIFACT_RE.test(trimmed)) {
    return {
      rule: 'prompt_artifact',
      field,
      severity: SEVERITY.prompt_artifact,
      detail: `contains schema/prompt artifact: ${trimmed.match(ARTIFACT_RE)?.[0]}`,
    }
  }
  // Stray JSON braces wrapping content.
  if (/^\s*[{\[]/.test(trimmed) || /[}\]]\s*$/.test(trimmed)) {
    return {
      rule: 'prompt_artifact',
      field,
      severity: SEVERITY.prompt_artifact,
      detail: 'starts/ends with JSON bracket',
    }
  }
  return null
}

function rulePunctuationParity(
  source: string | null,
  translation: string | null,
  field: Field,
): TranslationIssue | null {
  if (!source || !translation) return null
  const src = source.trim(), trn = translation.trim()
  if (src.length === 0 || trn.length === 0) return null

  const reasons: string[] = []
  const parenDelta = Math.abs(
    (src.match(/\(/g) || []).length - (src.match(/\)/g) || []).length,
  ) === 0
  const trnParenBalanced = Math.abs(
    (trn.match(/\(/g) || []).length - (trn.match(/\)/g) || []).length,
  ) === 0
  if (parenDelta && !trnParenBalanced) reasons.push('unbalanced parens')

  const srcTerm = /[.!?]$/.test(src)
  const trnTerm = /[.!?…]$/.test(trn)
  if (srcTerm && !trnTerm) reasons.push('missing terminal punctuation')

  if (reasons.length === 0) return null
  return {
    rule: 'punctuation_parity',
    field,
    severity: SEVERITY.punctuation_parity,
    detail: reasons.join('; '),
  }
}

// Rule 9 runs per-game across locales (not per-row), so it has its own pass.
function findCrossLocaleDuplicates(
  perLocale: Map<Locale, Record<Field, string | null>>,
): Map<Locale, TranslationIssue[]> {
  const out = new Map<Locale, TranslationIssue[]>()
  const locales = Array.from(perLocale.keys())

  for (const field of TRANSLATABLE_FIELDS) {
    // Group locales by normalized translation text.
    const buckets = new Map<string, Locale[]>()
    for (const loc of locales) {
      const v = perLocale.get(loc)![field]
      if (!v || !v.trim()) continue
      const key = v.trim().toLowerCase()
      const arr = buckets.get(key) ?? []
      arr.push(loc)
      buckets.set(key, arr)
    }
    for (const [, locs] of buckets) {
      if (locs.length < 2) continue
      const others = locs.join(',')
      for (const loc of locs) {
        const issue: TranslationIssue = {
          rule: 'cross_locale_duplicate',
          field,
          severity: SEVERITY.cross_locale_duplicate,
          detail: `identical text across [${others}] — translation likely never ran`,
        }
        const arr = out.get(loc) ?? []
        arr.push(issue)
        out.set(loc, arr)
      }
    }
  }
  return out
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreFromIssues(issues: TranslationIssue[]): number {
  const total = issues.reduce((acc, i) => acc + i.severity, 0)
  return Math.max(0, 100 - total)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type TxRow = {
  id: number
  gameId: number
  locale: string
  executiveSummary:  string | null
  benefitsNarrative: string | null
  risksNarrative:    string | null
  parentTip:         string | null
  parentTipBenefits: string | null
  bechdelNotes:      string | null
}

async function main() {
  console.log(
    `[audit] locales=${TARGET_LOCALES.join(',')} ` +
    `limit=${LIMIT ?? 'none'} dry=${DRY}`,
  )

  // Pull translations in pages keyed by gameId so cross-locale rule has all
  // locales for a game in the same batch.
  const PAGE_SIZE = 500
  const txAll: TxRow[] = []
  let lastGameId = 0
  while (true) {
    const page = await db
      .select({
        id:                gameTranslations.id,
        gameId:            gameTranslations.gameId,
        locale:            gameTranslations.locale,
        executiveSummary:  gameTranslations.executiveSummary,
        benefitsNarrative: gameTranslations.benefitsNarrative,
        risksNarrative:    gameTranslations.risksNarrative,
        parentTip:         gameTranslations.parentTip,
        parentTipBenefits: gameTranslations.parentTipBenefits,
        bechdelNotes:      gameTranslations.bechdelNotes,
      })
      .from(gameTranslations)
      .where(and(
        sql`${gameTranslations.gameId} > ${lastGameId}`,
        inArray(gameTranslations.locale, TARGET_LOCALES as unknown as string[]),
      ))
      .orderBy(gameTranslations.gameId, gameTranslations.locale)
      .limit(PAGE_SIZE)

    if (page.length === 0) break
    txAll.push(...page)
    lastGameId = page[page.length - 1].gameId
    if (LIMIT && txAll.length >= LIMIT) {
      txAll.splice(LIMIT)
      break
    }
  }

  console.log(`[audit] loaded ${txAll.length} translation rows`)

  // Group rows by gameId.
  const byGame = new Map<number, TxRow[]>()
  for (const r of txAll) {
    const arr = byGame.get(r.gameId) ?? []
    arr.push(r)
    byGame.set(r.gameId, arr)
  }

  const sources = await loadSources(Array.from(byGame.keys()))
  console.log(`[audit] loaded sources for ${sources.size} games`)

  // Counters for summary.
  const ruleCounts: Record<string, Record<Locale, number>> = {}
  for (const rule of Object.keys(SEVERITY)) {
    ruleCounts[rule] = { sv: 0, de: 0, fr: 0, es: 0 }
  }
  const localeRowCount: Record<Locale, number> = { sv: 0, de: 0, fr: 0, es: 0 }
  let flaggedForRetranslate = 0
  const sampleHits: Array<{ gameId: number; locale: Locale; rule: string; field: string; detail?: string }> = []

  let processed = 0
  const writePromises: Promise<unknown>[] = []
  const WRITE_CONCURRENCY = 20

  for (const [gameId, rows] of byGame) {
    const src = sources.get(gameId)

    // Build per-locale snapshot for cross-locale rule.
    const perLocale = new Map<Locale, Record<Field, string | null>>()
    for (const r of rows) {
      const loc = r.locale as Locale
      perLocale.set(loc, {
        executiveSummary:  r.executiveSummary,
        benefitsNarrative: r.benefitsNarrative,
        risksNarrative:    r.risksNarrative,
        parentTip:         r.parentTip,
        parentTipBenefits: r.parentTipBenefits,
        bechdelNotes:      r.bechdelNotes,
      })
    }
    const crossLocaleHits = findCrossLocaleDuplicates(perLocale)

    for (const r of rows) {
      const loc = r.locale as Locale
      localeRowCount[loc]++

      const issues: TranslationIssue[] = []

      const dntTerms = src
        ? [src.title, src.developer, src.publisher].filter((x): x is string => !!x && x.trim().length > 0)
        : []

      for (const field of TRANSLATABLE_FIELDS) {
        const source = src ? (src[field] as string | null) : null
        const translation = r[field]

        const i1  = ruleEmptyWithSource(source, translation, field);              if (i1)  issues.push(i1)
        const i2  = ruleNoLocaleDiacritic(translation, field, loc);               if (i2)  issues.push(i2)
        const i3  = ruleEnglishStopwordLeak(translation, field);                  if (i3)  issues.push(i3)
        const i4  = ruleLengthRatioOutlier(source, translation, field, loc);      if (i4)  issues.push(i4)
        const i5  = ruleDntViolation(source, translation, field, dntTerms);       if (i5)  issues.push(i5)
        const i6  = ruleSentenceDrift(source, translation, field);                if (i6)  issues.push(i6)
        const i7  = ruleMarkdownDrift(source, translation, field);                if (i7)  issues.push(i7)
        const i8  = rulePromptArtifact(translation, field);                       if (i8)  issues.push(i8)
        const i10 = rulePunctuationParity(source, translation, field);            if (i10) issues.push(i10)
      }

      const crossHits = crossLocaleHits.get(loc) ?? []
      issues.push(...crossHits)

      for (const i of issues) {
        ruleCounts[i.rule][loc]++
        if (sampleHits.length < 30) {
          sampleHits.push({ gameId, locale: loc, rule: i.rule, field: i.field, detail: i.detail })
        }
      }

      const score = scoreFromIssues(issues)
      const needsRetranslate = score < RETRANSLATE_THRESHOLD
      if (needsRetranslate) flaggedForRetranslate++

      if (!DRY) {
        const p = db.update(gameTranslations)
          .set({
            qualityScore:     score,
            qualityIssues:    issues,
            needsRetranslate,
            auditedAt:        new Date(),
          })
          .where(eq(gameTranslations.id, r.id))
        writePromises.push(p)
        if (writePromises.length >= WRITE_CONCURRENCY) {
          await Promise.all(writePromises.splice(0, writePromises.length))
        }
      }

      processed++
      if (processed % 500 === 0) {
        console.log(`[audit] processed ${processed}/${txAll.length}`)
      }
    }
  }

  if (!DRY && writePromises.length > 0) {
    await Promise.all(writePromises)
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log('\n=== Audit summary ===')
  console.log(`rows audited:           ${processed}`)
  console.log(`flagged for retranslate: ${flaggedForRetranslate} (score < ${RETRANSLATE_THRESHOLD})`)
  console.log('\nrule hits by locale:')
  console.log('rule                          sv      de      fr      es')
  for (const rule of Object.keys(ruleCounts)) {
    const r = ruleCounts[rule]
    console.log(
      rule.padEnd(28) +
      String(r.sv).padStart(8) +
      String(r.de).padStart(8) +
      String(r.fr).padStart(8) +
      String(r.es).padStart(8),
    )
  }
  console.log('\nrows per locale:')
  for (const loc of LOCALES) console.log(`  ${loc}: ${localeRowCount[loc]}`)

  if (sampleHits.length > 0) {
    console.log('\nfirst 30 hits (sample):')
    for (const h of sampleHits) {
      console.log(`  gid=${h.gameId} ${h.locale} ${h.rule} ${h.field} — ${h.detail ?? ''}`)
    }
  }

  console.log(DRY ? '\n[dry run — nothing written]' : '\n[done]')
  process.exit(0)
}

main().catch(err => {
  console.error('[audit] fatal:', err)
  process.exit(1)
})
