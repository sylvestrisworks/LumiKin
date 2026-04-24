/**
 * jobs/review-games.ts
 *
 * Cloud Run Job — reviews unscored games using Vertex AI Gemini 2.5 Flash.
 * Replaces the Vercel cron at /api/cron/review-games.
 *
 * Auth: Application Default Credentials (metadata server in Cloud Run,
 *       gcloud auth print-access-token locally).
 *
 * Usage:
 *   npx tsx jobs/review-games.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

import { db } from '../src/lib/db'
import { games, gameScores, reviews, userGames, notifications } from '../src/lib/db/schema'
import { eq, isNull, or } from 'drizzle-orm'
import { calculateGameScores } from '../src/lib/scoring/engine'

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_REVIEWS_PER_RUN = 50
const DELAY_MS            = 200
const GCP_PROJECT         = process.env.GCP_PROJECT ?? 'curametrics-492614'
const GCP_LOCATION        = process.env.GCP_LOCATION ?? 'us-central1'
const VERTEX_MODEL        = 'gemini-2.5-flash'
const VERTEX_URL          = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT}/locations/${GCP_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  // In Cloud Run — use metadata server
  try {
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(2000) }
    )
    if (res.ok) {
      const { access_token } = await res.json()
      return access_token
    }
  } catch { /* not in Cloud Run — fall through to gcloud */ }

  // Local dev — use gcloud CLI
  const { execSync } = await import('child_process')
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
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

function scoreGroup(fields: string[], max: number, desc: string) {
  return {
    type: 'object', description: desc, required: fields,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer', minimum: 0, maximum: max }])),
  }
}

// ─── Tool schema (Gemini function calling format) ─────────────────────────────

const REVIEW_FUNCTION = {
  name: 'submit_game_review',
  description: 'Submit a completed LumiKin rubric review for a game.',
  parameters: {
    type: 'object',
    required: ['b1_cognitive','b2_social','b3_motor','r1_dopamine','r2_monetization','r3_social','r4_content','representation','propaganda','bechdel','practical','narratives'],
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
        type: 'object', required: ['propagandaLevel','propagandaNotes'],
        properties: {
          propagandaLevel: { type: 'integer', minimum: 0, maximum: 3 },
          propagandaNotes: { type: 'string' },
        },
      },
      bechdel: {
        type: 'object', required: ['result','notes'],
        properties: {
          result: { type: 'string', enum: ['pass','fail','na'] },
          notes:  { type: 'string' },
        },
      },
      practical: {
        type: 'object',
        required: ['estimatedMonthlyCostLow','estimatedMonthlyCostHigh','minSessionMinutes','hasNaturalStoppingPoints','penalizesBreaks','stoppingPointsDescription'],
        properties: {
          estimatedMonthlyCostLow:   { type: 'number'  },
          estimatedMonthlyCostHigh:  { type: 'number'  },
          minSessionMinutes:         { type: 'integer' },
          hasNaturalStoppingPoints:  { type: 'boolean' },
          penalizesBreaks:           { type: 'boolean' },
          stoppingPointsDescription: { type: 'string'  },
        },
      },
      narratives: {
        type: 'object',
        required: ['benefitsNarrative','risksNarrative','parentTip','parentTipBenefits'],
        properties: {
          benefitsNarrative: { type: 'string' },
          risksNarrative:    { type: 'string' },
          parentTip:         { type: 'string' },
          parentTipBenefits: { type: 'string' },
        },
      },
    },
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewInput = {
  b1_cognitive: Record<string, number>; b2_social: Record<string, number>; b3_motor: Record<string, number>
  r1_dopamine: Record<string, number>; r2_monetization: Record<string, number>; r3_social: Record<string, number>
  r4_content: Record<string, number>; representation: Record<string, number>
  propaganda: { propagandaLevel: number; propagandaNotes: string }
  bechdel: { result: 'pass' | 'fail' | 'na'; notes: string }
  practical: { estimatedMonthlyCostLow: number; estimatedMonthlyCostHigh: number; minSessionMinutes: number; hasNaturalStoppingPoints: boolean; penalizesBreaks: boolean; stoppingPointsDescription: string }
  narratives: { benefitsNarrative: string; risksNarrative: string; parentTip: string; parentTipBenefits: string }
}

type GameRow = Pick<typeof games.$inferSelect,
  'id' | 'slug' | 'title' | 'developer' | 'publisher' | 'description' |
  'genres' | 'platforms' | 'esrbRating' | 'metacriticScore' | 'basePrice' |
  'hasMicrotransactions' | 'hasLootBoxes' | 'hasBattlePass' | 'hasSubscription' |
  'requiresInternet' | 'hasStrangerChat' | 'chatModeration' | 'needsRescore'
>

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildReviewPrompt(g: GameRow): string {
  return `You are a child development researcher scoring a video game using the LumiKin rubric.

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

### Bechdel Test
result: pass/fail/na

## CRITICAL SCORING RULES
- R1–R3 measure DESIGN MECHANICS only. A compelling narrative, immersive world, or long playtime does NOT raise R1 scores. Only score mechanics the designer deliberately built to manipulate engagement (variable reward loops, streak penalties, FOMO timers, spending pressure, etc.).
- R4 content risk (violence, language, sexual content) is COMPLETELY SEPARATE. High R4 must NEVER influence your R1, R2, or R3 scores. A game can be extremely violent but have zero dopamine manipulation — score them independently.
- "Hard to put down because it's great" ≠ stoppingBarriers or infinitePlay. Those scores are for artificial barriers (energy systems, cliffhanger loops, manipulative design). Quality narrative is not manipulation.

## CALIBRATION EXAMPLES
Minecraft: B1=38, B2=16, B3=6 | R1=4, R2=2, R3=4 → curascore 75, 120 min/day
Fortnite: B1=19, B2=10, B3=13 | R1=18, R2=13, R3=11 → curascore 42, 30 min/day
Brawl Stars: B1=14, B2=9, B3=11 | R1=23, R2=18, R3=12 → curascore 30, 15 min/day
Red Dead Redemption 2: B1=24, B2=14, B3=10 | R1=3, R2=0, R3=2 → curascore 72, 90 min/day
  (High R4: violence=3, language=2, substanceRef=2 — but one-time purchase, no IAP, no streaks, natural stopping points between missions. R4 does NOT lower the curascore.)

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

// ─── Vertex AI caller ─────────────────────────────────────────────────────────

async function callVertexReview(prompt: string, attempt = 0): Promise<ReviewInput> {
  const token = await getAccessToken()
  try {
    const res = await fetch(VERTEX_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ functionDeclarations: [REVIEW_FUNCTION] }],
        toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['submit_game_review'] } },
        generationConfig: { temperature: 0.3 },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      if ((res.status === 429 || res.status === 503) && attempt < 3) {
        await sleep(Math.pow(2, attempt) * 5000)
        return callVertexReview(prompt, attempt + 1)
      }
      throw new Error(`Vertex AI ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const part = data.candidates?.[0]?.content?.parts?.[0]
    if (!part?.functionCall?.args) {
      if (attempt < 3) {
        await sleep(Math.pow(2, attempt) * 5000)
        return callVertexReview(prompt, attempt + 1)
      }
      throw new Error('Vertex AI did not return a function call')
    }
    return part.functionCall.args as ReviewInput
  } catch (err: unknown) {
    const isTransient = String(err).includes('fetch failed') || String(err).includes('ECONNRESET')
    if (isTransient && attempt < 3) {
      await sleep(Math.pow(2, attempt) * 5000)
      return callVertexReview(prompt, attempt + 1)
    }
    throw err
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

type OldScore = { curascore: number | null; timeRecommendationMinutes: number | null; recommendedMinAge: number | null } | null
type NewScore = { curascore: number; timeRecommendation: { minutes: number }; recommendedMinAge?: number }

async function writeNotifications(gameId: number, gameTitle: string, old: OldScore, next: NewScore) {
  const isFirst   = !old || old.curascore == null
  const scoreDiff = isFirst ? 0 : (next.curascore - (old.curascore ?? 0))
  const timeChange = !isFirst && next.timeRecommendation.minutes !== old.timeRecommendationMinutes
  const ageChange  = !isFirst && next.recommendedMinAge != null && next.recommendedMinAge !== old.recommendedMinAge
  if (!isFirst && Math.abs(scoreDiff) < 5 && !timeChange && !ageChange) return

  const type  = isFirst ? 'first_score' : (scoreDiff >= 0 ? 'score_up' : 'score_down')
  const title = isFirst ? `${gameTitle} has been rated` : `${gameTitle} rating updated`
  const body  = isFirst
    ? `LumiKin just published its first rating: Curascore ${next.curascore}. Recommended: ${next.timeRecommendation.minutes} min/day.`
    : [
        Math.abs(scoreDiff) >= 5 ? `Curascore ${scoreDiff > 0 ? '+' : ''}${scoreDiff}` : null,
        timeChange ? `Time: ${old!.timeRecommendationMinutes} → ${next.timeRecommendation.minutes} min/day` : null,
        ageChange  ? `Age: ${old!.recommendedMinAge}+ → ${next.recommendedMinAge}+` : null,
      ].filter(Boolean).join(' · ')

  const libraryUsers = await db.select({ userId: userGames.userId }).from(userGames).where(eq(userGames.gameId, gameId))
  if (libraryUsers.length === 0) return
  await db.insert(notifications).values(libraryUsers.map(u => ({ userId: u.userId, gameId, type, title, body })))
}

// ─── Save review + scores ─────────────────────────────────────────────────────

async function saveReview(game: GameRow, r: ReviewInput): Promise<number> {
  const computed = calculateGameScores({
    ...r.b1_cognitive, ...r.b2_social, ...r.b3_motor,
    ...r.r1_dopamine, ...r.r2_monetization, ...r.r3_social, ...r.r4_content,
  })

  const reviewData = {
    gameId: game.id, reviewTier: 'automated' as const, status: 'approved' as const,
    ...r.b1_cognitive, ...r.b2_social, ...r.b3_motor,
    ...r.r1_dopamine, ...r.r2_monetization, ...r.r3_social, ...r.r4_content,
    ...r.representation,
    propagandaLevel: r.propaganda.propagandaLevel, propagandaNotes: r.propaganda.propagandaNotes || null,
    bechdelResult: r.bechdel.result, bechdelNotes: r.bechdel.notes || null,
    estimatedMonthlyCostLow: r.practical.estimatedMonthlyCostLow,
    estimatedMonthlyCostHigh: r.practical.estimatedMonthlyCostHigh,
    minSessionMinutes: r.practical.minSessionMinutes,
    hasNaturalStoppingPoints: r.practical.hasNaturalStoppingPoints,
    penalizesBreaks: r.practical.penalizesBreaks,
    stoppingPointsDescription: r.practical.stoppingPointsDescription,
    benefitsNarrative: r.narratives.benefitsNarrative,
    risksNarrative: r.narratives.risksNarrative,
    parentTip: r.narratives.parentTip,
    parentTipBenefits: r.narratives.parentTipBenefits,
    approvedAt: new Date(),
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
    cognitiveScore: computed.cognitiveScore, socialEmotionalScore: computed.socialEmotionalScore, motorScore: computed.motorScore,
    bds: computed.bds, dopamineRisk: computed.dopamineRisk, monetizationRisk: computed.monetizationRisk,
    socialRisk: computed.socialRisk, contentRisk: computed.contentRisk, ris: computed.ris,
    curascore: computed.curascore,
    timeRecommendationMinutes: computed.timeRecommendation.minutes,
    timeRecommendationLabel: computed.timeRecommendation.label,
    timeRecommendationReasoning: computed.timeRecommendation.reasoning,
    timeRecommendationColor: computed.timeRecommendation.color,
    topBenefits: computed.topBenefits,
    representationScore: (r.representation.repGenderBalance + r.representation.repEthnicDiversity) / 6,
    propagandaLevel: r.propaganda.propagandaLevel,
    bechdelResult: r.bechdel.result,
    calculatedAt: new Date(),
  }

  const [existingScore] = await db.select({
    id: gameScores.id, curascore: gameScores.curascore,
    timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
    recommendedMinAge: gameScores.recommendedMinAge,
  }).from(gameScores).where(eq(gameScores.gameId, game.id)).limit(1)

  if (existingScore) {
    await db.update(gameScores).set(scoreData).where(eq(gameScores.id, existingScore.id))
  } else {
    await db.insert(gameScores).values(scoreData)
  }

  await writeNotifications(game.id, game.title, existingScore ?? null, computed)
  return computed.curascore
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[review-games] Starting Cloud Run Job')

  const pending = await db.select({
    games: {
      id: games.id, slug: games.slug, title: games.title,
      developer: games.developer, publisher: games.publisher, description: games.description,
      genres: games.genres, platforms: games.platforms, esrbRating: games.esrbRating,
      metacriticScore: games.metacriticScore, basePrice: games.basePrice,
      hasMicrotransactions: games.hasMicrotransactions, hasLootBoxes: games.hasLootBoxes,
      hasBattlePass: games.hasBattlePass, hasSubscription: games.hasSubscription,
      requiresInternet: games.requiresInternet, hasStrangerChat: games.hasStrangerChat,
      chatModeration: games.chatModeration, needsRescore: games.needsRescore,
    },
    gameScores: { id: gameScores.id },
  })
  .from(games)
  .leftJoin(gameScores, eq(gameScores.gameId, games.id))
  .where(or(isNull(gameScores.id), eq(games.needsRescore, true)))
  .limit(MAX_REVIEWS_PER_RUN)

  if (pending.length === 0) {
    console.log('[review-games] No unreviewed games — exiting')
    process.exit(0)
  }

  console.log(`[review-games] Found ${pending.length} games to review`)

  let reviewed = 0
  let errors = 0

  for (const row of pending) {
    const game = row.games
    try {
      await sleep(DELAY_MS)
      console.log(`[review-games] Reviewing: ${game.title}`)
      const reviewInput = await callVertexReview(buildReviewPrompt(game))
      const curascore = await saveReview(game, reviewInput)
      if (game.needsRescore) await db.update(games).set({ needsRescore: false }).where(eq(games.id, game.id))
      reviewed++
      console.log(`[review-games] ${game.title} → curascore ${curascore}`)
    } catch (err) {
      errors++
      console.error(`[review-games] Failed for ${game.slug}:`, err)
    }
  }

  console.log(`[review-games] Done — reviewed: ${reviewed}, errors: ${errors}`)
  process.exit(errors > 0 && reviewed === 0 ? 1 : 0)
}

main().catch(err => {
  console.error('[review-games] Fatal:', err)
  process.exit(1)
})
