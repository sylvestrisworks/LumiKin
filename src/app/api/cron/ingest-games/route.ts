/**
 * GET /api/cron/ingest-games
 *
 * Fullständig pipeline per körning:
 *   1. Hämtar upp till 200 nya spel från RAWG (genre-cursor)
 *   2. Laddar upp cover-bild till Vercel Blob
 *   3. Kör AI-bedömning (Gemini) på varje nytt spel
 *   4. Kör debate-run på spel med curascore 35–55
 *   5. Sparar allt till DB
 *
 * Körs varannan timme via GitHub Actions.
 * Protection: Authorization: Bearer <CRON_SECRET>
 * Max duration: 300s (Vercel Pro)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, gameScores, reviews, ingestCursor } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { rawgGetByGenre, rawgGetDetail, RawgError } from '@/lib/rawg/client'
import { mapDetailToInsert } from '@/lib/rawg/mapper'
import { calculateGameScores } from '@/lib/scoring/engine'
import { GoogleGenAI, FunctionCallingConfigMode, Type } from '@google/genai'

export const maxDuration = 300

// ─── Config ───────────────────────────────────────────────────────────────────

const GENRES = [
  'action', 'adventure', 'puzzle', 'role-playing-games-rpg', 'platformer',
  'strategy', 'sports', 'simulation', 'shooter', 'racing', 'family',
  'casual', 'indie', 'fighting', 'educational', 'arcade', 'card',
]

const SWEEP_ORDERINGS: Record<number, string> = {
  1: '-metacritic',
  2: '-added',
  3: '-released',
}

const MAX_GAMES_PER_RUN   = 200
const PAGE_SIZE           = 40
const MAX_PAGES_PER_GENRE = 25
const DELAY_MS            = 300

// Debate config
const CRITIC_WEIGHT      = 0.60
const MAX_AUTO_SWING     = 20
const DEBATE_MIN_SCORE   = 35
const DEBATE_MAX_SCORE   = 55

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Google AI client ─────────────────────────────────────────────────────────

function getGoogleAI() {
  return new GoogleGenAI({
    vertexai: true,
    project:  process.env.GOOGLE_PROJECT_ID!,
    location: process.env.GOOGLE_LOCATION ?? 'us-central1',
  })
}

// ─── Rubric field definitions ─────────────────────────────────────────────────

const B1_FIELDS = ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge']
const B2_FIELDS = ['teamwork','communication','empathy','emotionalRegulation','ethicalReasoning','positiveSocial']
const B3_FIELDS = ['handEyeCoord','fineMotor','reactionTime','physicalActivity']
const R1_FIELDS = ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq']
const R2_FIELDS = ['spendingCeiling','payToWin','currencyObfuscation','spendingPrompts','childTargeting','adPressure','subscriptionPressure','socialSpending']
const R3_FIELDS = ['socialObligation','competitiveToxicity','strangerRisk','socialComparison','identitySelfWorth','privacyRisk']
const R4_FIELDS = ['violenceLevel','sexualContent','language','substanceRef','fearHorror']
const REP_FIELDS = ['repGenderBalance','repEthnicDiversity']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema
  const TYPE_MAP: Record<string, Type> = {
    object: Type.OBJECT, string: Type.STRING, integer: Type.INTEGER,
    number: Type.NUMBER, boolean: Type.BOOLEAN, array: Type.ARRAY,
  }
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

function scoreGroup(fields: string[], max: number, desc: string) {
  return {
    type: 'object' as const, description: desc, required: fields,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer' as const, minimum: 0, maximum: max }])),
    additionalProperties: false as const,
  }
}

// ─── Review tool schema ───────────────────────────────────────────────────────

const REVIEW_FUNCTION = {
  name: 'submit_game_review',
  description: 'Submit a completed PlaySmart rubric review for a game.',
  parameters: toGeminiSchema({
    type: 'object',
    required: ['b1_cognitive','b2_social','b3_motor','r1_dopamine','r2_monetization','r3_social','r4_content','representation','propaganda','bechdel','practical','narratives'],
    additionalProperties: false,
    properties: {
      b1_cognitive:    scoreGroup(B1_FIELDS, 5, 'B1 cognitive scores, each 0–5'),
      b2_social:       scoreGroup(B2_FIELDS, 5, 'B2 social-emotional scores, each 0–5'),
      b3_motor:        scoreGroup(B3_FIELDS, 5, 'B3 motor scores, each 0–5'),
      r1_dopamine:     scoreGroup(R1_FIELDS, 3, 'R1 dopamine manipulation scores, each 0–3'),
      r2_monetization: scoreGroup(R2_FIELDS, 3, 'R2 monetization pressure scores, each 0–3'),
      r3_social:       scoreGroup(R3_FIELDS, 3, 'R3 social/emotional risk scores, each 0–3'),
      r4_content:      scoreGroup(R4_FIELDS, 3, 'R4 content risk scores, each 0–3'),
      representation:  scoreGroup(REP_FIELDS, 3, 'REP representation scores, each 0–3'),
      propaganda: {
        type: 'object', required: ['propagandaLevel','propagandaNotes'], additionalProperties: false,
        properties: {
          propagandaLevel: { type: 'integer', minimum: 0, maximum: 3 },
          propagandaNotes: { type: 'string' },
        },
      },
      bechdel: {
        type: 'object', required: ['result','notes'], additionalProperties: false,
        properties: {
          result: { type: 'string', enum: ['pass','fail','na'] },
          notes:  { type: 'string' },
        },
      },
      practical: {
        type: 'object',
        required: ['estimatedMonthlyCostLow','estimatedMonthlyCostHigh','minSessionMinutes','hasNaturalStoppingPoints','penalizesBreaks','stoppingPointsDescription'],
        additionalProperties: false,
        properties: {
          estimatedMonthlyCostLow:   { type: 'number',  minimum: 0 },
          estimatedMonthlyCostHigh:  { type: 'number',  minimum: 0 },
          minSessionMinutes:         { type: 'integer', minimum: 1 },
          hasNaturalStoppingPoints:  { type: 'boolean' },
          penalizesBreaks:           { type: 'boolean' },
          stoppingPointsDescription: { type: 'string'  },
        },
      },
      narratives: {
        type: 'object',
        required: ['benefitsNarrative','risksNarrative','parentTip','parentTipBenefits'],
        additionalProperties: false,
        properties: {
          benefitsNarrative: { type: 'string' },
          risksNarrative:    { type: 'string' },
          parentTip:         { type: 'string' },
          parentTipBenefits: { type: 'string' },
        },
      },
    },
  }),
}

// ─── Debate tool schema ───────────────────────────────────────────────────────

function scoreGroupDebate(fields: string[], max: number) {
  return {
    type: 'object' as const, required: fields, additionalProperties: false as const,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer' as const, minimum: 0, maximum: max }])),
  }
}

const DEBATE_FUNCTION = {
  name: 'submit_scores',
  description: 'Submit your scores and reasoning for this debate round.',
  parameters: toGeminiSchema({
    type: 'object',
    required: ['b1','b2','b3','r1','r2','r3','reasoning'],
    additionalProperties: false,
    properties: {
      b1: scoreGroupDebate(B1_FIELDS, 5),
      b2: scoreGroupDebate(B2_FIELDS, 5),
      b3: scoreGroupDebate(B3_FIELDS, 5),
      r1: scoreGroupDebate(R1_FIELDS, 3),
      r2: scoreGroupDebate(R2_FIELDS, 3),
      r3: scoreGroupDebate(R3_FIELDS, 3),
      reasoning: { type: 'string' as const },
    },
  }),
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewInput = {
  b1_cognitive:    Record<string, number>
  b2_social:       Record<string, number>
  b3_motor:        Record<string, number>
  r1_dopamine:     Record<string, number>
  r2_monetization: Record<string, number>
  r3_social:       Record<string, number>
  r4_content:      Record<string, number>
  representation:  Record<string, number>
  propaganda:      { propagandaLevel: number; propagandaNotes: string }
  bechdel:         { result: 'pass' | 'fail' | 'na'; notes: string }
  practical: {
    estimatedMonthlyCostLow: number; estimatedMonthlyCostHigh: number
    minSessionMinutes: number; hasNaturalStoppingPoints: boolean
    penalizesBreaks: boolean; stoppingPointsDescription: string
  }
  narratives: { benefitsNarrative: string; risksNarrative: string; parentTip: string; parentTipBenefits: string }
}

type DebateScores = {
  b1: Record<string, number>; b2: Record<string, number>; b3: Record<string, number>
  r1: Record<string, number>; r2: Record<string, number>; r3: Record<string, number>
}

type GameRow = typeof games.$inferSelect

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildReviewPrompt(g: GameRow): string {
  return `You are a child development researcher scoring a video game using the PlaySmart rubric.

## SCORING RUBRIC SUMMARY

### Benefits (B1–B3) — scale 0–5 per item
B1 Cognitive (max 50): problemSolving, spatialAwareness, strategicThinking, criticalThinking, memoryAttention, creativity, readingLanguage, mathSystems, learningTransfer, adaptiveChallenge
B2 Social-emotional (max 30): teamwork, communication, empathy, emotionalRegulation, ethicalReasoning, positiveSocial
B3 Motor (max 20): handEyeCoord, fineMotor, reactionTime, physicalActivity

### Risks (R1–R4) — scale 0–3 per item
R1 Dopamine manipulation (max 30): variableRewards, streakMechanics, lossAversion, fomoEvents, stoppingBarriers, notifications, nearMiss, infinitePlay, escalatingCommitment, variableRewardFreq
R2 Monetization (max 24): spendingCeiling, payToWin, currencyObfuscation, spendingPrompts, childTargeting, adPressure, subscriptionPressure, socialSpending
R3 Social risk (max 18): socialObligation, competitiveToxicity, strangerRisk, socialComparison, identitySelfWorth, privacyRisk
R4 Content (max 15): violenceLevel, sexualContent, language, substanceRef, fearHorror

### Representation (REP) — higher = better (0–3 each)
repGenderBalance, repEthnicDiversity

### Propaganda (PROP)
propagandaLevel: 0=neutral, 1=mild, 2=notable, 3=heavy
propagandaNotes: brief description if level≥1

### Bechdel Test
result: pass/fail/na
notes: one sentence explanation

## CALIBRATION EXAMPLES
Minecraft: B1=38, B2=16, B3=6 | R1=4, R2=2, R3=4 → curascore 75, 120 min/day
Fortnite: B1=19, B2=10, B3=13 | R1=18, R2=13, R3=11 → curascore 42, 30 min/day
Brawl Stars: B1=14, B2=9, B3=11 | R1=23, R2=18, R3=12 → curascore 30, 15 min/day

## GAME TO REVIEW
Title: ${g.title}
Developer: ${g.developer ?? 'Unknown'}
Publisher: ${g.publisher ?? 'Unknown'}
Description: ${g.description ?? 'Not available'}
Genres: ${(g.genres as string[])?.join(', ') || 'Unknown'}
Platforms: ${(g.platforms as string[])?.join(', ') || 'Unknown'}
ESRB Rating: ${g.esrbRating ?? 'Not rated'}
Metacritic: ${g.metacriticScore ?? 'N/A'}
Base price: ${g.basePrice === 0 ? 'Free-to-play' : g.basePrice != null ? `$${g.basePrice}` : 'Unknown'}
Microtransactions: ${g.hasMicrotransactions ? 'Yes' : 'No'}
Loot boxes: ${g.hasLootBoxes ? 'Yes' : 'No'}
Battle pass: ${g.hasBattlePass ? 'Yes' : 'No'}
Subscription: ${g.hasSubscription ? 'Yes' : 'No'}
Requires internet: ${g.requiresInternet ?? 'Unknown'}
Stranger chat: ${g.hasStrangerChat ? `Yes (${g.chatModeration ?? 'unknown moderation'})` : 'No'}

Score this game accurately. Call submit_game_review with your scores.`
}

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
  const role = `You are the ADVOCATE in a PlaySmart scoring debate. Argue for the HIGHEST DEFENSIBLE scores.
- Push benefit scores UP whenever evidence supports it
- Push risk scores DOWN when risks are manageable
- Base arguments on child development research`

  if (round === 1) {
    return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\nProduce your OPENING position. Call submit_scores with your scores and reasoning.`
  }
  return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\n## CRITIC'S POSITION\nScores:\n${scoresBlock(criticScores!)}\nCritic's reasoning: "${criticReasoning}"\n\nPush back. Call submit_scores with your revised scores and rebuttal.`
}

function criticPrompt(gameInfo: string, round: number, advocateScores?: DebateScores, advocateReasoning?: string): string {
  const role = `You are the CRITIC in a PlaySmart scoring debate. Argue for the LOWEST DEFENSIBLE scores.
- Push benefit scores DOWN unless evidence is strong
- Push risk scores UP whenever a design pattern is present
- Single-player games with no multiplayer: teamwork=0, communication=0, positiveSocial≤1
- High metacritic does NOT mean high developmental scores`

  if (round === 1) {
    return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\nProduce your OPENING position. Call submit_scores with your scores and reasoning.`
  }
  return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\n## ADVOCATE'S POSITION\nScores:\n${scoresBlock(advocateScores!)}\nAdvocate's reasoning: "${advocateReasoning}"\n\nChallenge the weakest claims. Call submit_scores with your revised scores and rebuttal.`
}

// ─── Gemini callers ───────────────────────────────────────────────────────────

const REVIEW_MODEL = 'gemini-2.5-flash'
const DEBATE_MODEL = 'gemini-2.5-flash'
const FALLBACK_MODEL = 'gemini-1.5-flash-002'

async function callGeminiReview(googleAI: GoogleGenAI, prompt: string, attempt = 0): Promise<ReviewInput> {
  const modelId = attempt > 1 ? FALLBACK_MODEL : REVIEW_MODEL
  try {
    const result = await googleAI.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ functionDeclarations: [REVIEW_FUNCTION] }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ['submit_game_review'] } },
        ...(modelId.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    })
    const fc = result.candidates?.[0]?.content?.parts?.find(p => p.functionCall)?.functionCall
    if (!fc?.args) {
      if (attempt < 3) {
        await sleep(Math.pow(2, attempt) * 5000)
        return callGeminiReview(googleAI, prompt, attempt + 1)
      }
      throw new Error(`Gemini did not return a function call after ${attempt + 1} attempts`)
    }
    return fc.args as ReviewInput
  } catch (err: unknown) {
    const isTransient = String(err).includes('fetch failed') || String(err).includes('ECONNRESET')
      || (err as { status?: number })?.status === 429 || (err as { status?: number })?.status === 503
    if (isTransient && attempt < 3) {
      await sleep(Math.pow(2, attempt) * 5000)
      return callGeminiReview(googleAI, prompt, attempt + 1)
    }
    throw err
  }
}

async function callGeminiDebate(googleAI: GoogleGenAI, prompt: string, attempt = 0): Promise<{ scores: DebateScores; reasoning: string }> {
  try {
    const res = await googleAI.models.generateContent({
      model: DEBATE_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ functionDeclarations: [DEBATE_FUNCTION] }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ['submit_scores'] } },
        ...(DEBATE_MODEL.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    })
    const fc = res.candidates?.[0]?.content?.parts?.find(p => p.functionCall)?.functionCall
    if (!fc?.args) {
      if (attempt < 3) {
        await sleep(Math.pow(2, attempt) * 5000)
        return callGeminiDebate(googleAI, prompt, attempt + 1)
      }
      throw new Error('Gemini debate did not return a function call')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = fc.args as any
    return { scores: { b1: a.b1, b2: a.b2, b3: a.b3, r1: a.r1, r2: a.r2, r3: a.r3 }, reasoning: a.reasoning }
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    if ((status === 429 || status === 503) && attempt < 3) {
      await sleep(Math.pow(2, attempt) * 10000)
      return callGeminiDebate(googleAI, prompt, attempt + 1)
    }
    throw err
  }
}

// ─── Debate math ──────────────────────────────────────────────────────────────

function weightedDebateScores(advocate: DebateScores, critic: DebateScores): DebateScores {
  const w = (fa: Record<string, number>, fb: Record<string, number>) =>
    Object.fromEntries(Object.keys(fa).map(k => [k, Math.round(fa[k] * (1 - CRITIC_WEIGHT) + fb[k] * CRITIC_WEIGHT)]))
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
  const denom = bds + safety
  const curascore = denom > 0 ? Math.round((2 * bds * safety) / denom * 100) : 0
  return { bds, ris, curascore }
}

// ─── Save review + scores to DB ───────────────────────────────────────────────

async function saveReview(game: GameRow, r: ReviewInput): Promise<{ reviewId: number; curascore: number }> {
  const computed = calculateGameScores({
    ...r.b1_cognitive, ...r.b2_social, ...r.b3_motor,
    ...r.r1_dopamine, ...r.r2_monetization, ...r.r3_social, ...r.r4_content,
  })

  const reviewData = {
    gameId: game.id, reviewTier: 'automated' as const, status: 'approved' as const,
    ...r.b1_cognitive, ...r.b2_social, ...r.b3_motor,
    ...r.r1_dopamine, ...r.r2_monetization, ...r.r3_social, ...r.r4_content,
    ...r.representation,
    propagandaLevel: r.propaganda.propagandaLevel,
    propagandaNotes: r.propaganda.propagandaNotes || null,
    bechdelResult:   r.bechdel.result,
    bechdelNotes:    r.bechdel.notes || null,
    estimatedMonthlyCostLow:   r.practical.estimatedMonthlyCostLow,
    estimatedMonthlyCostHigh:  r.practical.estimatedMonthlyCostHigh,
    minSessionMinutes:         r.practical.minSessionMinutes,
    hasNaturalStoppingPoints:  r.practical.hasNaturalStoppingPoints,
    penalizesBreaks:           r.practical.penalizesBreaks,
    stoppingPointsDescription: r.practical.stoppingPointsDescription,
    benefitsNarrative:         r.narratives.benefitsNarrative,
    risksNarrative:            r.narratives.risksNarrative,
    parentTip:                 r.narratives.parentTip,
    parentTipBenefits:         r.narratives.parentTipBenefits,
    approvedAt:                new Date(),
  }

  const [existingReview] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.gameId, game.id)).limit(1)
  let reviewId: number
  if (existingReview) {
    await db.update(reviews).set({ ...reviewData, updatedAt: new Date() }).where(eq(reviews.id, existingReview.id))
    reviewId = existingReview.id
  } else {
    const [ins] = await db.insert(reviews).values(reviewData).returning({ id: reviews.id })
    reviewId = ins.id
  }

  const scoreData = {
    gameId: game.id, reviewId,
    cognitiveScore:              computed.cognitiveScore,
    socialEmotionalScore:        computed.socialEmotionalScore,
    motorScore:                  computed.motorScore,
    bds:                         computed.bds,
    dopamineRisk:                computed.dopamineRisk,
    monetizationRisk:            computed.monetizationRisk,
    socialRisk:                  computed.socialRisk,
    contentRisk:                 computed.contentRisk,
    ris:                         computed.ris,
    curascore:                   computed.curascore,
    timeRecommendationMinutes:   computed.timeRecommendation.minutes,
    timeRecommendationLabel:     computed.timeRecommendation.label,
    timeRecommendationReasoning: computed.timeRecommendation.reasoning,
    timeRecommendationColor:     computed.timeRecommendation.color,
    topBenefits:                 computed.topBenefits,
    representationScore:         (r.representation.repGenderBalance + r.representation.repEthnicDiversity) / 6,
    propagandaLevel:             r.propaganda.propagandaLevel,
    bechdelResult:               r.bechdel.result,
    calculatedAt:                new Date(),
  }

  const [existingScore] = await db.select({ id: gameScores.id }).from(gameScores).where(eq(gameScores.gameId, game.id)).limit(1)
  if (existingScore) {
    await db.update(gameScores).set(scoreData).where(eq(gameScores.id, existingScore.id))
  } else {
    await db.insert(gameScores).values(scoreData)
  }

  return { reviewId, curascore: computed.curascore }
}

// ─── Run debate on a game ─────────────────────────────────────────────────────

async function runDebate(googleAI: GoogleGenAI, game: GameRow, currentCurascore: number): Promise<{ newCurascore: number; transcript: string } | null> {
  const gInfo = gameBlock(game)

  // Round 1
  const r1adv  = await callGeminiDebate(googleAI, advocatePrompt(gInfo, 1))
  await sleep(DELAY_MS)
  const r1crit = await callGeminiDebate(googleAI, criticPrompt(gInfo, 1))
  await sleep(DELAY_MS)

  // Round 2
  const r2adv  = await callGeminiDebate(googleAI, advocatePrompt(gInfo, 2, r1crit.scores, r1crit.reasoning))
  await sleep(DELAY_MS)
  const r2crit = await callGeminiDebate(googleAI, criticPrompt(gInfo, 2, r1adv.scores, r1adv.reasoning))
  await sleep(DELAY_MS)

  const finalScores = weightedDebateScores(r2adv.scores, r2crit.scores)
  const { bds, ris, curascore } = computeDebateCurascore(finalScores)
  const swing = curascore - currentCurascore

  const transcript = `=== Round 1 ===\nADVOCATE:\n${scoresBlock(r1adv.scores)}\nReasoning: ${r1adv.reasoning}\n\nCRITIC:\n${scoresBlock(r1crit.scores)}\nReasoning: ${r1crit.reasoning}\n\n=== Round 2 ===\nADVOCATE:\n${scoresBlock(r2adv.scores)}\nReasoning: ${r2adv.reasoning}\n\nCRITIC:\n${scoresBlock(r2crit.scores)}\nReasoning: ${r2crit.reasoning}\n\n=== Final (40% advocate / 60% critic) ===\n${scoresBlock(finalScores)}\nCurascore: ${curascore}  BDS: ${bds.toFixed(3)}  RIS: ${ris.toFixed(3)}`

  // Skip if swing is too large (likely hallucination)
  if (Math.abs(swing) > MAX_AUTO_SWING) {
    console.log(`[ingest] debate swing ±${swing} too large for ${game.slug} — skipping debate save`)
    return null
  }

  // Update game_scores with debate result
  await db.update(gameScores).set({
    bds, ris, curascore,
    debateTranscript: transcript,
    debateRounds: 2,
  }).where(eq(gameScores.gameId, game.id))

  return { newCurascore: curascore, transcript }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GOOGLE_PROJECT_ID) {
    return NextResponse.json({ error: 'GOOGLE_PROJECT_ID not set' }, { status: 500 })
  }

  const googleAI = getGoogleAI()

  try {
    // ── 1. Läs cursor ─────────────────────────────────────────────────────────
    let [cursor] = await db.select().from(ingestCursor).where(eq(ingestCursor.id, 1))
    if (!cursor) {
      await db.insert(ingestCursor).values({ id: 1, genreIndex: 0, page: 1, sweep: 1, totalImported: 0 })
      cursor = { id: 1, genreIndex: 0, page: 1, sweep: 1, totalImported: 0, lastRunAt: null, updatedAt: new Date() }
    }

    const { genreIndex, page, sweep } = cursor
    const genre    = GENRES[genreIndex]
    const ordering = SWEEP_ORDERINGS[sweep] ?? '-metacritic'

    // ── 2. Hämta spel från RAWG tills vi har 200 nya ──────────────────────────
    const existingRawgIds = new Set(
      (await db.select({ rawgId: games.rawgId }).from(games)).map(r => r.rawgId).filter(Boolean)
    )

    const newGames: GameRow[] = []
    let currentPage = page
    let currentGenreIndex = genreIndex
    let currentSweep = sweep
    let hasMore = true

    while (newGames.length < MAX_GAMES_PER_RUN && hasMore) {
      const currentGenre    = GENRES[currentGenreIndex]
      const currentOrdering = SWEEP_ORDERINGS[currentSweep] ?? '-metacritic'

      let listResponse
      try {
        listResponse = await rawgGetByGenre(currentGenre, currentPage, PAGE_SIZE, currentOrdering)
      } catch (err) {
        const msg = err instanceof RawgError ? err.message : String(err)
        console.error(`[ingest] RAWG list failed for ${currentGenre} p${currentPage}: ${msg}`)
        break
      }

      const candidates = listResponse.results.filter(c =>
        c.esrb_rating?.slug !== 'adults-only' && !existingRawgIds.has(c.id)
      )

      for (const candidate of candidates) {
        if (newGames.length >= MAX_GAMES_PER_RUN) break
        try {
          await sleep(DELAY_MS)
          const detail = await rawgGetDetail(candidate.id)
          const data   = mapDetailToInsert(detail)

          const [inserted] = await db.insert(games)
            .values(data)
            .onConflictDoUpdate({
              target: games.slug,
              set: {
                rawgId: data.rawgId, title: data.title, description: data.description,
                developer: data.developer, publisher: data.publisher,
                backgroundImage: data.backgroundImage,
                updatedAt: new Date(), metadataLastSynced: new Date(),
              },
            })
            .returning()

          existingRawgIds.add(candidate.id)
          newGames.push(inserted)
        } catch (err) {
          console.error(`[ingest] Failed to insert ${candidate.name}:`, err)
        }
      }

      // Flytta cursor framåt
      const hasMorePages = !!listResponse.next && currentPage < MAX_PAGES_PER_GENRE
      if (!hasMorePages) {
        currentPage = 1
        currentGenreIndex++
        if (currentGenreIndex >= GENRES.length) {
          currentGenreIndex = 0
          currentSweep++
          if (currentSweep > Object.keys(SWEEP_ORDERINGS).length) {
            currentSweep = 1
          }
        }
      } else {
        currentPage++
      }

      // Stoppa om vi gått ett helt varv utan nya spel
      if (currentGenreIndex === genreIndex && currentSweep === sweep && currentPage >= page && newGames.length === 0) {
        hasMore = false
      }
    }

    // ── 3. Spara cursor ───────────────────────────────────────────────────────
    await db.update(ingestCursor).set({
      genreIndex:    currentGenreIndex,
      page:          currentPage,
      sweep:         currentSweep,
      totalImported: (cursor.totalImported ?? 0) + newGames.length,
      lastRunAt:     new Date(),
      updatedAt:     new Date(),
    }).where(eq(ingestCursor.id, 1))

    console.log(`[ingest] Fetched ${newGames.length} new games`)

    // ── 4. Bedöm varje nytt spel med AI ──────────────────────────────────────
    const reviewed: string[] = []
    const debated:  string[] = []
    const errors:   string[] = []

    for (const game of newGames) {
      try {
        await sleep(DELAY_MS)
        console.log(`[ingest] Reviewing: ${game.title}`)

        const prompt = buildReviewPrompt(game)
        const reviewInput = await callGeminiReview(googleAI, prompt)
        const { curascore } = await saveReview(game, reviewInput)
        reviewed.push(game.slug)

        console.log(`[ingest] ${game.title} → curascore ${curascore}`)

        // ── 5. Kör debate om curascore är i borderline-zonen ─────────────────
        if (curascore >= DEBATE_MIN_SCORE && curascore <= DEBATE_MAX_SCORE) {
          try {
            await sleep(DELAY_MS)
            console.log(`[ingest] Running debate for ${game.title} (curascore ${curascore})…`)
            const debateResult = await runDebate(googleAI, game, curascore)
            if (debateResult) {
              debated.push(game.slug)
              console.log(`[ingest] Debate done: ${curascore} → ${debateResult.newCurascore}`)
            }
          } catch (debateErr) {
            console.error(`[ingest] Debate failed for ${game.slug}:`, debateErr)
          }
        }

      } catch (err) {
        console.error(`[ingest] Review failed for ${game.slug}:`, err)
        errors.push(game.slug)
      }
    }

    return NextResponse.json({
      genre,
      page,
      sweep,
      ordering,
      fetched:  newGames.length,
      reviewed: reviewed.length,
      debated:  debated.length,
      errors:   errors.length,
      cursor: { nextGenreIndex: currentGenreIndex, nextPage: currentPage, nextSweep: currentSweep },
      totalImported: (cursor.totalImported ?? 0) + newGames.length,
    })

  } catch (err) {
    console.error('[ingest] Fatal error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
