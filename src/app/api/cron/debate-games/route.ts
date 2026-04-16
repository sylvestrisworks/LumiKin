/**
 * GET /api/cron/debate-games
 *
 * Steg 3 i ingest-pipeline:
 *   - Hittar spel med curascore 35–55 som inte har debate-scores ännu
 *   - Kör 2-ronders adversarial debate (advocate vs critic)
 *   - Uppdaterar curascore i DB om swing ≤ 20 poäng
 *
 * Körs var 6:e timme via GitHub Actions.
 * Protection: Authorization: Bearer <CRON_SECRET>
 * Max duration: 300s (Vercel Pro)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { eq, gte, lte, isNull, isNotNull, and } from 'drizzle-orm'
export const maxDuration = 300

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_DEBATES_PER_RUN = 8
const DELAY_MS            = 300
const BUDGET_MS           = 240_000
const BEDROCK_MODEL       = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
const BEDROCK_URL         = `https://bedrock-runtime.us-east-1.amazonaws.com/model/${BEDROCK_MODEL}/invoke`
const CRITIC_WEIGHT       = 0.60
const MAX_AUTO_SWING      = 20
const DEBATE_MIN_SCORE    = 35
const DEBATE_MAX_SCORE    = 55

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Rubric field definitions ─────────────────────────────────────────────────

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

type GameRow = typeof games.$inferSelect

function scoreGroupDebate(fields: string[], max: number) {
  return {
    type: 'object' as const, required: fields,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer' as const, minimum: 0, maximum: max }])),
  }
}

// ─── Debate tool schema (Anthropic format) ────────────────────────────────────

const DEBATE_TOOL = {
  name: 'submit_scores',
  description: 'Submit your scores and reasoning for this debate round.',
  input_schema: {
    type: 'object',
    required: ['b1','b2','b3','r1','r2','r3','reasoning'],
    properties: {
      b1: scoreGroupDebate(B1_FIELDS, 5),
      b2: scoreGroupDebate(B2_FIELDS, 5),
      b3: scoreGroupDebate(B3_FIELDS, 5),
      r1: scoreGroupDebate(R1_FIELDS, 3),
      r2: scoreGroupDebate(R2_FIELDS, 3),
      r3: scoreGroupDebate(R3_FIELDS, 3),
      reasoning: { type: 'string' as const },
    },
  },
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

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

function gameBlock(g: GameRow): string {
  return `Title: ${g.title}
Genres: ${(g.genres as string[])?.join(', ') || 'Unknown'}
Platforms: ${(g.platforms as string[])?.join(', ') || 'Unknown'}
Description: ${g.description ?? 'Not available'}
Metacritic: ${g.metacriticScore ?? 'N/A'}
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
- CRITICAL: Single-player games with no co-op get teamwork=0, communication=0, positiveSocial≤1`

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
- High metacritic does NOT mean high developmental scores`

  if (round === 1) {
    return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\nProduce your OPENING position. Call submit_scores with your scores and reasoning.`
  }
  return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\n## ADVOCATE'S POSITION\nScores:\n${scoresBlock(advocateScores!)}\nAdvocate's reasoning: "${advocateReasoning}"\n\nChallenge the weakest claims. Call submit_scores with your revised scores and rebuttal.`
}

// ─── Bedrock caller ───────────────────────────────────────────────────────────

async function callBedrockDebate(
  prompt: string,
  attempt = 0
): Promise<{ scores: DebateScores; reasoning: string }> {
  try {
    const res = await fetch(BEDROCK_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AWS_BEARER_TOKEN_BEDROCK}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        tools: [DEBATE_TOOL],
        tool_choice: { type: 'tool', name: 'submit_scores' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      if ((res.status === 429 || res.status === 503) && attempt < 3) {
        await sleep(Math.pow(2, attempt) * 5000)
        return callBedrockDebate(prompt, attempt + 1)
      }
      throw new Error(`Bedrock ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const toolUse = data.content?.find((c: { type: string }) => c.type === 'tool_use')
    if (!toolUse?.input) {
      if (attempt < 3) {
        await sleep(Math.pow(2, attempt) * 5000)
        return callBedrockDebate(prompt, attempt + 1)
      }
      throw new Error('Bedrock did not return tool_use block')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = toolUse.input as any
    return {
      scores: { b1: a.b1, b2: a.b2, b3: a.b3, r1: a.r1, r2: a.r2, r3: a.r3 },
      reasoning: a.reasoning,
    }
  } catch (err: unknown) {
    const isTransient = String(err).includes('fetch failed') || String(err).includes('ECONNRESET')
    if (isTransient && attempt < 3) {
      await sleep(Math.pow(2, attempt) * 5000)
      return callBedrockDebate(prompt, attempt + 1)
    }
    throw err
  }
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

// ─── Run debate on one game ───────────────────────────────────────────────────

async function runDebate(
  game: GameRow,
  currentCurascore: number
): Promise<{ newCurascore: number; saved: boolean }> {
  const gInfo = gameBlock(game)

  // Round 1 — opening positions
  const r1adv  = await callBedrockDebate(advocatePrompt(gInfo, 1))
  await sleep(DELAY_MS)
  const r1crit = await callBedrockDebate(criticPrompt(gInfo, 1))
  await sleep(DELAY_MS)

  // Round 2 — rebuttals
  const r2adv  = await callBedrockDebate(advocatePrompt(gInfo, 2, r1crit.scores, r1crit.reasoning))
  await sleep(DELAY_MS)
  const r2crit = await callBedrockDebate(criticPrompt(gInfo, 2, r1adv.scores, r1adv.reasoning))

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
    console.log(`[debate-games] Swing ±${swing} too large for ${game.slug} — skipping save`)
    return { newCurascore: curascore, saved: false }
  }

  await db.update(gameScores).set({
    bds, ris, curascore,
    debateTranscript: transcript,
    debateRounds:     2,
  }).where(eq(gameScores.gameId, game.id))

  return { newCurascore: curascore, saved: true }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[debate-games] CRON_SECRET is not set — refusing all requests')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.AWS_BEARER_TOKEN_BEDROCK) {
    return NextResponse.json({ error: 'AWS_BEARER_TOKEN_BEDROCK not set' }, { status: 500 })
  }

  try {
    // Hämta borderline-spel utan debate-scores
    const candidates = await db
      .select({
        game:      games,
        curascore: gameScores.curascore,
      })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(and(
        isNotNull(gameScores.curascore),
        gte(gameScores.curascore, DEBATE_MIN_SCORE),
        lte(gameScores.curascore, DEBATE_MAX_SCORE),
        isNull(gameScores.debateRounds),
      ))
      .limit(MAX_DEBATES_PER_RUN)

    if (candidates.length === 0) {
      return NextResponse.json({ message: 'No debate candidates found', debated: 0 })
    }

    console.log(`[debate-games] Found ${candidates.length} debate candidates`)

    const debated:  string[] = []
    const skipped:  string[] = []
    const errors:   string[] = []
    const startedAt = Date.now()

    for (const { game, curascore } of candidates) {
      if (Date.now() - startedAt > BUDGET_MS) {
        console.log('[debate-games] Budget reached — stopping early')
        break
      }
      try {
        await sleep(DELAY_MS)
        console.log(`[debate-games] Debating: ${game.title} (curascore ${curascore})`)

        const result = await runDebate(game, curascore!)

        if (result.saved) {
          debated.push(game.slug)
          console.log(`[debate-games] ${game.title}: ${curascore} → ${result.newCurascore}`)
        } else {
          skipped.push(game.slug)
        }
      } catch (err) {
        console.error(`[debate-games] Failed for ${game.slug}:`, err)
        errors.push(game.slug)
      }
    }

    return NextResponse.json({
      debated:  debated.length,
      skipped:  skipped.length,
      errors:   errors.length,
      slugs:    debated,
    })

  } catch (err) {
    console.error('[debate-games] Fatal error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
