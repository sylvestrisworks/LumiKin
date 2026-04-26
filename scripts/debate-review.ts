/**
 * Adversarial multi-model scoring debate.
 *
 * Opus (advocate, argues HIGH) vs Gemini Pro (critic, argues LOW).
 * Two debate rounds, then averaged final scores.
 * Targets borderline games (curascore 35–55) with metacritic >= 70.
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/debate-review.ts --limit 3
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/debate-review.ts --limit 3 --save
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// FIX: Varna tidigt om .env saknas eller GOOGLE_PROJECT_ID inte är satt
const dotenvResult = config({ path: resolve(process.cwd(), '.env') })
if (dotenvResult.error) {
  console.warn('[debate-review] Warning: Could not load .env file:', dotenvResult.error.message)
}

if (!process.env.GOOGLE_PROJECT_ID) {
  console.error('ERROR: GOOGLE_PROJECT_ID is not set. Aborting.')
  process.exit(1)
}

import { GoogleGenAI, Type, FunctionCallingConfigMode } from '@google/genai'
import { db } from '../src/lib/db'
import { games, gameScores } from '../src/lib/db/schema'
import { eq, and, gte, lte, isNotNull, desc } from 'drizzle-orm'

// ─── Config ───────────────────────────────────────────────────────────────────

const args           = process.argv.slice(2)
const LIMIT          = parseInt(args[args.indexOf('--limit') + 1] ?? '3', 10)
const SAVE           = args.includes('--save')
const RESCORE_DEBATE = args.includes('--rescore-debate')
const FORCE          = args.includes('--force')
const slugFlag       = args.indexOf('--slug')
const TARGET_SLUG    = slugFlag !== -1 ? args[slugFlag + 1] : null

const CRITIC_WEIGHT  = 0.60
const MAX_AUTO_SWING = 20

const ADVOCATE_MODEL = 'gemini-2.5-flash'
const CRITIC_MODEL   = 'gemini-2.5-flash'

const PRO_PRICE_IN    =  0.15
const PRO_PRICE_OUT   =  0.60
const FLASH_PRICE_IN  =  0.15
const FLASH_PRICE_OUT =  0.60

// ─── Clients ──────────────────────────────────────────────────────────────────

const googleAI = new GoogleGenAI({
  vertexai: true,
  project:  process.env.GOOGLE_PROJECT_ID!,
  location: process.env.GOOGLE_LOCATION ?? 'us-central1',
})

// ─── Cost tracker ─────────────────────────────────────────────────────────────

type TokenUsage = { proIn: number; proOut: number; flashIn: number; flashOut: number }
const totals: TokenUsage = { proIn: 0, proOut: 0, flashIn: 0, flashOut: 0 }

function estimateCost(u: TokenUsage): number {
  return (u.proIn    / 1_000_000 * PRO_PRICE_IN)
       + (u.proOut   / 1_000_000 * PRO_PRICE_OUT)
       + (u.flashIn  / 1_000_000 * FLASH_PRICE_IN)
       + (u.flashOut / 1_000_000 * FLASH_PRICE_OUT)
}

// ─── Rubric field lists ───────────────────────────────────────────────────────

const B1 = ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge']
const B2 = ['teamwork','communication','empathy','emotionalRegulation','ethicalReasoning','positiveSocial']
const B3 = ['handEyeCoord','fineMotor','reactionTime','physicalActivity']
const R1 = ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq']
const R2 = ['spendingCeiling','payToWin','currencyObfuscation','spendingPrompts','childTargeting','adPressure','subscriptionPressure','socialSpending']
const R3 = ['socialObligation','competitiveToxicity','strangerRisk','socialComparison','identitySelfWorth','privacyRisk']

// ─── Types ────────────────────────────────────────────────────────────────────

type Scores = {
  b1: Record<string, number>; b2: Record<string, number>; b3: Record<string, number>
  r1: Record<string, number>; r2: Record<string, number>; r3: Record<string, number>
}

type DebateRound = {
  advocateScores:    Scores
  advocateReasoning: string
  criticScores:      Scores
  criticReasoning:   string
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function gameBlock(g: { title: string; genres: string[]; platforms: string[]; description: string | null; metacriticScore: number | null; hasMicrotransactions: boolean; hasLootBoxes: boolean; hasBattlePass: boolean; hasStrangerChat: boolean }): string {
  return `Title: ${g.title}
Genres: ${g.genres.join(', ') || 'Unknown'}
Platforms: ${g.platforms.join(', ') || 'Unknown'}
Description: ${g.description ?? 'Not available'}
Metacritic: ${g.metacriticScore ?? 'N/A'}
Microtransactions: ${g.hasMicrotransactions ? 'Yes' : 'No'}  Loot boxes: ${g.hasLootBoxes ? 'Yes' : 'No'}  Battle pass: ${g.hasBattlePass ? 'Yes' : 'No'}
Stranger chat: ${g.hasStrangerChat ? 'Yes' : 'No'}`
}

function rubricsBlock(): string {
  return `## RUBRIC (0–5 per benefit field, 0–3 per risk field)
B1 Cognitive (0–5 each): ${B1.join(', ')}
B2 Social (0–5 each): ${B2.join(', ')}
B3 Motor (0–5 each): ${B3.join(', ')}
R1 Dopamine (0–3 each): ${R1.join(', ')}
R2 Monetization (0–3 each): ${R2.join(', ')}
R3 Social risk (0–3 each): ${R3.join(', ')}

CALIBRATION (anchors — match your scores to this distribution):
Zelda: BotW:  B1=42, B2=18, B3=10 | R1=2,  R2=0,  R3=2  → curascore 82  ← what a genuinely great game looks like
Minecraft:    B1=38, B2=16, B3=6  | R1=4,  R2=2,  R3=4  → curascore 75
Half-Life:    B1=28, B2=4,  B3=14 | R1=4,  R2=0,  R3=0  → curascore 74  ← strong cognitive + motor, near-zero social-emotional (no multiplayer)
Fortnite:     B1=19, B2=10, B3=13 | R1=18, R2=13, R3=11 → curascore 42
Brawl Stars:  B1=14, B2=9,  B3=11 | R1=23, R2=18, R3=12 → curascore 30

KEY RULES FOR B2 (social-emotional):
- Single-player games with NO co-op/multiplayer: teamwork=0, communication=0, positiveSocial ≤ 1
- B2 scores above 10 total require active social mechanics (co-op, voice chat, team play)
- Narrative empathy alone does not justify high B2 — it must require social interaction`
}

function scoresBlock(s: Scores): string {
  const fmt = (label: string, fields: string[], scores: Record<string, number>) =>
    `${label}: ${fields.map(f => `${f}=${scores[f] ?? '?'}`).join(', ')}`
  return [
    fmt('B1', B1, s.b1), fmt('B2', B2, s.b2), fmt('B3', B3, s.b3),
    fmt('R1', R1, s.r1), fmt('R2', R2, s.r2), fmt('R3', R3, s.r3),
  ].join('\n')
}

function advocatePrompt(gameInfo: string, round: number, criticScores?: Scores, criticReasoning?: string): string {
  const role = `You are the ADVOCATE in a LumiKin scoring debate. Your job is to argue for the HIGHEST DEFENSIBLE scores.
- Push benefit scores UP whenever the evidence supports it
- Push risk scores DOWN when risks are manageable or overstated
- Base arguments on child development research
- Be bold but don't fabricate — only argue what the game actually supports`

  if (round === 1) {
    return `${role}

${rubricsBlock()}

## GAME
${gameInfo}

Produce your OPENING position: score every field, then write 3–5 sentences defending your highest-scoring choices.
Call submit_scores with your scores and reasoning.`
  }

  return `${role}

${rubricsBlock()}

## GAME
${gameInfo}

## CRITIC'S POSITION (arguing LOW)
Scores:
${scoresBlock(criticScores!)}

Critic's reasoning: "${criticReasoning}"

## YOUR TASK
The critic has pushed scores down. Push back. Revise your scores where you agree but defend or increase where you disagree.
Call submit_scores with your revised scores and a rebuttal (3–5 sentences).`
}

function criticPrompt(gameInfo: string, round: number, advocateScores?: Scores, advocateReasoning?: string): string {
  const role = `You are the CRITIC in a LumiKin scoring debate. Your job is to argue for the LOWEST DEFENSIBLE scores.
- Push benefit scores DOWN unless the evidence is strong and specific
- Push risk scores UP whenever a design pattern is present
- Be rigorous: "could benefit" is not the same as "actively develops"
- Base arguments on what the game actually does, not its potential
- CRITICAL: Single-player games with no multiplayer/co-op get teamwork=0, communication=0, positiveSocial≤1. "Narrative empathy" does NOT justify B2 scores — social mechanics must be interactive
- High metacritic score does NOT mean high developmental scores — a masterpiece can still be low-benefit for children
- Scores above 80 curascore should be rare and only for games with strong benefits across multiple domains`

  if (round === 1) {
    return `${role}

${rubricsBlock()}

## GAME
${gameInfo}

Produce your OPENING position: score every field, then write 3–5 sentences defending your lowest-scoring choices.
Call submit_scores with your scores and reasoning.`
  }

  return `${role}

${rubricsBlock()}

## GAME
${gameInfo}

## ADVOCATE'S POSITION (arguing HIGH)
Scores:
${scoresBlock(advocateScores!)}

Advocate's reasoning: "${advocateReasoning}"

## YOUR TASK
The advocate has pushed scores up. Challenge the weakest claims. Revise your scores where they've made a fair point, but hold firm where the evidence is thin.
Call submit_scores with your revised scores and a rebuttal (3–5 sentences).`
}

// ─── Tool schema ──────────────────────────────────────────────────────────────

function scoreGroupSchema(fields: string[], max: number) {
  return {
    type: 'object' as const,
    required: fields,
    additionalProperties: false as const,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer' as const, minimum: 0, maximum: max }])),
  }
}

const TOOL_SCHEMA = {
  type: 'object' as const,
  required: ['b1','b2','b3','r1','r2','r3','reasoning'] as string[],
  additionalProperties: false as const,
  properties: {
    b1: scoreGroupSchema(B1, 5),
    b2: scoreGroupSchema(B2, 5),
    b3: scoreGroupSchema(B3, 5),
    r1: scoreGroupSchema(R1, 3),
    r2: scoreGroupSchema(R2, 3),
    r3: scoreGroupSchema(R3, 3),
    reasoning: { type: 'string' as const, description: 'Your 3–5 sentence argument for these scores' },
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema
  const TYPE_MAP: Record<string, Type> = { object: Type.OBJECT, string: Type.STRING, integer: Type.INTEGER, number: Type.NUMBER, boolean: Type.BOOLEAN }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'additionalProperties') continue
    if (k === 'type' && typeof v === 'string') out[k] = TYPE_MAP[v] ?? v
    else if (k === 'properties' && typeof v === 'object' && v !== null)
      out[k] = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, toGeminiSchema(pv)]))
    else if (typeof v === 'object' && v !== null && !Array.isArray(v)) out[k] = toGeminiSchema(v)
    else out[k] = v
  }
  return out
}

const GEMINI_FUNCTION = { name: 'submit_scores', description: 'Submit your scores and reasoning for this debate round.', parameters: toGeminiSchema(TOOL_SCHEMA) }

// ─── Model callers ────────────────────────────────────────────────────────────

async function callGemini(model: string, prompt: string, isPro: boolean): Promise<{ scores: Scores; reasoning: string }> {
  const MAX_RETRIES = 5
  let attempt = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await googleAI.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          tools: [{ functionDeclarations: [GEMINI_FUNCTION] }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ['submit_scores'] } },
        },
      })
      const meta = res.usageMetadata
      if (meta) {
        if (isPro) { totals.proIn += meta.promptTokenCount ?? 0; totals.proOut += meta.candidatesTokenCount ?? 0 }
        else       { totals.flashIn += meta.promptTokenCount ?? 0; totals.flashOut += meta.candidatesTokenCount ?? 0 }
      }
      const fc = res.candidates?.[0]?.content?.parts?.[0]?.functionCall
      if (!fc?.args) throw new Error(`${model} did not return a function call`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = fc.args as any
      return { scores: { b1: a.b1, b2: a.b2, b3: a.b3, r1: a.r1, r2: a.r2, r3: a.r3 }, reasoning: a.reasoning }
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 429 && attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 10_000
        console.log(`    [429 rate limit — waiting ${delay / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}]`)
        await new Promise(r => setTimeout(r, delay))
        attempt++
        continue
      }
      throw err
    }
  }
}

const callAdvocate = (prompt: string) => callGemini(ADVOCATE_MODEL, prompt, true)
const callCritic   = (prompt: string) => callGemini(CRITIC_MODEL,   prompt, false)

// ─── Score math ───────────────────────────────────────────────────────────────

function weightedScores(advocate: Scores, critic: Scores): Scores {
  const w = (fa: Record<string, number>, fb: Record<string, number>) =>
    Object.fromEntries(Object.keys(fa).map(k => [
      k,
      Math.round(fa[k] * (1 - CRITIC_WEIGHT) + fb[k] * CRITIC_WEIGHT),
    ]))
  return {
    b1: w(advocate.b1, critic.b1), b2: w(advocate.b2, critic.b2), b3: w(advocate.b3, critic.b3),
    r1: w(advocate.r1, critic.r1), r2: w(advocate.r2, critic.r2), r3: w(advocate.r3, critic.r3),
  }
}

function sumGroup(s: Record<string, number>): number { return Object.values(s).reduce((a, b) => a + b, 0) }

function computeCurascore(s: Scores): { bds: number; ris: number; curascore: number } {
  const b1n = sumGroup(s.b1) / 50; const b2n = sumGroup(s.b2) / 30; const b3n = sumGroup(s.b3) / 20
  const r1n = sumGroup(s.r1) / 30; const r2n = sumGroup(s.r2) / 24; const r3n = sumGroup(s.r3) / 18
  const bds = b1n * 0.50 + b2n * 0.30 + b3n * 0.20
  const ris = r1n * 0.45 + r2n * 0.30 + r3n * 0.25
  const safety = 1 - ris
  const denom  = bds + safety
  const curascore = denom > 0 ? Math.round((2 * bds * safety) / denom * 100) : 0
  return { bds, ris, curascore }
}

// ─── Main debate loop ─────────────────────────────────────────────────────────

async function debateGame(game: { id: number; slug: string; title: string; genres: string[]; platforms: string[]; description: string | null; metacriticScore: number | null; hasMicrotransactions: boolean; hasLootBoxes: boolean; hasBattlePass: boolean; hasStrangerChat: boolean; currentCurascore: number }) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Game: ${game.title}  (current curascore: ${game.currentCurascore})`)
  console.log(`${'─'.repeat(60)}`)

  const gInfo = gameBlock(game)
  const rounds: DebateRound[] = []

  // ── Round 1: Opening positions ────────────────────────────────────────────
  console.log('\n  Round 1 — Opening positions…')
  console.log('    Advocate (Gemini Pro, arguing HIGH)…')
  const r1adv = await callAdvocate(advocatePrompt(gInfo, 1))
  console.log(`    → reasoning: "${r1adv.reasoning.slice(0, 120)}…"`)

  console.log('    Critic (Gemini Flash, arguing LOW)…')
  const r1crit = await callCritic(criticPrompt(gInfo, 1))
  console.log(`    → reasoning: "${r1crit.reasoning.slice(0, 120)}…"`)

  rounds.push({ advocateScores: r1adv.scores, advocateReasoning: r1adv.reasoning, criticScores: r1crit.scores, criticReasoning: r1crit.reasoning })

  // ── Round 2: Rebuttals ───────────────────────────────────────────────────
  console.log('\n  Round 2 — Rebuttals…')
  console.log('    Advocate rebuttal (Gemini Pro)…')
  const r2adv = await callAdvocate(advocatePrompt(gInfo, 2, r1crit.scores, r1crit.reasoning))
  console.log(`    → reasoning: "${r2adv.reasoning.slice(0, 120)}…"`)

  console.log('    Critic rebuttal (Gemini Flash)…')
  const r2crit = await callCritic(criticPrompt(gInfo, 2, r1adv.scores, r1adv.reasoning))
  console.log(`    → reasoning: "${r2crit.reasoning.slice(0, 120)}…"`)

  rounds.push({ advocateScores: r2adv.scores, advocateReasoning: r2adv.reasoning, criticScores: r2crit.scores, criticReasoning: r2crit.reasoning })

  // ── Final: weighted average of round 2 ──────────────────────────────────
  const finalScores = weightedScores(r2adv.scores, r2crit.scores)
  const { bds, ris, curascore } = computeCurascore(finalScores)
  const swing = curascore - game.currentCurascore
  const flagged = !FORCE && Math.abs(swing) > MAX_AUTO_SWING

  console.log(`\n  Result:  curascore ${game.currentCurascore} → ${curascore}  (BDS ${bds.toFixed(3)}, RIS ${ris.toFixed(3)})`)
  console.log(`  Advocate final curascore: ${computeCurascore(r2adv.scores).curascore}`)
  console.log(`  Critic final curascore:   ${computeCurascore(r2crit.scores).curascore}`)
  if (flagged) console.log(`  ⚠️  Swing of ${swing > 0 ? '+' : ''}${swing} exceeds ±${MAX_AUTO_SWING} — flagged for human review, skipping save`)

  const transcript = rounds.map((r, i) => `
=== Round ${i + 1} ===

ADVOCATE (arguing HIGH):
${scoresBlock(r.advocateScores)}
Reasoning: ${r.advocateReasoning}

CRITIC (arguing LOW):
${scoresBlock(r.criticScores)}
Reasoning: ${r.criticReasoning}
`).join('\n') + `\n=== Final (weighted 40% advocate / 60% critic, Round 2) ===\n${scoresBlock(finalScores)}\nCurascore: ${curascore}  BDS: ${bds.toFixed(3)}  RIS: ${ris.toFixed(3)}${flagged ? '\n⚠️ FLAGGED — swing exceeds ±' + MAX_AUTO_SWING + ', not auto-saved' : ''}`

  if (SAVE && !flagged) {
    console.log('  Saving to DB…')
    await db.update(gameScores)
      .set({
        bds, ris, curascore,
        debateTranscript: transcript,
        debateRounds: rounds.length,
        calculatedAt: new Date(),
      })
      .where(eq(gameScores.gameId, game.id))
    console.log('  Saved.')
  }

  return { curascore, prev: game.currentCurascore, transcript, flagged }
}

// ─── Fetch candidates ─────────────────────────────────────────────────────────

async function getCandidates() {
  const baseSelect = {
    id:               games.id,
    slug:             games.slug,
    title:            games.title,
    genres:           games.genres,
    platforms:        games.platforms,
    description:      games.description,
    metacriticScore:  games.metacriticScore,
    hasMicrotransactions: games.hasMicrotransactions,
    hasLootBoxes:     games.hasLootBoxes,
    hasBattlePass:    games.hasBattlePass,
    hasStrangerChat:  games.hasStrangerChat,
    currentCurascore: gameScores.curascore,
  }

  const rows = TARGET_SLUG
    ? await db.select(baseSelect).from(games)
        .innerJoin(gameScores, eq(gameScores.gameId, games.id))
        .where(and(isNotNull(gameScores.curascore), eq(games.slug, TARGET_SLUG)))
        .limit(1)
    : RESCORE_DEBATE
    ? await db.select(baseSelect).from(games)
        .innerJoin(gameScores, eq(gameScores.gameId, games.id))
        .where(and(isNotNull(gameScores.debateRounds), isNotNull(gameScores.curascore)))
        .orderBy(desc(gameScores.curascore))
        .limit(LIMIT)
    : await db.select(baseSelect).from(games)
        .innerJoin(gameScores, eq(gameScores.gameId, games.id))
        .where(and(
          isNotNull(gameScores.curascore),
          gte(gameScores.curascore, 35),
          lte(gameScores.curascore, 55),
          gte(games.metacriticScore, 70),
        ))
        .orderBy(desc(games.metacriticScore))
        .limit(LIMIT)

  return rows.map(r => ({
    ...r,
    genres:    (r.genres   as string[]) ?? [],
    platforms: (r.platforms as string[]) ?? [],
    hasMicrotransactions: r.hasMicrotransactions ?? false,
    hasLootBoxes:  r.hasLootBoxes  ?? false,
    hasBattlePass: r.hasBattlePass ?? false,
    hasStrangerChat: r.hasStrangerChat ?? false,
    currentCurascore: r.currentCurascore!,
  }))
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║   LumiKin — Adversarial Debate Scoring         ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Advocate: Gemini ${ADVOCATE_MODEL} (argues HIGH)`)
  console.log(`  Critic:   Gemini ${CRITIC_MODEL} (argues LOW)`)
  console.log(`  Limit:    ${LIMIT} games  |  Save: ${SAVE ? 'YES' : 'no (dry run)'}  |  Mode: ${RESCORE_DEBATE ? 'RESCORE DEBATE' : 'normal'}${FORCE ? '  |  FORCE (no swing cap)' : ''}`)
  if (!SAVE) console.log('\n  Tip: add --save to write results to the DB\n')

  const candidates = await getCandidates()
  if (candidates.length === 0) {
    console.log('\nNo borderline + popular games found (curascore 35–55, metacritic ≥ 70).')
    process.exit(0)
  }

  console.log(`\nFound ${candidates.length} candidate(s):`)
  candidates.forEach((g, i) => console.log(`  ${i + 1}. ${g.title} (curascore ${g.currentCurascore}, metacritic ${g.metacriticScore})`))

  const results = []
  for (const game of candidates) {
    const result = await debateGame(game)
    results.push({ title: game.title, ...result })
    await new Promise(r => setTimeout(r, 1000))
  }

  // ── Cost report ───────────────────────────────────────────────────────────
  const cost = estimateCost(totals)
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║                  Cost Report                     ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Gemini Pro   — ${totals.proIn.toLocaleString()} in / ${totals.proOut.toLocaleString()} out tokens`)
  console.log(`  Gemini Flash — ${totals.flashIn.toLocaleString()} in / ${totals.flashOut.toLocaleString()} out tokens`)
  console.log(`  Estimated cost: $${cost.toFixed(4)} for ${candidates.length} game(s)`)
  console.log(`  Per-game avg:   $${(cost / candidates.length).toFixed(4)}`)
  console.log(`  Projected (50 games): $${(cost / candidates.length * 50).toFixed(2)}`)

  console.log('\n  Score changes:')
  results.forEach(r => {
    const delta = r.curascore - r.prev
    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '='
    const flag  = r.flagged ? '  ⚠️  FLAGGED (not saved)' : ''
    console.log(`  ${r.title.padEnd(35)} ${r.prev} → ${r.curascore}  ${arrow}${Math.abs(delta)}${flag}`)
  })

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
