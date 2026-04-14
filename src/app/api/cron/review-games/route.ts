/**
 * GET /api/cron/review-games
 *
 * Steg 2 i ingest-pipeline:
 *   - Hittar spel i DB som saknar AI-scores (game_scores)
 *   - Kör Gemini AI-review på varje spel (max 50 per körning)
 *   - Sparar review + scores till DB
 *
 * Körs var 3:e timme via GitHub Actions.
 * Protection: Authorization: Bearer <CRON_SECRET>
 * Max duration: 300s (Vercel Pro)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, gameScores, reviews } from '@/lib/db/schema'
import { eq, isNull } from 'drizzle-orm'
import { calculateGameScores } from '@/lib/scoring/engine'
import { GoogleGenAI, FunctionCallingConfigMode, Type } from '@google/genai'

export const maxDuration = 300

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_REVIEWS_PER_RUN = 50
const DELAY_MS            = 500
const REVIEW_MODEL        = 'gemini-2.5-flash'
const FALLBACK_MODEL      = 'gemini-1.5-flash-002'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Rubric field definitions ─────────────────────────────────────────────────

const B1_FIELDS = ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge']
const B2_FIELDS = ['teamwork','communication','empathy','emotionalRegulation','ethicalReasoning','positiveSocial']
const B3_FIELDS = ['handEyeCoord','fineMotor','reactionTime','physicalActivity']
const R1_FIELDS = ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq']
const R2_FIELDS = ['spendingCeiling','payToWin','currencyObfuscation','spendingPrompts','childTargeting','adPressure','subscriptionPressure','socialSpending']
const R3_FIELDS = ['socialObligation','competitiveToxicity','strangerRisk','socialComparison','identitySelfWorth','privacyRisk']
const R4_FIELDS = ['violenceLevel','sexualContent','language','substanceRef','fearHorror']
const REP_FIELDS = ['repGenderBalance','repEthnicDiversity']

// ─── Gemini schema helpers ────────────────────────────────────────────────────

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
      out[k] = Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, toGeminiSchema(pv)])
      )
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

type GameRow = typeof games.$inferSelect

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildReviewPrompt(g: GameRow): string {
  return `You are a child development researcher scoring a video game using the PlaySmart rubric.

## SCORING RUBRIC SUMMARY

### Benefits (B1–B3) — scale 0–5 per item
B1 Cognitive (max 50): problemSolving, spatialAwareness, strategicThinking, criticalThinking, memoryAttention, creativity, readingLanguage, mathSystems, learningTransfer, adaptiveChallenge
  0=not present, 1=minimal, 3=moderate, 5=core mechanic

B2 Social-emotional (max 30): teamwork, communication, empathy, emotionalRegulation, ethicalReasoning, positiveSocial
  Score genuine cooperative design highly; solo games with cosmetic multiplayer score low

B3 Motor (max 20): handEyeCoord, fineMotor, reactionTime, physicalActivity
  physicalActivity=5 only for VR/motion games

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

Score this game accurately. Calibrate against the examples above. Call submit_game_review with your scores.`
}

// ─── Gemini caller ────────────────────────────────────────────────────────────

function getGoogleAI() {
  return new GoogleGenAI({
    vertexai: true,
    project:  process.env.GOOGLE_PROJECT_ID!,
    location: process.env.GOOGLE_LOCATION ?? 'us-central1',
  })
}

async function callGeminiReview(googleAI: GoogleGenAI, prompt: string, attempt = 0): Promise<ReviewInput> {
  const modelId = attempt > 1 ? FALLBACK_MODEL : REVIEW_MODEL
  try {
    const result = await googleAI.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ functionDeclarations: [REVIEW_FUNCTION] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ['submit_game_review'],
          },
        },
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
    const isTransient =
      String(err).includes('fetch failed') ||
      String(err).includes('ECONNRESET') ||
      (err as { status?: number })?.status === 429 ||
      (err as { status?: number })?.status === 503
    if (isTransient && attempt < 3) {
      await sleep(Math.pow(2, attempt) * 5000)
      return callGeminiReview(googleAI, prompt, attempt + 1)
    }
    throw err
  }
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
    propagandaLevel:           r.propaganda.propagandaLevel,
    propagandaNotes:           r.propaganda.propagandaNotes || null,
    bechdelResult:             r.bechdel.result,
    bechdelNotes:              r.bechdel.notes || null,
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

  const [existingReview] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.gameId, game.id))
    .limit(1)

  let reviewId: number
  if (existingReview) {
    await db.update(reviews)
      .set({ ...reviewData, updatedAt: new Date() })
      .where(eq(reviews.id, existingReview.id))
    reviewId = existingReview.id
  } else {
    const [ins] = await db.insert(reviews).values(reviewData).returning({ id: reviews.id })
    reviewId = ins.id
  }

  const scoreData = {
    gameId:                      game.id,
    reviewId,
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

  const [existingScore] = await db
    .select({ id: gameScores.id })
    .from(gameScores)
    .where(eq(gameScores.gameId, game.id))
    .limit(1)

  if (existingScore) {
    await db.update(gameScores).set(scoreData).where(eq(gameScores.id, existingScore.id))
  } else {
    await db.insert(gameScores).values(scoreData)
  }

  return { reviewId, curascore: computed.curascore }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[review-games] CRON_SECRET is not set — refusing all requests')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GOOGLE_PROJECT_ID) {
    return NextResponse.json({ error: 'GOOGLE_PROJECT_ID not set' }, { status: 500 })
  }

  const googleAI = getGoogleAI()

  try {
    // Hämta spel utan scores
    const pending = await db
      .select()
      .from(games)
      .leftJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(isNull(gameScores.id))
      .limit(MAX_REVIEWS_PER_RUN)

    if (pending.length === 0) {
      return NextResponse.json({ message: 'No unreviewed games found', reviewed: 0 })
    }

    console.log(`[review-games] Found ${pending.length} unreviewed games`)

    const reviewed: string[] = []
    const errors:   string[] = []

    for (const row of pending) {
      const game = row.games
      try {
        await sleep(DELAY_MS)
        console.log(`[review-games] Reviewing: ${game.title}`)

        const prompt      = buildReviewPrompt(game)
        const reviewInput = await callGeminiReview(googleAI, prompt)
        const { curascore } = await saveReview(game, reviewInput)

        reviewed.push(game.slug)
        console.log(`[review-games] ${game.title} → curascore ${curascore}`)
      } catch (err) {
        console.error(`[review-games] Failed for ${game.slug}:`, err)
        errors.push(game.slug)
      }
    }

    return NextResponse.json({
      reviewed: reviewed.length,
      errors:   errors.length,
      slugs:    reviewed,
    })

  } catch (err) {
    console.error('[review-games] Fatal error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
