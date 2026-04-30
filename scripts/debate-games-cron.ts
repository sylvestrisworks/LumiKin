/**
 * Adversarial debate scorer — runs in GitHub Actions (no Vercel time limit).
 *
 * Candidate selection: games where |curascore - metacriticScore| >= threshold.
 * These are the games where our assessment diverges most from critic consensus —
 * exactly where a second adversarial opinion adds the most value for parents.
 *
 * Uses Gemini 2.5 Pro (thinking always on) for quality reasoning.
 *
 * Run locally:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/debate-games-cron.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { eq, sql, isNull, isNotNull, and, gte } from 'drizzle-orm'
import { callGeminiTool, GEMINI_PRO, type GeminiTool } from '@/lib/vertex-ai'
import { logCronRun } from '@/lib/cron-logger'
import { CURRENT_METHODOLOGY_VERSION } from '@/lib/methodology'

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_DEBATES_PER_RUN        = 8    // ~2 min/game × 8 = ~16 min per run
const METACRITIC_DIVERGENCE_MIN  = 25   // debate when |curascore - metacritic| >= this
const MIN_METACRITIC_SCORE       = 50   // skip games with no meaningful critical reception
const DELAY_MS                   = 500
const CRITIC_WEIGHT              = 0.60
const MAX_AUTO_SWING             = 20

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Rubric fields ────────────────────────────────────────────────────────────

const B1_FIELDS = ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge']
const B2_FIELDS = ['teamwork','communication','empathy','emotionalRegulation','ethicalReasoning','positiveSocial']
const B3_FIELDS = ['handEyeCoord','fineMotor','reactionTime','physicalActivity']
const R1_FIELDS = ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq']
const R2_FIELDS = ['spendingCeiling','payToWin','currencyObfuscation','spendingPrompts','childTargeting','adPressure','subscriptionPressure','socialSpending']
const R3_FIELDS = ['socialObligation','competitiveToxicity','strangerRisk','socialComparison','identitySelfWorth','privacyRisk']

// ─── Types ────────────────────────────────────────────────────────────────────

type DebateScores = {
  b1: Record<string, number>; b2: Record<string, number>; b3: Record<string, number>
  r1: Record<string, number>; r2: Record<string, number>; r3: Record<string, number>
}
type DebateResult = DebateScores & { reasoning: string }
type GameRow = typeof games.$inferSelect

// ─── Tool schema ──────────────────────────────────────────────────────────────

function scoreGroup(fields: string[], max: number) {
  return {
    type: 'object' as const, required: fields,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer' as const, minimum: 0, maximum: max }])),
  }
}

const DEBATE_TOOL: GeminiTool = {
  name: 'submit_scores',
  description: 'Submit your scores and reasoning for this debate round.',
  input_schema: {
    type: 'object',
    required: ['b1','b2','b3','r1','r2','r3','reasoning'],
    properties: {
      b1: scoreGroup(B1_FIELDS, 5), b2: scoreGroup(B2_FIELDS, 5), b3: scoreGroup(B3_FIELDS, 5),
      r1: scoreGroup(R1_FIELDS, 3), r2: scoreGroup(R2_FIELDS, 3), r3: scoreGroup(R3_FIELDS, 3),
      reasoning: { type: 'string' as const },
    },
  },
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function rubricsBlock(): string {
  return `## RUBRIC (0–5 per benefit field, 0–3 per risk field)
B1 Cognitive (0–5 each): ${B1_FIELDS.join(', ')}
B2 Social (0–5 each): ${B2_FIELDS.join(', ')}
B3 Motor (0–5 each): ${B3_FIELDS.join(', ')}
R1 Dopamine (0–3 each): ${R1_FIELDS.join(', ')}
R2 Monetization (0–3 each): ${R2_FIELDS.join(', ')}
R3 Social risk (0–3 each): ${R3_FIELDS.join(', ')}

CALIBRATION:
Zelda BotW:  B1=42, B2=18, B3=10 | R1=2,  R2=0,  R3=2  → curascore 82
Minecraft:   B1=38, B2=16, B3=6  | R1=4,  R2=2,  R3=4  → curascore 75
Fortnite:    B1=19, B2=10, B3=13 | R1=18, R2=13, R3=11 → curascore 42
Brawl Stars: B1=14, B2=9,  B3=11 | R1=23, R2=18, R3=12 → curascore 30`
}

function gameBlock(g: GameRow, currentCurascore: number, metacritic: number): string {
  const gap = currentCurascore - metacritic
  const gapNote = gap > 0
    ? `NOTE: LumiKin rates this ${gap} points HIGHER than critics. Debate whether benefits justify this.`
    : `NOTE: LumiKin rates this ${Math.abs(gap)} points LOWER than critics. Debate whether risks justify this.`
  return `Title: ${g.title}
Genres: ${(g.genres as string[])?.join(', ') || 'Unknown'}
Platforms: ${(g.platforms as string[])?.join(', ') || 'Unknown'}
Description: ${g.description ?? 'Not available'}
Metacritic: ${metacritic}   LumiKin curascore: ${currentCurascore}
${gapNote}
Microtransactions: ${g.hasMicrotransactions ? 'Yes' : 'No'}  Loot boxes: ${g.hasLootBoxes ? 'Yes' : 'No'}  Battle pass: ${g.hasBattlePass ? 'Yes' : 'No'}
Stranger chat: ${g.hasStrangerChat ? 'Yes' : 'No'}`
}

function scoresBlock(s: DebateScores): string {
  const fmt = (label: string, fields: string[], scores: Record<string, number>) =>
    `${label}: ${fields.map(f => `${f}=${scores[f] ?? '?'}`).join(', ')}`
  return [
    fmt('B1', B1_FIELDS, s.b1), fmt('B2', B2_FIELDS, s.b2), fmt('B3', B3_FIELDS, s.b3),
    fmt('R1', R1_FIELDS, s.r1), fmt('R2', R2_FIELDS, s.r2), fmt('R3', R3_FIELDS, s.r3),
  ].join('\n')
}

function advocatePrompt(gameInfo: string, round: number, criticScores?: DebateScores, criticReasoning?: string): string {
  const role = `You are the ADVOCATE in a LumiKin scoring debate. Argue for the HIGHEST DEFENSIBLE scores.
- Push benefit scores UP whenever evidence supports it
- Push risk scores DOWN when risks are manageable
- Base arguments on child development research
- CRITICAL: Single-player games with no co-op get teamwork=0, communication=0, positiveSocial≤1
- CRITICAL: If a game has an optional online/multiplayer mode, score it on its PRIMARY/CORE experience. Do NOT inflate risks for a separate online component parents can simply not use.`
  if (round === 1) {
    return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\nProduce your OPENING position. Call submit_scores with your scores and reasoning.`
  }
  return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\n## CRITIC'S POSITION\nScores:\n${scoresBlock(criticScores!)}\nCritic's reasoning: "${criticReasoning}"\n\nPush back. Call submit_scores with your revised scores and rebuttal.`
}

function criticPrompt(gameInfo: string, round: number, advocateScores?: DebateScores, advocateReasoning?: string): string {
  const role = `You are the CRITIC in a LumiKin scoring debate. Argue for the LOWEST DEFENSIBLE scores.
- Push benefit scores DOWN unless evidence is strong
- Push risk scores UP whenever a design pattern is present
- Single-player games with no multiplayer: teamwork=0, communication=0, positiveSocial≤1
- High metacritic does NOT mean high developmental scores
- If a game has an optional/bundled online mode, score R1/R2/R3 for the PRIMARY experience. Do not use a bundled online component to max out social/monetization risks on an otherwise offline premium game.`
  if (round === 1) {
    return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\nProduce your OPENING position. Call submit_scores with your scores and reasoning.`
  }
  return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\n## ADVOCATE'S POSITION\nScores:\n${scoresBlock(advocateScores!)}\nAdvocate's reasoning: "${advocateReasoning}"\n\nChallenge the weakest claims. Call submit_scores with your revised scores and rebuttal.`
}

// ─── Debate math ──────────────────────────────────────────────────────────────

function weightedDebateScores(advocate: DebateScores, critic: DebateScores): DebateScores {
  const w = (fa: Record<string, number>, fb: Record<string, number>) =>
    Object.fromEntries(
      Object.keys(fa).map(k => [k, Math.round(fa[k] * (1 - CRITIC_WEIGHT) + fb[k] * CRITIC_WEIGHT)])
    )
  return {
    b1: w(advocate.b1, critic.b1), b2: w(advocate.b2, critic.b2), b3: w(advocate.b3, critic.b3),
    r1: w(advocate.r1, critic.r1), r2: w(advocate.r2, critic.r2), r3: w(advocate.r3, critic.r3),
  }
}

function computeDebateCurascore(s: DebateScores): { bds: number; ris: number; curascore: number } {
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
  const bds = sum(s.b1) / 50 * 0.50 + sum(s.b2) / 30 * 0.30 + sum(s.b3) / 20 * 0.20
  const ris = sum(s.r1) / 30 * 0.45 + sum(s.r2) / 24 * 0.30 + sum(s.r3) / 18 * 0.25
  const safety = 1 - ris
  const denom  = bds + safety
  const curascore = denom > 0 ? Math.round((2 * bds * safety) / denom * 100) : 0
  return { bds, ris, curascore }
}

// ─── Gemini caller ────────────────────────────────────────────────────────────

async function callDebate(prompt: string): Promise<{ scores: DebateScores; reasoning: string }> {
  const result = await callGeminiTool<DebateResult>(prompt, DEBATE_TOOL, GEMINI_PRO, 0, -1)
  return {
    scores:    { b1: result.b1, b2: result.b2, b3: result.b3, r1: result.r1, r2: result.r2, r3: result.r3 },
    reasoning: result.reasoning,
  }
}

// ─── Run one debate ───────────────────────────────────────────────────────────

async function runDebate(
  game: GameRow,
  currentCurascore: number,
  metacriticScore: number,
): Promise<{ newCurascore: number; saved: boolean }> {
  const gInfo = gameBlock(game, currentCurascore, metacriticScore)

  const r1adv  = await callDebate(advocatePrompt(gInfo, 1))
  await sleep(DELAY_MS)
  const r1crit = await callDebate(criticPrompt(gInfo, 1))
  await sleep(DELAY_MS)
  const r2adv  = await callDebate(advocatePrompt(gInfo, 2, r1crit.scores, r1crit.reasoning))
  await sleep(DELAY_MS)
  const r2crit = await callDebate(criticPrompt(gInfo, 2, r1adv.scores, r1adv.reasoning))

  const finalScores = weightedDebateScores(r2adv.scores, r2crit.scores)
  const { bds, ris, curascore } = computeDebateCurascore(finalScores)
  const swing = curascore - currentCurascore

  const transcript = [
    `=== Round 1 ===`,
    `ADVOCATE:\n${scoresBlock(r1adv.scores)}\nReasoning: ${r1adv.reasoning}`,
    `CRITIC:\n${scoresBlock(r1crit.scores)}\nReasoning: ${r1crit.reasoning}`,
    `=== Round 2 ===`,
    `ADVOCATE:\n${scoresBlock(r2adv.scores)}\nReasoning: ${r2adv.reasoning}`,
    `CRITIC:\n${scoresBlock(r2crit.scores)}\nReasoning: ${r2crit.reasoning}`,
    `=== Final (40% advocate / 60% critic) ===`,
    `${scoresBlock(finalScores)}`,
    `Curascore: ${curascore}  BDS: ${bds.toFixed(3)}  RIS: ${ris.toFixed(3)}`,
  ].join('\n\n')

  if (Math.abs(swing) > MAX_AUTO_SWING) {
    console.log(`  swing ±${swing} too large — skipping save`)
    return { newCurascore: curascore, saved: false }
  }

  await db.update(gameScores).set({
    bds, ris, curascore,
    debateTranscript:   transcript,
    debateRounds:       2,
    scoringMethod:      'full_rubric' as const,
    methodologyVersion: CURRENT_METHODOLOGY_VERSION,
    calculatedAt:       new Date(),
  }).where(eq(gameScores.gameId, game.id))

  return { newCurascore: curascore, saved: true }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const runStartedAt = new Date()

async function main() {
  if (!process.env.DATABASE_URL)          { console.error('DATABASE_URL not set');          process.exit(1) }
  if (!process.env.GOOGLE_CREDENTIALS_JSON) {
    console.error('GOOGLE_CREDENTIALS_JSON not set')
    await logCronRun('debate-games', runStartedAt, {
      itemsProcessed: 0, errors: 1, meta: { error: 'GOOGLE_CREDENTIALS_JSON not set' },
    }).catch(() => {})
    process.exit(1)
  }

  // Fetch candidates: games where our score diverges from Metacritic by >= threshold
  // Order by divergence descending — most controversial first
  const candidates = await db
    .select({
      game:            games,
      curascore:       gameScores.curascore,
      metacriticScore: games.metacriticScore,
      divergence:      sql<number>`ABS(${gameScores.curascore} - ${games.metacriticScore})`,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      isNotNull(gameScores.curascore),
      isNotNull(games.metacriticScore),
      gte(games.metacriticScore, MIN_METACRITIC_SCORE),
      isNull(gameScores.debateRounds),
      sql`ABS(${gameScores.curascore} - ${games.metacriticScore}) >= ${METACRITIC_DIVERGENCE_MIN}`,
    ))
    .orderBy(sql`ABS(${gameScores.curascore} - ${games.metacriticScore}) DESC`)
    .limit(MAX_DEBATES_PER_RUN)

  console.log(`Found ${candidates.length} debate candidates (divergence ≥ ${METACRITIC_DIVERGENCE_MIN})`)
  for (const c of candidates) {
    console.log(`  ${c.game.title}: curascore=${c.curascore} metacritic=${c.metacriticScore} gap=${c.divergence > 0 ? '+' : ''}${c.curascore! - c.metacriticScore!}`)
  }

  if (candidates.length === 0) {
    await logCronRun('debate-games', runStartedAt, { itemsProcessed: 0, errors: 0 })
    process.exit(0)
  }

  const debated: string[] = []
  const skipped: string[] = []
  const errors:  string[] = []

  for (const { game, curascore, metacriticScore } of candidates) {
    await sleep(DELAY_MS)
    console.log(`\nDebating: ${game.title} (curascore ${curascore}, metacritic ${metacriticScore})`)
    try {
      const result = await runDebate(game, curascore!, metacriticScore!)
      if (result.saved) {
        debated.push(game.slug)
        console.log(`  ✓ ${game.title}: ${curascore} → ${result.newCurascore}`)
      } else {
        skipped.push(game.slug)
        console.log(`  ~ ${game.title}: swing too large, skipped`)
      }
    } catch (err) {
      console.error(`  ✗ ${game.slug}:`, err)
      errors.push(game.slug)
    }
  }

  console.log(`\nDone — debated: ${debated.length}, skipped: ${skipped.length}, errors: ${errors.length}`)

  await logCronRun('debate-games', runStartedAt, {
    itemsProcessed: debated.length,
    itemsSkipped:   skipped.length,
    errors:         errors.length,
    meta:           errors.length > 0 ? { failed: errors } : undefined,
  })

  process.exit(errors.length > 0 && debated.length === 0 ? 1 : 0)
}

main().catch(async e => {
  console.error('Fatal:', e)
  await logCronRun('debate-games', runStartedAt, {
    itemsProcessed: 0, errors: 1, meta: { error: String(e) },
  }).catch(() => {})
  process.exit(1)
})
