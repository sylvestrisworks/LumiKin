export const revalidate = 3600

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { eq, and, or, ne, isNotNull, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, reviews, darkPatterns, complianceStatus, userGames, childProfiles, gameTranslations } from '@/lib/db/schema'
import GameCard from '@/components/GameCard'
import GameCompactCard from '@/components/GameCompactCard'
import type { GameSummary } from '@/types/game'
import LibraryButton from '@/components/LibraryButton'
import ParentTips from '@/components/ParentTips'
import ShareButton from '@/components/ShareButton'
import { auth } from '@/auth'
import { calcAge } from '@/lib/age'
import { Suspense } from 'react'
import { getTranslations, getLocale } from 'next-intl/server'
import type { ComplianceBadge, DarkPattern, GameCardProps, SerializedGame, SerializedScores, SerializedReview } from '@/types/game'

type Props = { params: Promise<{ slug: string }> }

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
    genres:          Array.isArray(game.genres) ? (game.genres as string[]) : [],
    platforms:       Array.isArray(game.platforms) ? (game.platforms as string[]) : [],
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
        bechdelResult:        (review.bechdelResult as 'pass' | 'fail' | 'na' | null) ?? null,
        bechdelNotes:         review.bechdelNotes ?? null,
        usesVirtualCurrency:       review.usesVirtualCurrency,
        virtualCurrencyName:       review.virtualCurrencyName ?? null,
        virtualCurrencyRate:       review.virtualCurrencyRate ?? null,
        benefitsNarrative:         review.benefitsNarrative,
        risksNarrative:            review.risksNarrative,
        parentTip:                 review.parentTip,
        parentTipBenefits:         review.parentTipBenefits ?? null,
      }
    : null

  return { game: serializedGame, scores: serializedScores, review: serializedReview, darkPatterns: serializedDarkPatterns, compliance: serializedCompliance }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [game] = await db
    .select({
      title: games.title,
      description: games.description,
      backgroundImage: games.backgroundImage,
      esrbRating: games.esrbRating,
      genres: games.genres,
    })
    .from(games)
    .where(eq(games.slug, slug))
    .limit(1)

  if (!game) return { title: 'Game not found — LumiKin' }

  const title = `${game.title} — Is it good for kids? | LumiKin`
  const desc = game.description
    ? game.description.slice(0, 155) + (game.description.length > 155 ? '…' : '')
    : `LumiKin rates ${game.title} for parents — benefits, risks, addictive design patterns, and a recommended daily screen time.`

  const ogImage = `/api/og/game/${slug}`
  const canonical = `/game/${slug}`

  return {
    title,
    description: desc,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${game.title} — LumiKin rating` }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: [ogImage],
    },
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function GamePage({ params }: Props) {
  const { slug } = await params
  const [data, session, t, locale] = await Promise.all([
    fetchGameData(slug),
    auth(),
    getTranslations('game'),
    getLocale(),
  ])
  if (!data) notFound()

  // Overlay translated narrative content when locale is not English
  if (locale !== 'en' && data.game.id) {
    try {
      const [tx] = await db
        .select()
        .from(gameTranslations)
        .where(and(eq(gameTranslations.gameId, data.game.id), eq(gameTranslations.locale, locale)))
        .limit(1)
      if (tx) {
        if (tx.executiveSummary  && data.scores) data.scores = { ...data.scores, executiveSummary: tx.executiveSummary }
        if (tx.benefitsNarrative && data.review)  data.review = { ...data.review, benefitsNarrative: tx.benefitsNarrative }
        if (tx.risksNarrative    && data.review)  data.review = { ...data.review, risksNarrative: tx.risksNarrative }
        if (tx.parentTip         && data.review)  data.review = { ...data.review, parentTip: tx.parentTip }
        if (tx.parentTipBenefits && data.review)  data.review = { ...data.review, parentTipBenefits: tx.parentTipBenefits }
        if (tx.bechdelNotes      && data.review)  data.review = { ...data.review, bechdelNotes: tx.bechdelNotes }
      }
    } catch {
      // game_translations table not yet migrated — skip silently
    }
  }

  // Similar games — same genre, scored, exclude self
  const genreList = data.game.genres.slice(0, 3)
  let similarGames: GameSummary[] = []
  if (genreList.length > 0) {
    try {
      const rows = await db
        .select({
          slug:                     games.slug,
          title:                    games.title,
          developer:                games.developer,
          backgroundImage:          games.backgroundImage,
          genres:                   games.genres,
          platforms:                games.platforms,
          esrbRating:               games.esrbRating,
          hasLootBoxes:             games.hasLootBoxes,
          hasMicrotransactions:     games.hasMicrotransactions,
          curascore:                gameScores.curascore,
          timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
          timeRecommendationColor:  gameScores.timeRecommendationColor,
        })
        .from(games)
        .leftJoin(gameScores, eq(gameScores.gameId, games.id))
        .where(and(
          ne(games.slug, slug),
          isNotNull(gameScores.curascore),
          or(...genreList.map(g => sql`${games.genres} @> jsonb_build_array(${g})`)),
        ))
        .orderBy(desc(gameScores.curascore))
        .limit(6)
      similarGames = rows.map(r => ({
        slug:                     r.slug,
        title:                    r.title,
        developer:                r.developer,
        backgroundImage:          r.backgroundImage,
        genres:                   Array.isArray(r.genres) ? (r.genres as string[]) : [],
        platforms:                Array.isArray(r.platforms) ? (r.platforms as string[]) : [],
        esrbRating:               r.esrbRating,
        hasLootBoxes:             r.hasLootBoxes ?? false,
        hasMicrotransactions:     r.hasMicrotransactions ?? false,
        curascore:                r.curascore ?? null,
        timeRecommendationMinutes: r.timeRecommendationMinutes ?? null,
        timeRecommendationColor:  (r.timeRecommendationColor as GameSummary['timeRecommendationColor']) ?? null,
      }))
    } catch (e) {
      console.error('[similar-games] query failed:', e instanceof Error ? e.message : String(e))
    }
  }

  const { game, scores } = data

  // Fetch user's library/wishlist state for this game (if logged in)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uid = (session?.user as any)?.id ?? session?.user?.email ?? null
  let initialOwned = false
  let initialWishlisted = false
  let recommendedMinAge: number | null = null
  let userProfiles: { id: number; name: string; birthYear: number; birthDate: string | null }[] = []

  if (uid && game.id) {
    const [entries, scoreRow, profileRows] = await Promise.all([
      db.select({ listType: userGames.listType })
        .from(userGames)
        .where(and(eq(userGames.userId, uid), eq(userGames.gameId, game.id))),
      db.select({ recommendedMinAge: gameScores.recommendedMinAge })
        .from(gameScores)
        .where(eq(gameScores.gameId, game.id))
        .limit(1),
      db.select({ id: childProfiles.id, name: childProfiles.name, birthYear: childProfiles.birthYear, birthDate: childProfiles.birthDate })
        .from(childProfiles)
        .where(eq(childProfiles.userId, uid)),
    ])
    initialOwned      = entries.some(e => e.listType === 'owned')
    initialWishlisted = entries.some(e => e.listType === 'wishlist')
    recommendedMinAge = scoreRow[0]?.recommendedMinAge ?? null
    userProfiles      = profileRows
  }

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
    url: `https://lumikin.org/game/${game.slug}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') }}
      />

      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <main className="max-w-2xl mx-auto px-4 py-6">

          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
            <a href={`/${locale}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              {t('navHome')}
            </a>
            <span>/</span>
            <a href={`/${locale}/browse`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              {t('navBrowse')}
            </a>
            <span>/</span>
            <span className="text-slate-600 dark:text-slate-300 truncate">{data.game.title}</span>
          </nav>

          <GameCard {...data} />

          {/* Library / Wishlist + Share */}
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            {uid && game.id ? (
              <LibraryButton
                gameId={game.id}
                initialOwned={initialOwned}
                initialWishlisted={initialWishlisted}
              />
            ) : <div />}
            <ShareButton title={game.title} />
          </div>

          {/* Per-child appropriateness banner */}
          {userProfiles.length > 0 && (() => {
            const minAge = recommendedMinAge ?? (game.esrbRating === 'M' ? 17 : game.esrbRating === 'T' ? 13 : game.esrbRating === 'E10+' ? 10 : 0)
            const checks = userProfiles.map(p => ({
              name: p.name,
              age: calcAge(p.birthDate, p.birthYear),
              ok: minAge === 0 || calcAge(p.birthDate, p.birthYear) >= minAge,
            }))
            const allOk = checks.every(c => c.ok)
            const noneOk = checks.every(c => !c.ok)
            return (
              <div className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
                allOk  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                noneOk ? 'bg-red-50 border-red-200 text-red-800' :
                         'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {checks.map(c => (
                    <span key={c.name} className="flex items-center gap-1.5">
                      <span>{c.ok ? '✓' : '✗'}</span>
                      <span className="font-medium">{c.name}</span>
                      <span className="opacity-60 text-xs">({c.age})</span>
                    </span>
                  ))}
                  {minAge > 0 && <span className="opacity-60 text-xs ml-auto">{t('recommendedAge', { age: minAge })}</span>}
                </div>
              </div>
            )
          })()}

          {/* Parent Tips */}
          {game.id && (
            <Suspense fallback={
              <div className="mt-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4">
                <div className="h-4 w-24 bg-slate-100 dark:bg-slate-700 rounded animate-pulse mb-3" />
                <div className="space-y-2">
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="h-3 w-3/4 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
                </div>
              </div>
            }>
              <ParentTips gameId={game.id} uid={uid} />
            </Suspense>
          )}

          {/* Description — first 2 sentences only, strips HTML tags */}
          {game.description && (() => {
            const plain = game.description!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            const sentences = plain.match(/[^.!?]+[.!?]+/g) ?? []
            const excerpt = sentences.slice(0, 2).join(' ').trim() || plain.slice(0, 220)
            return (
              <div className="mt-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4">
                <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                  {t('aboutThisGame')}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{excerpt}</p>
              </div>
            )
          })()}

          {/* Similar games */}
          {similarGames.length > 0 && (
            <div className="mt-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4">
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                {t('similarGames')}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {similarGames.map(g => (
                  <GameCompactCard key={g.slug} game={g} />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
