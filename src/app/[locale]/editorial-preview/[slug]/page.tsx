// Editorial preview route — renders the new editorial GameCard with real DB
// data inside paper-bg chrome. Lives parallel to /[locale]/game/[slug] so the
// production route stays untouched. robots:noindex.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  games,
  gameScores,
  reviews,
  darkPatterns,
  complianceStatus,
  childProfiles,
} from '@/lib/db/schema'
import { auth } from '@/auth'
import GameCardEditorial from '@/components/GameCardEditorial'
import type {
  ComplianceBadge,
  DarkPattern,
  GameCardProps,
  SerializedGame,
  SerializedScores,
  SerializedReview,
} from '@/types/game'

type Props = { params: Promise<{ locale: string; slug: string }> }

export const revalidate = 600
export const metadata = {
  title: 'Editorial preview',
  robots: { index: false, follow: false },
}

async function fetchGameData(slug: string): Promise<GameCardProps | null> {
  let game: typeof games.$inferSelect | undefined
  try {
    ;[game] = await db.select().from(games).where(eq(games.slug, slug)).limit(1)
  } catch (err) {
    console.error('[editorial-preview] db error:', err instanceof Error ? err.message : String(err))
    return null
  }
  if (!game) return null

  const [score] = await db
    .select()
    .from(gameScores)
    .where(eq(gameScores.gameId, game.id))
    .limit(1)

  const review = score
    ? (await db.select().from(reviews).where(eq(reviews.id, score.reviewId)).limit(1))[0] ?? null
    : null

  const compliance: ComplianceBadge[] = (
    await db.select().from(complianceStatus).where(eq(complianceStatus.gameId, game.id))
  ).map((c) => ({
    regulation: c.regulation,
    status: c.status as ComplianceBadge['status'],
    notes: c.notes,
  }))

  const dpRows: DarkPattern[] = review
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
    pegiRating:       game.pegiRating ?? null,
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
    bundledOnlineNote: game.bundledOnlineNote ?? null,
    updatedAt:        game.updatedAt?.toISOString() ?? null,
  }

  const serializedScores: SerializedScores | null = score
    ? {
        bds:                     score.bds,
        ris:                     score.ris,
        cognitiveScore:          score.cognitiveScore,
        socialEmotionalScore:    score.socialEmotionalScore,
        motorScore:              score.motorScore,
        dopamineRisk:            score.dopamineRisk,
        monetizationRisk:        score.monetizationRisk,
        socialRisk:              score.socialRisk,
        contentRisk:             score.contentRisk,
        curascore:               score.curascore ?? null,
        timeRecommendationMinutes:   score.timeRecommendationMinutes,
        timeRecommendationLabel:     score.timeRecommendationLabel,
        timeRecommendationReasoning: score.timeRecommendationReasoning,
        timeRecommendationColor:     score.timeRecommendationColor as SerializedScores['timeRecommendationColor'],
        topBenefits:             score.topBenefits as SerializedScores['topBenefits'],
        accessibilityRisk:       score.accessibilityRisk ?? null,
        endlessDesignRisk:       score.endlessDesignRisk ?? null,
        representationScore:     score.representationScore ?? null,
        propagandaLevel:         score.propagandaLevel ?? null,
        recommendedMinAge:       score.recommendedMinAge ?? null,
        executiveSummary:        score.executiveSummary ?? null,
        calculatedAt:            score.calculatedAt?.toISOString() ?? null,
        debateTranscript:        score.debateTranscript ?? null,
        debateRounds:            score.debateRounds ?? null,
        methodologyVersion:      score.methodologyVersion ?? null,
        scoringMethod:           score.scoringMethod ?? null,
      }
    : null

  const serializedReview: SerializedReview | null = review
    ? {
        problemSolving:         review.problemSolving,
        spatialAwareness:       review.spatialAwareness,
        strategicThinking:      review.strategicThinking,
        criticalThinking:       review.criticalThinking,
        memoryAttention:        review.memoryAttention,
        creativity:             review.creativity,
        readingLanguage:        review.readingLanguage,
        mathSystems:            review.mathSystems,
        learningTransfer:       review.learningTransfer,
        adaptiveChallenge:      review.adaptiveChallenge,
        teamwork:               review.teamwork,
        communication:          review.communication,
        empathy:                review.empathy,
        emotionalRegulation:    review.emotionalRegulation,
        ethicalReasoning:       review.ethicalReasoning,
        positiveSocial:         review.positiveSocial,
        handEyeCoord:           review.handEyeCoord,
        fineMotor:              review.fineMotor,
        reactionTime:           review.reactionTime,
        physicalActivity:       review.physicalActivity,
        variableRewards:        review.variableRewards,
        streakMechanics:        review.streakMechanics,
        lossAversion:           review.lossAversion,
        fomoEvents:             review.fomoEvents,
        stoppingBarriers:       review.stoppingBarriers,
        notifications:          review.notifications,
        nearMiss:               review.nearMiss,
        infinitePlay:           review.infinitePlay,
        escalatingCommitment:   review.escalatingCommitment,
        variableRewardFreq:     review.variableRewardFreq,
        spendingCeiling:        review.spendingCeiling,
        payToWin:               review.payToWin,
        currencyObfuscation:    review.currencyObfuscation,
        spendingPrompts:        review.spendingPrompts,
        childTargeting:         review.childTargeting,
        adPressure:             review.adPressure,
        subscriptionPressure:   review.subscriptionPressure,
        socialSpending:         review.socialSpending,
        socialObligation:       review.socialObligation,
        competitiveToxicity:    review.competitiveToxicity,
        strangerRisk:           review.strangerRisk,
        socialComparison:       review.socialComparison,
        identitySelfWorth:      review.identitySelfWorth,
        privacyRisk:            review.privacyRisk,
        violenceLevel:          review.violenceLevel,
        sexualContent:          review.sexualContent,
        language:               review.language,
        substanceRef:           review.substanceRef,
        fearHorror:             review.fearHorror,
        estimatedMonthlyCostLow:  review.estimatedMonthlyCostLow,
        estimatedMonthlyCostHigh: review.estimatedMonthlyCostHigh,
        minSessionMinutes:        review.minSessionMinutes,
        hasNaturalStoppingPoints: review.hasNaturalStoppingPoints,
        penalizesBreaks:          review.penalizesBreaks,
        stoppingPointsDescription:review.stoppingPointsDescription,
        r5CrossPlatform:          review.r5CrossPlatform,
        r5LoadTime:               review.r5LoadTime,
        r5MobileOptimized:        review.r5MobileOptimized,
        r5LoginBarrier:           review.r5LoginBarrier,
        r6InfiniteGameplay:       review.r6InfiniteGameplay,
        r6NoStoppingPoints:       review.r6NoStoppingPoints,
        r6NoGameOver:             review.r6NoGameOver,
        r6NoChapterStructure:     review.r6NoChapterStructure,
        repGenderBalance:         review.repGenderBalance,
        repEthnicDiversity:       review.repEthnicDiversity,
        propagandaLevel:          review.propagandaLevel,
        propagandaNotes:          review.propagandaNotes,
        bechdelResult:            review.bechdelResult as SerializedReview['bechdelResult'],
        bechdelNotes:             review.bechdelNotes,
        usesVirtualCurrency:      review.usesVirtualCurrency,
        virtualCurrencyName:      review.virtualCurrencyName,
        virtualCurrencyRate:      review.virtualCurrencyRate,
        benefitsNarrative:        review.benefitsNarrative,
        risksNarrative:           review.risksNarrative,
        parentTip:                review.parentTip,
        parentTipBenefits:        review.parentTipBenefits,
      }
    : null

  return {
    game:         serializedGame,
    scores:       serializedScores,
    review:       serializedReview,
    darkPatterns: dpRows,
    compliance,
  }
}

export default async function EditorialPreviewPage({ params }: Props) {
  const { locale, slug } = await params
  const data = await fetchGameData(slug)
  if (!data) notFound()

  // Lightweight session lookup for per-child line; missing auth is non-fatal.
  let userProfiles: { id: number; name: string; birthYear: number; birthDate: string | null }[] = []
  try {
    const session = await auth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uid = (session?.user as any)?.id ?? session?.user?.email ?? null
    if (uid) {
      userProfiles = await db
        .select({
          id:        childProfiles.id,
          name:      childProfiles.name,
          birthYear: childProfiles.birthYear,
          birthDate: childProfiles.birthDate,
        })
        .from(childProfiles)
        .where(eq(childProfiles.userId, uid))
    }
  } catch {
    // No auth wiring in preview is fine — per-child line just won't render.
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Preview chrome strip — keeps the route obviously distinct from the
          production game page, links back for A/B comparison. */}
      <div className="border-b border-ink/30">
        <div className="mx-auto max-w-5xl px-6 py-3 flex items-baseline justify-between gap-4">
          <span
            className="text-kicker uppercase text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Editorial preview · {data.game.title}
          </span>
          <Link
            href={`/${locale}/game/${slug}`}
            className="text-kicker uppercase text-muted hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            See current page →
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <GameCardEditorial {...data} userProfiles={userProfiles} />
      </main>
    </div>
  )
}
