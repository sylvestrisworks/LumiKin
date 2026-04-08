export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, reviews, darkPatterns, complianceStatus } from '@/lib/db/schema'
import GameCard from '@/components/GameCard'
import type { ComplianceBadge, DarkPattern, GameCardProps, SerializedGame, SerializedScores, SerializedReview } from '@/types/game'

type Props = { params: { slug: string } }

async function fetchGameData(slug: string): Promise<GameCardProps | null> {
  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.slug, slug))
    .limit(1)

  if (!game) return null

  const [score] = await db
    .select()
    .from(gameScores)
    .where(eq(gameScores.gameId, game.id))
    .limit(1)

  const review = score
    ? (await db.select().from(reviews).where(eq(reviews.id, score.reviewId)).limit(1))[0] ?? null
    : null

  const serializedCompliance: ComplianceBadge[] = (
    await db.select().from(complianceStatus).where(eq(complianceStatus.gameId, game.id))
  ).map((c) => ({
    regulation: c.regulation,
    status: c.status as ComplianceBadge['status'],
    notes: c.notes,
  }))

  const serializedDarkPatterns: DarkPattern[] = review
    ? (await db.select().from(darkPatterns).where(eq(darkPatterns.reviewId, review.id))).map((dp) => ({
        patternId: dp.patternId,
        severity: dp.severity as DarkPattern['severity'],
        description: dp.description,
      }))
    : []

  // Serialize dates → strings for client component
  const serializedGame: SerializedGame = {
    id:              game.id,
    slug:            game.slug,
    title:           game.title,
    description:     game.description,
    developer:       game.developer,
    publisher:       game.publisher,
    releaseDate:     game.releaseDate?.toISOString() ?? null,
    genres:          (game.genres as string[]) ?? [],
    platforms:       (game.platforms as string[]) ?? [],
    esrbRating:      game.esrbRating,
    metacriticScore: game.metacriticScore,
    avgPlaytimeHours:game.avgPlaytimeHours,
    backgroundImage: game.backgroundImage,
    basePrice:       game.basePrice,
    hasMicrotransactions: game.hasMicrotransactions ?? false,
    hasLootBoxes:    game.hasLootBoxes ?? false,
    hasSubscription: game.hasSubscription ?? false,
    hasBattlePass:   game.hasBattlePass ?? false,
    requiresInternet:game.requiresInternet,
    hasStrangerChat: game.hasStrangerChat ?? false,
    chatModeration:  game.chatModeration,
    updatedAt:       game.updatedAt?.toISOString() ?? null,
  }

  const serializedScores: SerializedScores | null = score
    ? {
        bds:                      score.bds,
        ris:                      score.ris,
        cognitiveScore:           score.cognitiveScore,
        socialEmotionalScore:     score.socialEmotionalScore,
        motorScore:               score.motorScore,
        dopamineRisk:             score.dopamineRisk,
        monetizationRisk:         score.monetizationRisk,
        socialRisk:               score.socialRisk,
        contentRisk:              score.contentRisk,
        curascore:                score.curascore ?? null,
        timeRecommendationMinutes:score.timeRecommendationMinutes,
        timeRecommendationLabel:  score.timeRecommendationLabel,
        timeRecommendationReasoning: score.timeRecommendationReasoning,
        timeRecommendationColor:  score.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
        topBenefits:              score.topBenefits as SerializedScores['topBenefits'],
        accessibilityRisk:        score.accessibilityRisk ?? null,
        endlessDesignRisk:        score.endlessDesignRisk ?? null,
        representationScore:      score.representationScore ?? null,
        propagandaLevel:          score.propagandaLevel ?? null,
        executiveSummary:         score.executiveSummary ?? null,
        calculatedAt:             score.calculatedAt?.toISOString() ?? null,
        debateTranscript:         score.debateTranscript ?? null,
        debateRounds:             score.debateRounds ?? null,
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
        hasNaturalStoppingPoints:  review.hasNaturalStoppingPoints,
        penalizesBreaks:           review.penalizesBreaks,
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
        usesVirtualCurrency:       review.usesVirtualCurrency,
        virtualCurrencyName:       review.virtualCurrencyName ?? null,
        virtualCurrencyRate:       review.virtualCurrencyRate ?? null,
        benefitsNarrative:         review.benefitsNarrative,
        risksNarrative:            review.risksNarrative,
        parentTip:                 review.parentTip,
      }
    : null

  return { game: serializedGame, scores: serializedScores, review: serializedReview, darkPatterns: serializedDarkPatterns, compliance: serializedCompliance }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [game] = await db
    .select({ title: games.title, description: games.description, backgroundImage: games.backgroundImage })
    .from(games)
    .where(eq(games.slug, params.slug))
    .limit(1)

  if (!game) return { title: 'Game not found — Good Game Parent' }

  const desc = game.description
    ? game.description.slice(0, 160)
    : `See the Good Game Parent rating for ${game.title} — benefits, risks, and time recommendations for parents.`

  return {
    title: `${game.title} — Good Game Parent`,
    description: desc,
    openGraph: {
      title: `${game.title} — Good Game Parent`,
      description: desc,
      images: game.backgroundImage ? [{ url: game.backgroundImage }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${game.title} — Good Game Parent`,
      description: desc,
      images: game.backgroundImage ? [game.backgroundImage] : [],
    },
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function GamePage({ params }: Props) {
  const data = await fetchGameData(params.slug)
  if (!data) notFound()

  const { game, scores } = data

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.title,
    description: game.description ?? undefined,
    developer: game.developer ? { '@type': 'Organization', name: game.developer } : undefined,
    publisher: game.publisher ? { '@type': 'Organization', name: game.publisher } : undefined,
    genre: game.genres,
    gamePlatform: game.platforms,
    contentRating: game.esrbRating ?? undefined,
    aggregateRating: game.metacriticScore
      ? { '@type': 'AggregateRating', ratingValue: game.metacriticScore, bestRating: 100, ratingCount: 1 }
      : undefined,
    image: game.backgroundImage ?? undefined,
    url: `https://playsmart.app/game/${game.slug}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-slate-50">
        <main className="max-w-2xl mx-auto px-4 py-6">
          <GameCard {...data} />

          {/* Description */}
          {game.description && (
            <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                About this game
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed">
                {game.description}
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
