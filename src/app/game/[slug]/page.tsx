export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { eq, desc, and, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, reviews, darkPatterns, complianceStatus } from '@/lib/db/schema'
import GameCard from '@/components/GameCard'
import ExpandableText from '@/components/ExpandableText'
import FeedbackForm from '@/components/FeedbackForm'
import Link from 'next/link'
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
        executiveSummary:         score.executiveSummary ?? null,
        calculatedAt:             score.calculatedAt?.toISOString() ?? null,
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

// ─── Similar games ────────────────────────────────────────────────────────────

type SimilarGame = {
  slug: string
  title: string
  backgroundImage: string | null
  esrbRating: string | null
  curascore: number | null
  timeRecommendationMinutes: number | null
  timeRecommendationColor: string | null
}

async function getSimilarGames(genre: string | undefined, currentSlug: string): Promise<SimilarGame[]> {
  if (!genre) return []
  const rows = await db
    .select({
      slug:            games.slug,
      title:           games.title,
      backgroundImage: games.backgroundImage,
      esrbRating:      games.esrbRating,
      curascore:       gameScores.curascore,
      timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
      timeRecommendationColor:   gameScores.timeRecommendationColor,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      sql`${games.genres}::jsonb @> ${JSON.stringify([genre])}::jsonb`,
      sql`${games.slug} != ${currentSlug}`,
      isNotNull(gameScores.curascore),
    ))
    .orderBy(desc(gameScores.curascore))
    .limit(4)
  return rows as SimilarGame[]
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [game] = await db
    .select({ title: games.title, description: games.description, backgroundImage: games.backgroundImage })
    .from(games)
    .where(eq(games.slug, params.slug))
    .limit(1)

  if (!game) return { title: 'Game not found — PlaySmart' }

  const desc = game.description
    ? game.description.slice(0, 160)
    : `See the PlaySmart rating for ${game.title} — benefits, risks, and time recommendations for parents.`

  return {
    title: `${game.title} — PlaySmart`,
    description: desc,
    openGraph: {
      title: `${game.title} — PlaySmart`,
      description: desc,
      images: game.backgroundImage ? [{ url: game.backgroundImage }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${game.title} — PlaySmart`,
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
  const similarGames = await getSimilarGames(game.genres[0] ?? undefined, game.slug)

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
        {/* Nav */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="text-lg font-bold text-indigo-700 tracking-tight">
              PlaySmart
            </a>
            <div className="flex items-center gap-3">
              <Link
                href={`/compare?a=${game.slug}`}
                className="text-xs font-semibold text-slate-500 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 px-3 py-1 rounded-full transition-colors"
              >
                Compare
              </Link>
              {scores?.curascore != null && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Curascore</span>
                  <span className={`font-black px-2.5 py-0.5 rounded-full text-white text-sm
                    ${scores.curascore >= 70 ? 'bg-emerald-600'
                    : scores.curascore >= 40 ? 'bg-amber-500'
                    : 'bg-red-600'}`}>
                    {scores.curascore}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-10">
          <GameCard {...data} />

          {/* Description */}
          {game.description && (
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-6">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                About this game
              </h2>
              <ExpandableText text={game.description} lines={4} />
            </div>
          )}

          {/* Feedback */}
          <div className="mt-6 flex justify-end">
            <FeedbackForm gameSlug={game.slug} />
          </div>

          {/* Similar games */}
          {similarGames.length > 0 && (
            <div className="mt-10">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                More {game.genres[0]} games
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {similarGames.map(s => {
                  const scoreBg =
                    s.curascore == null   ? 'bg-slate-300 text-slate-600' :
                    s.curascore >= 70     ? 'bg-emerald-600 text-white' :
                    s.curascore >= 40     ? 'bg-amber-500 text-white' :
                                            'bg-red-600 text-white'
                  return (
                    <Link
                      key={s.slug}
                      href={`/game/${s.slug}`}
                      className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2.5 hover:border-indigo-300 hover:shadow-sm transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-indigo-100 shrink-0">
                        {s.backgroundImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.backgroundImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-xs font-bold text-indigo-400">
                            {s.title.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                          {s.title}
                        </p>
                        {/* Always render so card heights stay consistent when ESRB is null */}
                        <p className="text-xs text-slate-400 mt-0.5 h-4 leading-4">
                          {s.esrbRating ?? ''}
                        </p>
                      </div>
                      {s.curascore != null && (
                        <span className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 ${scoreBg}`}>
                          {s.curascore}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
