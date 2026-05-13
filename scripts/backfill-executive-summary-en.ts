/**
 * backfill-executive-summary-en.ts
 *
 * Synthesizes a one-sentence English executiveSummary for each scored game
 * that's missing one, using the existing scoring fields (curascore, top
 * benefits, narratives, time recommendation). Writes to gameScores.executiveSummary.
 *
 *   npx tsx scripts/backfill-executive-summary-en.ts                # all missing
 *   npx tsx scripts/backfill-executive-summary-en.ts --limit 50     # try a few
 *   npx tsx scripts/backfill-executive-summary-en.ts --dry-run      # no writes
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { sql, and, eq, isNotNull, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, reviews } from '@/lib/db/schema'
import { callGeminiText } from '@/lib/vertex-ai'

const args     = process.argv.slice(2)
const dryRun   = args.includes('--dry-run')
const verbose  = args.includes('--verbose')
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
             ?? (args.indexOf('--limit') >= 0 ? args[args.indexOf('--limit') + 1] : undefined)
const overallLimit = limitArg ? parseInt(limitArg, 10) : Number.POSITIVE_INFINITY

const BATCH_SIZE  = 8
const CONCURRENCY = 4

type TopBenefit = { skill: string; score: number; maxScore: number }

type GameRow = {
  gameId:            number
  title:             string
  genres:            string[]
  curascore:         number | null
  topBenefits:       TopBenefit[]
  timeMinutes:       number | null
  recommendedMinAge: number | null
  benefitsExcerpt:   string | null
  risksExcerpt:      string | null
}

function firstSentence(text: string | null | undefined): string | null {
  if (!text) return null
  const m = text.match(/^[^.!?]{20,220}[.!?]/)
  return (m?.[0] ?? text.slice(0, 200)).trim()
}

async function findMissing(): Promise<GameRow[]> {
  const rows = await db
    .select({
      gameId:            gameScores.gameId,
      title:             games.title,
      genres:            games.genres,
      curascore:         gameScores.curascore,
      topBenefits:       gameScores.topBenefits,
      timeMinutes:       gameScores.timeRecommendationMinutes,
      recommendedMinAge: gameScores.recommendedMinAge,
      benefitsNarrative: reviews.benefitsNarrative,
      risksNarrative:    reviews.risksNarrative,
    })
    .from(gameScores)
    .innerJoin(games, eq(games.id, gameScores.gameId))
    .leftJoin(reviews, eq(reviews.id, gameScores.reviewId))
    .where(and(
      isNotNull(gameScores.curascore),
      or(
        isNull(gameScores.executiveSummary),
        sql`length(${gameScores.executiveSummary}) <= 10`,
      ),
    ))

  return rows.map(r => ({
    gameId:            r.gameId,
    title:             r.title,
    genres:            Array.isArray(r.genres) ? (r.genres as string[]).slice(0, 3) : [],
    curascore:         r.curascore,
    topBenefits:       Array.isArray(r.topBenefits) ? (r.topBenefits as TopBenefit[]).slice(0, 3) : [],
    timeMinutes:       r.timeMinutes,
    recommendedMinAge: r.recommendedMinAge,
    benefitsExcerpt:   firstSentence(r.benefitsNarrative),
    risksExcerpt:      firstSentence(r.risksNarrative),
  }))
}

function buildPrompt(batch: GameRow[]): string {
  const payload = batch.map(g => ({
    id:        g.gameId,
    title:     g.title,
    genres:    g.genres,
    lumiScore: g.curascore,           // 0–100, harmonic mean of benefits + safety
    benefits:  g.topBenefits.map(b => b.skill),
    timeMin:   g.timeMinutes,         // recommended daily session length
    minAge:    g.recommendedMinAge,
    benefitsExcerpt: g.benefitsExcerpt,
    risksExcerpt:    g.risksExcerpt,
  }))

  return `You are a copywriter for "LumiKin", a children's game rating site for parents. For each game below, write ONE plain-language sentence (12-25 words) that summarizes the game for a parent skimming the rating page.

Rules:
- Lead with what the game is and what it builds (benefits), not what's wrong with it. LumiKin is gaming-positive.
- Mention the headline benefit naturally — use the "benefits" array as guidance, but write in plain English (e.g. "problem_solving" → "problem solving").
- If risks are noteworthy (low lumiScore, mature content), note them briefly at the end. Otherwise skip.
- Do NOT translate the game title. Do NOT use marketing fluff ("amazing", "incredible"). Be informed and calm.
- One sentence. No semicolons stacking clauses. No emoji.
- Output ONLY a JSON object keyed by integer id: { "<id>": "<sentence>", ... }
- No markdown, no commentary, no code fences.

Examples of good output:
  "Minecraft is a sandbox builder where kids develop spatial reasoning and creativity through open-ended construction, with light social risk on public servers."
  "Convoy is a tactical roguelike that builds strategic thinking and decision-making, suited to older kids comfortable with combat themes."

Input (JSON array):
${JSON.stringify(payload)}

Output: { "<id>": "<one-sentence summary>", ... }`
}

function parseJson(raw: string): Record<string, string> {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON object in response: ${raw.slice(0, 200)}`)
  return JSON.parse(match[0]) as Record<string, string>
}

async function generateBatch(batch: GameRow[]): Promise<Array<{ gameId: number; summary: string }>> {
  const text   = await callGeminiText(buildPrompt(batch))
  const parsed = parseJson(text)
  const out: Array<{ gameId: number; summary: string }> = []
  for (const g of batch) {
    const s = parsed[String(g.gameId)]
    if (typeof s === 'string' && s.trim().length > 15) {
      out.push({ gameId: g.gameId, summary: s.trim() })
      if (verbose) console.log(`    [${g.gameId}] ${g.title}: ${s.trim()}`)
    } else {
      console.warn(`  ⚠ no summary for gameId=${g.gameId} (${g.title})`)
    }
  }
  return out
}

async function writeBatch(results: Array<{ gameId: number; summary: string }>): Promise<void> {
  if (dryRun || results.length === 0) return
  for (const { gameId, summary } of results) {
    await db
      .update(gameScores)
      .set({ executiveSummary: summary })
      .where(eq(gameScores.gameId, gameId))
  }
}

async function main(): Promise<void> {
  const missing = await findMissing()
  const work    = Number.isFinite(overallLimit) ? missing.slice(0, overallLimit) : missing
  console.log(`Backfill English executiveSummary`)
  console.log(`  missing: ${missing.length} (processing ${work.length}${dryRun ? ', dry-run' : ''})`)
  console.log(`  batch size: ${BATCH_SIZE}, concurrency: ${CONCURRENCY}`)

  if (work.length === 0) { console.log('Nothing to do.'); process.exit(0) }

  const batches: GameRow[][] = []
  for (let i = 0; i < work.length; i += BATCH_SIZE) {
    batches.push(work.slice(i, i + BATCH_SIZE))
  }

  let done   = 0
  let failed = 0
  const t0 = Date.now()
  let cursor = 0

  async function worker(workerId: number): Promise<void> {
    while (true) {
      const idx = cursor++
      if (idx >= batches.length) return
      const batch = batches[idx]!
      try {
        const results = await generateBatch(batch)
        await writeBatch(results)
        done += results.length
        failed += batch.length - results.length
        const pct = Math.round(((idx + 1) / batches.length) * 100)
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
        console.log(`  [w${workerId}] batch ${idx + 1}/${batches.length} (${pct}%) — done=${done} failed=${failed} t=${elapsed}s`)
      } catch (e) {
        failed += batch.length
        console.error(`  [w${workerId}] batch ${idx + 1} ERROR:`, e instanceof Error ? e.message : String(e))
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)))
  console.log(`\nDone. done=${done} failed=${failed} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
