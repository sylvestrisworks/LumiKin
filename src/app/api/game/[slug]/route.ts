import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, reviews, darkPatterns, complianceStatus } from '@/lib/db/schema'
import type { ComplianceBadge, DarkPattern, GameCardProps, SerializedGame, SerializedScores, SerializedReview } from '@/types/game'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!slug || slug.length > 255 || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }
  try {
  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.slug, slug))
    .limit(1)

  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [score] = await db
    .select()
    .from(gameScores)
    .where(eq(gameScores.gameId, game.id))
    .limit(1)

  const review = score
    ? (await db.select().from(reviews).where(eq(reviews.id, score.reviewId)).limit(1))[0] ?? null
    : null

  const rawCompliance: ComplianceBadge[] = (
    await db.select().from(complianceStatus).where(eq(complianceStatus.gameId, game.id))
  ).map((c) => ({
    regulation: c.regulation,
    status: c.status as ComplianceBadge['status'],
    notes: c.notes,
  }))

  const rawDarkPatterns: DarkPattern[] = review
    ? (await db.select().from(darkPatterns).where(eq(darkPatterns.reviewId, review.id))).map((dp) => ({
        patternId: dp.patternId,
        severity: dp.severity as DarkPattern['severity'],
        description: dp.description,
      }))
    : []

  const serializedGame: SerializedGame = {
    id:               game.id,
    slug:             game.slug,
    title:            game.title,
    description:      game.description,
    developer:        game.developer,
    publisher:        game.publisher,
    releaseDate:      game.releaseDate?.toISOString() ?? null,
    genres:           Array.isArray(game.genres) ? (game.genres as string[]) : [],
    platforms:        Array.isArray(game.platforms) ? (game.platforms as string[]) : [],
    esrbRating:       game.esrbRating,
    metacriticScore:  game.metacriticScore,
    avgPlaytimeHours: game.avgPlaytimeHours,
    backgroundImage:  game.backgroundImage,
    basePrice:        game.basePrice,
    hasMicrotransactions: game.hasMicrotransactions ?? false,
    hasLootBoxes:     game.hasLootBoxes ?? false,
    hasSubscription:  game.hasSubscription ?? false,
    hasBattlePass:    game.hasBattlePass ?? false,
    requiresInternet: game.requiresInternet,
    hasStrangerChat:  game.hasStrangerChat ?? false,
    chatModeration:   game.chatModeration,
    updatedAt:           game.updatedAt?.toISOString() ?? null,
    bundledOnlineNote:   game.bundledOnlineNote ?? null,
  }

  const serializedScores: SerializedScores | null = score ? {
    bds:                       score.bds,
    ris:                       score.ris,
    cognitiveScore:            score.cognitiveScore,
    socialEmotionalScore:      score.socialEmotionalScore,
    motorScore:                score.motorScore,
    dopamineRisk:              score.dopamineRisk,
    monetizationRisk:          score.monetizationRisk,
    socialRisk:                score.socialRisk,
    contentRisk:               score.contentRisk,
    curascore:                 score.curascore ?? null,
    timeRecommendationMinutes: score.timeRecommendationMinutes,
    timeRecommendationLabel:   score.timeRecommendationLabel,
    timeRecommendationReasoning: score.timeRecommendationReasoning,
    timeRecommendationColor:   score.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
    topBenefits:               score.topBenefits as SerializedScores['topBenefits'],
    accessibilityRisk:         score.accessibilityRisk ?? null,
    endlessDesignRisk:         score.endlessDesignRisk ?? null,
    representationScore:       score.representationScore ?? null,
    propagandaLevel:           score.propagandaLevel ?? null,
    executiveSummary:          score.executiveSummary ?? null,
    calculatedAt:              score.calculatedAt?.toISOString() ?? null,
    debateTranscript:          score.debateTranscript ?? null,
    debateRounds:              score.debateRounds ?? null,
  } : null

  const serializedReview: SerializedReview | null = review ? {
    problemSolving: review.problemSolving, spatialAwareness: review.spatialAwareness,
    strategicThinking: review.strategicThinking, criticalThinking: review.criticalThinking,
    memoryAttention: review.memoryAttention, creativity: review.creativity,
    readingLanguage: review.readingLanguage, mathSystems: review.mathSystems,
    learningTransfer: review.learningTransfer, adaptiveChallenge: review.adaptiveChallenge,
    teamwork: review.teamwork, communication: review.communication,
    empathy: review.empathy, emotionalRegulation: review.emotionalRegulation,
    ethicalReasoning: review.ethicalReasoning, positiveSocial: review.positiveSocial,
    handEyeCoord: review.handEyeCoord, fineMotor: review.fineMotor,
    reactionTime: review.reactionTime, physicalActivity: review.physicalActivity,
    variableRewards: review.variableRewards, streakMechanics: review.streakMechanics,
    lossAversion: review.lossAversion, fomoEvents: review.fomoEvents,
    stoppingBarriers: review.stoppingBarriers, notifications: review.notifications,
    nearMiss: review.nearMiss, infinitePlay: review.infinitePlay,
    escalatingCommitment: review.escalatingCommitment, variableRewardFreq: review.variableRewardFreq,
    spendingCeiling: review.spendingCeiling, payToWin: review.payToWin,
    currencyObfuscation: review.currencyObfuscation, spendingPrompts: review.spendingPrompts,
    childTargeting: review.childTargeting, adPressure: review.adPressure,
    subscriptionPressure: review.subscriptionPressure, socialSpending: review.socialSpending,
    socialObligation: review.socialObligation, competitiveToxicity: review.competitiveToxicity,
    strangerRisk: review.strangerRisk, socialComparison: review.socialComparison,
    identitySelfWorth: review.identitySelfWorth, privacyRisk: review.privacyRisk,
    violenceLevel: review.violenceLevel, sexualContent: review.sexualContent,
    language: review.language, substanceRef: review.substanceRef, fearHorror: review.fearHorror,
    estimatedMonthlyCostLow: review.estimatedMonthlyCostLow,
    estimatedMonthlyCostHigh: review.estimatedMonthlyCostHigh,
    minSessionMinutes: review.minSessionMinutes,
    hasNaturalStoppingPoints: review.hasNaturalStoppingPoints,
    penalizesBreaks: review.penalizesBreaks,
    stoppingPointsDescription: review.stoppingPointsDescription ?? null,
    r5CrossPlatform:      review.r5CrossPlatform ?? null,
    r5LoadTime:           review.r5LoadTime ?? null,
    r5MobileOptimized:    review.r5MobileOptimized ?? null,
    r5LoginBarrier:       review.r5LoginBarrier ?? null,
    r6InfiniteGameplay:   review.r6InfiniteGameplay ?? null,
    r6NoStoppingPoints:   review.r6NoStoppingPoints ?? null,
    r6NoGameOver:         review.r6NoGameOver ?? null,
    r6NoChapterStructure: review.r6NoChapterStructure ?? null,
    repGenderBalance:     review.repGenderBalance ?? null,
    repEthnicDiversity:   review.repEthnicDiversity ?? null,
    propagandaLevel:      review.propagandaLevel ?? null,
    propagandaNotes:      review.propagandaNotes ?? null,
    bechdelResult:        (review.bechdelResult as 'pass' | 'fail' | 'na' | null) ?? null,
    bechdelNotes:         review.bechdelNotes ?? null,
    usesVirtualCurrency: review.usesVirtualCurrency,
    virtualCurrencyName: review.virtualCurrencyName ?? null,
    virtualCurrencyRate: review.virtualCurrencyRate ?? null,
    benefitsNarrative: review.benefitsNarrative,
    risksNarrative: review.risksNarrative,
    parentTip: review.parentTip,
    parentTipBenefits: review.parentTipBenefits ?? null,
  } : null

  const result: GameCardProps = { game: serializedGame, scores: serializedScores, review: serializedReview, darkPatterns: rawDarkPatterns, compliance: rawCompliance }
  return NextResponse.json(result)
  } catch (err) {
    console.error('[api/game] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
