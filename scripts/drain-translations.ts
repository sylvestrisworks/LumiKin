/**
 * drain-translations.ts
 *
 * One-shot local drain of the game_translations backlog through Claude (not
 * Gemini). Mirrors the queue logic in src/app/api/cron/translate-content/route.ts
 * — missing locale rows, needs_retranslate rows, and per-field gaps — but:
 *   - one Claude call per (game, locale) so each locale uses its own model
 *     (sv → Sonnet 4.6, de/fr/es → Haiku 4.5; see modelForLocale)
 *   - static per-locale instructions are sent as a cached system prefix
 *   - live progress + cache-hit visibility so quality can be watched as it runs
 *
 * Usage:
 *   npx tsx scripts/drain-translations.ts                  # drain everything
 *   npx tsx scripts/drain-translations.ts --locale sv      # one locale only
 *   npx tsx scripts/drain-translations.ts --limit 50       # at most 50 games
 *   npx tsx scripts/drain-translations.ts --concurrency 4  # in-flight call cap
 *   npx tsx scripts/drain-translations.ts --dry            # count work, no calls
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { games, gameScores, reviews, gameTranslations } from '@/lib/db/schema'
import { eq, and, isNotNull, sql } from 'drizzle-orm'
import { callClaude, modelForLocale } from '@/lib/anthropic'
import { runClaudeCli } from '@/lib/claude-cli'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Parameterized SQL `ARRAY[...]` literal — postgres `ANY()` needs a real array, not a bound JS array. */
const sqlArray = (items: readonly string[]) =>
  sql`ARRAY[${sql.join(items.map(i => sql`${i}`), sql`, `)}]`

// ─── Config ───────────────────────────────────────────────────────────────────

const ALL_LOCALES = ['sv', 'de', 'fr', 'es'] as const
type Locale = typeof ALL_LOCALES[number]

const LANGUAGE_NAMES: Record<Locale, string> = {
  sv: 'Swedish',
  de: 'German',
  fr: 'French',
  es: 'Spanish (Latin American)',
}

const args        = process.argv.slice(2)
const getArg      = (name: string) =>
  args.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
  ?? (args.indexOf(`--${name}`) !== -1 ? args[args.indexOf(`--${name}`) + 1] : undefined)
const DRY         = args.includes('--dry')
const PRIORITY    = args.includes('--priority')   // order shortlist + top-traffic first
const BACKEND     = (getArg('backend') ?? 'api') as 'api' | 'cli'
const localeArg   = getArg('locale') as Locale | undefined
const LOCALES: Locale[] = localeArg ? [localeArg] : [...ALL_LOCALES]

// Priority runs are a scoped trickle, so they default to a cap (top ~250 games)
// rather than the whole 17k queue. Override with --limit.
const LIMIT       = getArg('limit')
  ? parseInt(getArg('limit')!, 10)
  : (PRIORITY ? 250 : Infinity)
// CLI calls are slow + quota-limited, so default to a gentle concurrency.
const CONCURRENCY = getArg('concurrency')
  ? parseInt(getArg('concurrency')!, 10)
  : (BACKEND === 'cli' ? 2 : 6)

const PAGE_SIZE = 200

// Homepage FeaturedGame shortlist — translated first under --priority.
const SHORTLIST = [
  'stardew-valley', 'minecraft', 'the-legend-of-zelda-breath-of-the-wild',
  'mario-kart-8-deluxe', 'roblox', 'celeste', 'animal-crossing-new-horizons',
]

// Claude Code CLI takes model aliases; mirrors modelForLocale (sv → Sonnet, rest → Haiku).
const cliModelForLocale = (l: string) => (l === 'sv' ? 'sonnet' : 'haiku')

// ─── Types ────────────────────────────────────────────────────────────────────

type Content = {
  executiveSummary:            string | null
  benefitsNarrative:           string | null
  risksNarrative:              string | null
  parentTip:                   string | null
  parentTipBenefits:           string | null
  bechdelNotes:                string | null
  timeRecommendationReasoning: string | null
}

type WorkItem = {
  gameId:    number
  slug:      string
  locale:    Locale
  content:   Content
  dntTerms:  string[]
  isUpdate:  boolean   // true → row exists (retranslate / field-gap); false → insert
}

// ─── Per-locale cached instruction prefix ──────────────────────────────────────

function systemFor(locale: Locale): string {
  const lang = LANGUAGE_NAMES[locale]
  return `You are translating game-review content from English into ${lang} for parents. Faithfulness matters more than fluency — a less elegant but accurate translation beats a polished one that adds or drops information.

FORMAT:
- Return ONLY a valid JSON object with the same keys as the input object.
- No explanations or markdown around the JSON — just the JSON object.
- If an input field is null or absent, omit it from the output.

CONTENT FIDELITY (most important):
- Translate what is there. Do NOT add information, advice, examples, clarifications, or sentences that are not in the English source.
- Do NOT summarize or compress. Translate every sentence in the source.
- Each translated field's length should be roughly 80–130% of the source field length. If a field is hard to translate concisely, stay close to source length rather than shortening.
- Keep the same number of sentences as the source (±1 is acceptable).
- Do NOT invent facts about gameplay, ratings, mechanics, or risks that are not stated in the source.
- The user message may list "DO NOT TRANSLATE" terms (game titles, studios). Reproduce each verbatim wherever it appears in the source.

TONE:
- Parent-friendly and informative, never fear-based.
- Match the source register — if the source is plain language, do not get fancy in the translation.`
}

function userFor(content: Content, dntTerms: string[]): string {
  const toTranslate: Partial<Content> = {}
  for (const [k, v] of Object.entries(content)) {
    if (v && v.trim()) toTranslate[k as keyof Content] = v
  }
  const dntBlock = dntTerms.length > 0
    ? `DO NOT TRANSLATE (reproduce verbatim where they appear):\n${dntTerms.map(t => `  - ${t}`).join('\n')}\n\n`
    : ''
  return `${dntBlock}Input:\n${JSON.stringify(toTranslate, null, 2)}`
}

// ─── Build work items for one page of pending games ─────────────────────────────

async function fetchPending(limit: number) {
  return db
    .select({
      gameId:                      games.id,
      slug:                        games.slug,
      title:                       games.title,
      developer:                   games.developer,
      publisher:                   games.publisher,
      executiveSummary:            gameScores.executiveSummary,
      timeRecommendationReasoning: gameScores.timeRecommendationReasoning,
      reviewId:                    gameScores.reviewId,
      rawgAdded:                   games.rawgAdded,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      isNotNull(gameScores.curascore),
      sql`(
        (SELECT COUNT(*) FROM game_translations gt
           WHERE gt.game_id = ${games.id}
             AND gt.locale = ANY(${sqlArray(LOCALES)})) < ${LOCALES.length}
        OR EXISTS (SELECT 1 FROM game_translations gt
           WHERE gt.game_id = ${games.id}
             AND gt.locale = ANY(${sqlArray(LOCALES)})
             AND gt.needs_retranslate = TRUE)
        OR EXISTS (SELECT 1 FROM game_translations gt
           WHERE gt.game_id = ${games.id}
             AND gt.locale = ANY(${sqlArray(LOCALES)})
             AND (
               (gt.executive_summary  IS NULL AND ${gameScores.executiveSummary}            IS NOT NULL)
               OR (gt.time_rec_reasoning IS NULL AND ${gameScores.timeRecommendationReasoning} IS NOT NULL)
             ))
      )`,
    ))
    .orderBy(
      PRIORITY
        ? sql`(${games.slug} = ANY(${sqlArray(SHORTLIST)})) DESC, ${games.rawgAdded} DESC NULLS LAST`
        : gameScores.curascore,
    )
    .limit(limit)
}

async function buildWorkItems(row: Awaited<ReturnType<typeof fetchPending>>[number]): Promise<{ items: WorkItem[]; emptyInserts: Locale[]; emptyRetranslate: Locale[] }> {
  const existing = await db
    .select({
      locale:                      gameTranslations.locale,
      needsRetranslate:            gameTranslations.needsRetranslate,
      executiveSummary:            gameTranslations.executiveSummary,
      timeRecommendationReasoning: gameTranslations.timeRecommendationReasoning,
    })
    .from(gameTranslations)
    .where(and(
      eq(gameTranslations.gameId, row.gameId),
      sql`${gameTranslations.locale} = ANY(${sqlArray(LOCALES)})`,
    ))

  const doneSet = new Set(existing.map(r => r.locale))
  const missing: Locale[] = LOCALES.filter(l => !doneSet.has(l))
  const retranslate: Locale[] = existing
    .filter(r => r.needsRetranslate && LOCALES.includes(r.locale as Locale))
    .map(r => r.locale as Locale)
  const fieldGap: Locale[] = existing
    .filter(r => LOCALES.includes(r.locale as Locale) && !r.needsRetranslate)
    .filter(r =>
      (r.executiveSummary === null            && row.executiveSummary !== null) ||
      (r.timeRecommendationReasoning === null && row.timeRecommendationReasoning !== null))
    .map(r => r.locale as Locale)

  const updateLocales = Array.from(new Set([...retranslate, ...fieldGap]))
  const targets       = Array.from(new Set([...missing, ...updateLocales]))
  if (targets.length === 0) return { items: [], emptyInserts: [], emptyRetranslate: [] }

  let content: Content = {
    executiveSummary:            row.executiveSummary,
    timeRecommendationReasoning: row.timeRecommendationReasoning,
    benefitsNarrative:           null,
    risksNarrative:              null,
    parentTip:                   null,
    parentTipBenefits:           null,
    bechdelNotes:                null,
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
    if (review) content = { ...content, ...review }
  }

  const hasContent = Object.values(content).some(v => v && v.trim())
  if (!hasContent) {
    // Nothing to translate — reserve empty rows for genuinely-missing locales and
    // clear stale retranslate flags. No Claude calls.
    return { items: [], emptyInserts: missing, emptyRetranslate: updateLocales }
  }

  const dntTerms = [row.title, row.developer, row.publisher]
    .filter((s): s is string => !!s && s.trim().length > 0)

  const items: WorkItem[] = targets.map(locale => ({
    gameId:   row.gameId,
    slug:     row.slug,
    locale,
    content,
    dntTerms,
    isUpdate: !missing.includes(locale),
  }))
  return { items, emptyInserts: [], emptyRetranslate: [] }
}

// ─── Persist one translated item ────────────────────────────────────────────────

function parseJson(text: string): Partial<Content> | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) as Partial<Content> } catch { return null }
}

async function persist(item: WorkItem, r: Partial<Content>) {
  const values = {
    executiveSummary:            r.executiveSummary            ?? null,
    benefitsNarrative:           r.benefitsNarrative           ?? null,
    risksNarrative:              r.risksNarrative              ?? null,
    parentTip:                   r.parentTip                   ?? null,
    parentTipBenefits:           r.parentTipBenefits           ?? null,
    bechdelNotes:                r.bechdelNotes                ?? null,
    timeRecommendationReasoning: r.timeRecommendationReasoning ?? null,
  }
  if (item.isUpdate) {
    await db.update(gameTranslations)
      .set({ ...values, needsRetranslate: false, qualityScore: null, qualityIssues: null, auditedAt: null })
      .where(and(eq(gameTranslations.gameId, item.gameId), eq(gameTranslations.locale, item.locale)))
  } else {
    await db.insert(gameTranslations)
      .values({ gameId: item.gameId, locale: item.locale, ...values })
      .onConflictDoNothing()
  }
}

// ─── CLI backend (Max-plan headless trickle) ─────────────────────────────────────

// Set once the plan's compute quota is spent — stops the whole run fast instead of
// grinding through per-item backoffs against a cap that won't reset for hours.
let aborted = false

async function translateViaCli(item: WorkItem): Promise<string | null> {
  const system   = systemFor(item.locale)
  const user     = userFor(item.content, item.dntTerms)
  const model    = cliModelForLocale(item.locale)
  const backoffs = [30_000, 60_000, 120_000]   // wait out short usage-limit windows
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    if (aborted) return null
    const r = await runClaudeCli(system, user, model)
    if (r.ok) return r.text
    if (r.quotaExhausted) {
      aborted = true
      console.error(`\n⛔ Max plan compute quota exhausted — stopping. Progress is saved; re-run the same command after the quota resets and it resumes from what's pending.`)
      return null
    }
    if (r.rateLimited && attempt < backoffs.length) {
      const wait = backoffs[attempt]
      console.warn(`  ⏳ rate-limited (${item.slug} [${item.locale}]) — waiting ${wait / 1000}s`)
      await sleep(wait)
      continue
    }
    console.warn(`  ⚠ ${item.slug} [${item.locale}] — ${r.error}`)
    return null
  }
  return null
}

// ─── Concurrency-limited pool ────────────────────────────────────────────────────

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number) {
  let i = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++]
      await worker(item)
    }
  })
  await Promise.all(runners)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (BACKEND === 'api' && !process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set — add it to .env.local, or use --backend cli for the Max-plan path.')
    process.exit(1)
  }

  console.log(`\nDrain: backend=${BACKEND}  ${PRIORITY ? 'PRIORITY ' : ''}locales=${LOCALES.join(',')}  limit=${LIMIT === Infinity ? 'all' : LIMIT}  concurrency=${CONCURRENCY}  ${DRY ? '(DRY RUN)' : ''}`)
  console.log(`Models: sv → Sonnet, de/fr/es → Haiku${BACKEND === 'cli' ? ' (via Claude Code CLI / Max plan)' : ' 4.6 / 4.5 (via API)'}\n`)

  let translated = 0, updated = 0, errors = 0, emptyRows = 0, gamesProcessed = 0
  let cacheRead = 0, cacheWrite = 0, inputTokens = 0, outputTokens = 0
  const t0 = Date.now()

  while (gamesProcessed < LIMIT) {
    if (aborted) break
    const pageLimit = Math.min(PAGE_SIZE, LIMIT - gamesProcessed)
    const pending = await fetchPending(pageLimit)
    if (pending.length === 0) break

    // Build all work items for this page.
    const allItems: WorkItem[] = []
    for (const row of pending) {
      const { items, emptyInserts, emptyRetranslate } = await buildWorkItems(row)
      allItems.push(...items)
      if (!DRY && (emptyInserts.length || emptyRetranslate.length)) {
        for (const locale of emptyInserts) {
          await db.insert(gameTranslations).values({ gameId: row.gameId, locale }).onConflictDoNothing()
        }
        if (emptyRetranslate.length) {
          await db.update(gameTranslations)
            .set({ needsRetranslate: false, auditedAt: new Date() })
            .where(and(eq(gameTranslations.gameId, row.gameId), sql`${gameTranslations.locale} = ANY(${sqlArray(emptyRetranslate)})`))
        }
        emptyRows += emptyInserts.length + emptyRetranslate.length
      }
    }
    gamesProcessed += pending.length

    if (DRY) {
      console.log(`  page: ${pending.length} games → ${allItems.length} translation calls (+${emptyRows} empty rows)`)
      continue
    }

    await runPool(allItems, async (item) => {
      if (aborted) return
      try {
        let text: string | null
        if (BACKEND === 'cli') {
          text = await translateViaCli(item)
        } else {
          const msg = await callClaude(userFor(item.content, item.dntTerms), {
            system: systemFor(item.locale),
            model:  modelForLocale(item.locale),
          })
          text = msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('')
          cacheRead   += msg.usage.cache_read_input_tokens     ?? 0
          cacheWrite  += msg.usage.cache_creation_input_tokens ?? 0
          inputTokens += msg.usage.input_tokens                ?? 0
          outputTokens+= msg.usage.output_tokens               ?? 0
        }
        if (text === null) { errors++; return }   // already logged by the backend
        const parsed = parseJson(text)
        if (!parsed) { errors++; console.warn(`  ⚠ ${item.slug} [${item.locale}] — unparseable response`); return }
        await persist(item, parsed)
        if (item.isUpdate) updated++; else translated++
        const done = translated + updated
        if (done % 10 === 0) {
          const rate = (done / ((Date.now() - t0) / 1000)).toFixed(2)
          const cacheInfo = BACKEND === 'api' ? `  cacheRead=${cacheRead}` : ''
          console.log(`  +${done} (${translated} new, ${updated} retrans)  ${rate}/s${cacheInfo}  errors=${errors}`)
        }
      } catch (err) {
        errors++
        console.warn(`  ⚠ ${item.slug} [${item.locale}] — ${err instanceof Error ? err.message : String(err)}`)
      }
    }, CONCURRENCY)
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(0)
  console.log(`\nDone in ${secs}s. games=${gamesProcessed} new=${translated} retrans=${updated} empty=${emptyRows} errors=${errors}`)
  if (!DRY && BACKEND === 'api') {
    console.log(`Tokens: input=${inputTokens} output=${outputTokens} cacheRead=${cacheRead} cacheWrite=${cacheWrite}`)
    console.log(`(cacheRead should climb after the first few calls per locale — confirms the system prefix is caching.)`)
  }

  // Coverage snapshot
  const [scored] = await db.select({ n: sql<number>`count(*)` }).from(gameScores).where(isNotNull(gameScores.curascore))
  const cov = await db.select({ locale: gameTranslations.locale, n: sql<number>`count(*)` })
    .from(gameTranslations)
    .where(sql`${gameTranslations.locale} = ANY(${sqlArray(LOCALES)})`)
    .groupBy(gameTranslations.locale)
  console.log(`\nCoverage (of ${scored.n} scored):`)
  for (const c of cov) console.log(`  ${c.locale}: ${c.n}`)

  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
