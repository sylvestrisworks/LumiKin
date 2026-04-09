import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { games, reviews, gameScores } from '@/lib/db/schema'
import { authOptions } from '@/lib/auth'
import { calculateGameScores } from '@/lib/scoring/engine'
import type { ReviewInput } from '@/lib/scoring/types'

// ─── Zod schema ───────────────────────────────────────────────────────────────

const benefit = () => z.number().int().min(0).max(5).nullable().optional()
const risk    = () => z.number().int().min(0).max(3).nullable().optional()

const ReviewSchema = z.object({
  gameSlug: z.string().min(1).max(300),
  status:   z.enum(['draft', 'approved']).default('approved'),
  // B1 Cognitive
  problemSolving:    benefit(), spatialAwareness:  benefit(),
  strategicThinking: benefit(), criticalThinking:  benefit(),
  memoryAttention:   benefit(), creativity:        benefit(),
  readingLanguage:   benefit(), mathSystems:       benefit(),
  learningTransfer:  benefit(), adaptiveChallenge: benefit(),
  // B2 Social-emotional
  teamwork: benefit(), communication: benefit(), empathy: benefit(),
  emotionalRegulation: benefit(), ethicalReasoning: benefit(), positiveSocial: benefit(),
  // B3 Motor
  handEyeCoord: benefit(), fineMotor: benefit(),
  reactionTime: benefit(), physicalActivity: benefit(),
  // R1 Dopamine
  variableRewards: risk(), streakMechanics: risk(), lossAversion: risk(),
  fomoEvents: risk(), stoppingBarriers: risk(), notifications: risk(),
  nearMiss: risk(), infinitePlay: risk(), escalatingCommitment: risk(),
  variableRewardFreq: risk(),
  // R2 Monetisation
  spendingCeiling: risk(), payToWin: risk(), currencyObfuscation: risk(),
  spendingPrompts: risk(), childTargeting: risk(), adPressure: risk(),
  subscriptionPressure: risk(), socialSpending: risk(),
  // R3 Social
  socialObligation: risk(), competitiveToxicity: risk(), strangerRisk: risk(),
  socialComparison: risk(), identitySelfWorth: risk(), privacyRisk: risk(),
  // R4 Content
  violenceLevel: risk(), sexualContent: risk(), language: risk(),
  substanceRef: risk(), fearHorror: risk(),
  // Practical
  estimatedMonthlyCostLow:   z.number().min(0).max(10000).nullable().optional(),
  estimatedMonthlyCostHigh:  z.number().min(0).max(10000).nullable().optional(),
  minSessionMinutes:         z.number().int().min(0).max(480).nullable().optional(),
  hasNaturalStoppingPoints:  z.boolean().nullable().optional(),
  penalizesBreaks:           z.boolean().nullable().optional(),
  stoppingPointsDescription: z.string().max(2000).nullable().optional(),
  // Narratives
  benefitsNarrative: z.string().max(5000).nullable().optional(),
  risksNarrative:    z.string().max(5000).nullable().optional(),
  parentTip:         z.string().max(2000).nullable().optional(),
}).refine(
  d => d.estimatedMonthlyCostLow == null || d.estimatedMonthlyCostHigh == null
    || d.estimatedMonthlyCostLow <= d.estimatedMonthlyCostHigh,
  { message: 'estimatedMonthlyCostLow must be ≤ estimatedMonthlyCostHigh', path: ['estimatedMonthlyCostLow'] },
)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { gameSlug, status, ...reviewFields } = parsed.data

  if (!gameSlug) {
    return NextResponse.json({ error: 'gameSlug is required' }, { status: 400 })
  }

  // Find the game
  const [game] = await db
    .select({ id: games.id, esrbRating: games.esrbRating })
    .from(games)
    .where(eq(games.slug, gameSlug))
    .limit(1)

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  // Upsert the review (replace any existing review for this game)
  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.gameId, game.id))
    .limit(1)

  let reviewId: number

  const reviewData = {
    gameId:       game.id,
    reviewTier:   'expert' as const,
    status,
    // B1
    problemSolving:      reviewFields.problemSolving ?? null,
    spatialAwareness:    reviewFields.spatialAwareness ?? null,
    strategicThinking:   reviewFields.strategicThinking ?? null,
    criticalThinking:    reviewFields.criticalThinking ?? null,
    memoryAttention:     reviewFields.memoryAttention ?? null,
    creativity:          reviewFields.creativity ?? null,
    readingLanguage:     reviewFields.readingLanguage ?? null,
    mathSystems:         reviewFields.mathSystems ?? null,
    learningTransfer:    reviewFields.learningTransfer ?? null,
    adaptiveChallenge:   reviewFields.adaptiveChallenge ?? null,
    // B2
    teamwork:            reviewFields.teamwork ?? null,
    communication:       reviewFields.communication ?? null,
    empathy:             reviewFields.empathy ?? null,
    emotionalRegulation: reviewFields.emotionalRegulation ?? null,
    ethicalReasoning:    reviewFields.ethicalReasoning ?? null,
    positiveSocial:      reviewFields.positiveSocial ?? null,
    // B3
    handEyeCoord:        reviewFields.handEyeCoord ?? null,
    fineMotor:           reviewFields.fineMotor ?? null,
    reactionTime:        reviewFields.reactionTime ?? null,
    physicalActivity:    reviewFields.physicalActivity ?? null,
    // R1
    variableRewards:     reviewFields.variableRewards ?? null,
    streakMechanics:     reviewFields.streakMechanics ?? null,
    lossAversion:        reviewFields.lossAversion ?? null,
    fomoEvents:          reviewFields.fomoEvents ?? null,
    stoppingBarriers:    reviewFields.stoppingBarriers ?? null,
    notifications:       reviewFields.notifications ?? null,
    nearMiss:            reviewFields.nearMiss ?? null,
    infinitePlay:        reviewFields.infinitePlay ?? null,
    escalatingCommitment:reviewFields.escalatingCommitment ?? null,
    variableRewardFreq:  reviewFields.variableRewardFreq ?? null,
    // R2
    spendingCeiling:     reviewFields.spendingCeiling ?? null,
    payToWin:            reviewFields.payToWin ?? null,
    currencyObfuscation: reviewFields.currencyObfuscation ?? null,
    spendingPrompts:     reviewFields.spendingPrompts ?? null,
    childTargeting:      reviewFields.childTargeting ?? null,
    adPressure:          reviewFields.adPressure ?? null,
    subscriptionPressure:reviewFields.subscriptionPressure ?? null,
    socialSpending:      reviewFields.socialSpending ?? null,
    // R3
    socialObligation:    reviewFields.socialObligation ?? null,
    competitiveToxicity: reviewFields.competitiveToxicity ?? null,
    strangerRisk:        reviewFields.strangerRisk ?? null,
    socialComparison:    reviewFields.socialComparison ?? null,
    identitySelfWorth:   reviewFields.identitySelfWorth ?? null,
    privacyRisk:         reviewFields.privacyRisk ?? null,
    // R4
    violenceLevel:       reviewFields.violenceLevel ?? null,
    sexualContent:       reviewFields.sexualContent ?? null,
    language:            reviewFields.language ?? null,
    substanceRef:        reviewFields.substanceRef ?? null,
    fearHorror:          reviewFields.fearHorror ?? null,
    // Practical
    estimatedMonthlyCostLow:   reviewFields.estimatedMonthlyCostLow  ?? null,
    estimatedMonthlyCostHigh:  reviewFields.estimatedMonthlyCostHigh ?? null,
    minSessionMinutes:         reviewFields.minSessionMinutes         ?? null,
    hasNaturalStoppingPoints:  reviewFields.hasNaturalStoppingPoints  ?? null,
    penalizesBreaks:           reviewFields.penalizesBreaks           ?? null,
    stoppingPointsDescription: reviewFields.stoppingPointsDescription ?? null,
    // Narratives
    benefitsNarrative: reviewFields.benefitsNarrative ?? null,
    risksNarrative:    reviewFields.risksNarrative    ?? null,
    parentTip:         reviewFields.parentTip         ?? null,
    approvedAt:         status === 'approved' ? new Date() : null,
    updatedAt:          new Date(),
  }

  if (existing) {
    await db.update(reviews).set(reviewData).where(eq(reviews.id, existing.id))
    reviewId = existing.id
  } else {
    const [inserted] = await db.insert(reviews).values(reviewData).returning({ id: reviews.id })
    if (!inserted) return NextResponse.json({ error: 'Review insert failed' }, { status: 500 })
    reviewId = inserted.id
  }

  // Calculate scores
  const reviewInput: ReviewInput = {
    ...reviewFields,
    esrbRating: game.esrbRating,
  }
  const computed = calculateGameScores(reviewInput)

  // Upsert game_scores
  const scoreData = {
    gameId:               game.id,
    reviewId,
    cognitiveScore:       computed.cognitiveScore,
    socialEmotionalScore: computed.socialEmotionalScore,
    motorScore:           computed.motorScore,
    bds:                  computed.bds,
    dopamineRisk:         computed.dopamineRisk,
    monetizationRisk:     computed.monetizationRisk,
    socialRisk:           computed.socialRisk,
    contentRisk:          computed.contentRisk,
    ris:                  computed.ris,
    timeRecommendationMinutes: computed.timeRecommendation.minutes,
    timeRecommendationLabel:   computed.timeRecommendation.label,
    timeRecommendationReasoning: computed.timeRecommendation.reasoning,
    timeRecommendationColor:   computed.timeRecommendation.color,
    topBenefits:          computed.topBenefits,
    calculatedAt:         new Date(),
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

  return NextResponse.json({
    ok: true,
    reviewId,
    scores: {
      bds: computed.bds,
      ris: computed.ris,
      timeRecommendationMinutes: computed.timeRecommendation.minutes,
      timeRecommendationColor: computed.timeRecommendation.color,
    },
  })
}
