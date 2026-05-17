export const revalidate = 3600

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, reviews, darkPatterns, complianceStatus, userGames, childProfiles, gameTranslations } from '@/lib/db/schema'
import GameCard from '@/components/GameCard'
import { RelatedGameCard } from '@/components/RelatedGameCard'
import { GitCompareArrows } from 'lucide-react'
import { fetchRelatedGames } from '@/lib/related-games'
import LibraryButton from '@/components/LibraryButton'
import ParentTips from '@/components/ParentTips'
import ShareButton from '@/components/ShareButton'
import PlausibleSearchReferrer from '@/components/PlausibleSearchReferrer'
import { auth } from '@/auth'
import { Suspense } from 'react'
import { getTranslations, getLocale } from 'next-intl/server'
import type { ComplianceBadge, DarkPattern, GameCardProps, SerializedGame, SerializedScores, SerializedReview } from '@/types/game'

type Props = { params: Promise<{ locale: string; slug: string }> }

async function fetchGameData(slug: string): Promise<GameCardProps | null> {
  let game: typeof games.$inferSelect | undefined
  try {
    ;[game] = await db.select().from(games).where(eq(games.slug, slug)).limit(1)
  } catch (err) {
    console.error('[fetchGameData] db error:', err instanceof Error ? err.message : String(err))
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
    pegiRating:      game.pegiRating ?? null,
    metacriticScore: game.metacriticScore,
    avgPlaytimeHours:game.avgPlaytimeHours,
    backgroundImage: game.backgroundImage,
    basePrice:       game.basePrice,
    hasMicrotransactions: game.hasMicrotransactions ?? false,
    hasLootBoxes:    game.hasLootBoxes ?? false,
    hasSubscription: game.hasSubscription ?? false,
    hasBattlePass:   game.hasBattlePass ?? false,
    requiresInternet:game.requiresInternet,
    hasStrangerChat:    game.hasStrangerChat ?? false,
    chatModeration:     game.chatModeration,
    bundledOnlineNote:  game.bundledOnlineNote ?? null,
    updatedAt:          game.updatedAt?.toISOString() ?? null,
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
        recommendedMinAge:        score.recommendedMinAge ?? null,
        executiveSummary:         score.executiveSummary ?? null,
        calculatedAt:             score.calculatedAt?.toISOString() ?? null,
        debateTranscript:         score.debateTranscript ?? null,
        debateRounds:             score.debateRounds ?? null,
        methodologyVersion:       score.methodologyVersion ?? null,
        scoringMethod:            score.scoringMethod ?? null,
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
  const { slug, locale } = await params

  let game: { id: number; title: string; description: string | null; backgroundImage: string | null; esrbRating: string | null; genres: unknown } | undefined
  try {
    ;[game] = await db
      .select({
        id: games.id,
        title: games.title,
        description: games.description,
        backgroundImage: games.backgroundImage,
        esrbRating: games.esrbRating,
        genres: games.genres,
      })
      .from(games)
      .where(eq(games.slug, slug))
      .limit(1)
  } catch {
    return { title: 'LumiKin' }
  }

  if (!game) return { title: 'Game not found — LumiKin' }

  const t = await getTranslations({ locale, namespace: 'game' })

  // For non-EN locales, prefer the translated benefitsNarrative so each locale
  // ships a distinct meta description. Falls back to the localized template
  // when no translation row exists yet. EN keeps the source game.description.
  let localizedDesc: string | null = null
  if (locale !== 'en') {
    try {
      const [tx] = await db
        .select({ benefitsNarrative: gameTranslations.benefitsNarrative })
        .from(gameTranslations)
        .where(and(eq(gameTranslations.gameId, game.id), eq(gameTranslations.locale, locale)))
        .limit(1)
      if (tx?.benefitsNarrative && tx.benefitsNarrative.length > 10) {
        localizedDesc = tx.benefitsNarrative
      }
    } catch {
      // game_translations missing — fall back below
    }
  }

  const rawDesc =
      localizedDesc
    ?? (locale === 'en' ? game.description : null)
    ?? t('metaDescFallback', { title: game.title })

  const title = t('metaTitle', { title: game.title })
  const desc  = rawDesc.length > 155 ? rawDesc.slice(0, 155) + '…' : rawDesc

  const ogImage   = `/api/og/game/${slug}`
  const canonical = `/${locale}/game/${slug}`
  const ogAlt     = t('ogAlt', { title: game.title })

  return {
    title,
    description: desc,
    alternates: {
      canonical,
      languages: {
        'en':        `/en/game/${slug}`,
        'sv':        `/sv/game/${slug}`,
        'de':        `/de/game/${slug}`,
        'es':        `/es/game/${slug}`,
        'fr':        `/fr/game/${slug}`,
        'x-default': `/en/game/${slug}`,
      },
    },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogAlt }],
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
  const [data, session, t, tGC, locale] = await Promise.all([
    fetchGameData(slug),
    auth(),
    getTranslations('game'),
    getTranslations('gameCard'),
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

  // Related games — platform + score + age bucket match, 24h cache
  const relatedGames = data.scores?.curascore != null
    ? await fetchRelatedGames(
        slug,
        data.scores.curascore,
        data.game.platforms,
        data.game.esrbRating,
        data.game.pegiRating,
      ).catch((e: unknown) => {
        console.error('[related-games]', e instanceof Error ? e.message : String(e))
        return []
      })
    : []

  const { game, scores } = data

  // Fetch user's library/wishlist state for this game (if logged in)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uid = (session?.user as any)?.id ?? session?.user?.email ?? null
  let initialOwned = false
  let initialWishlisted = false
  let userProfiles: { id: number; name: string; birthYear: number; birthDate: string | null }[] = []

  if (uid && game.id) {
    const [entries, profileRows] = await Promise.all([
      db.select({ listType: userGames.listType })
        .from(userGames)
        .where(and(eq(userGames.userId, uid), eq(userGames.gameId, game.id))),
      db.select({ id: childProfiles.id, name: childProfiles.name, birthYear: childProfiles.birthYear, birthDate: childProfiles.birthDate })
        .from(childProfiles)
        .where(eq(childProfiles.userId, uid)),
    ])
    initialOwned      = entries.some(e => e.listType === 'owned')
    initialWishlisted = entries.some(e => e.listType === 'wishlist')
    userProfiles      = profileRows
  }

  // JSON-LD structured data
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'

  // Pick a canonical platform parent for the breadcrumb. Order reflects
  // mental-model strength for parents: consoles first, then PC, then mobile.
  // Each entry maps a `games.platforms` string to a `/platform/[slug]` URL slug.
  const PLATFORM_PARENT_PRIORITY: Array<{ match: string; slug: string; label: string }> = [
    { match: 'PlayStation',     slug: 'playstation',     label: 'PlayStation' },
    { match: 'Xbox',            slug: 'xbox',            label: 'Xbox' },
    { match: 'Nintendo Switch', slug: 'nintendo-switch', label: 'Nintendo Switch' },
    { match: 'PC',              slug: 'pc',              label: 'PC' },
    { match: 'iOS',             slug: 'ios',             label: 'iOS' },
    { match: 'Android',         slug: 'android',         label: 'Android' },
  ]
  const canonicalPlatform = PLATFORM_PARENT_PRIORITY.find(p =>
    game.platforms.some(gp => gp === p.match || gp.includes(p.match)),
  ) ?? null

  const videoGameLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.title,
    description: game.description ?? undefined,
    developer: game.developer ? { '@type': 'Organization', name: game.developer } : undefined,
    publisher: game.publisher ? { '@type': 'Organization', name: game.publisher } : undefined,
    genre: game.genres.length > 0 ? game.genres : undefined,
    gamePlatform: game.platforms.length > 0 ? game.platforms : undefined,
    contentRating: game.esrbRating ?? undefined,
    image: game.backgroundImage ?? undefined,
    url: `${SITE_URL}/en/game/${game.slug}`,
  }

  // Review schema — only emitted when a LumiScore exists
  const reviewBodyRaw = scores?.executiveSummary
    ?? (scores?.curascore != null
      ? `${game.title} received a LumiScore of ${scores.curascore}/100.${scores.timeRecommendationLabel ? ` Recommended play time: ${scores.timeRecommendationLabel}.` : ''}`
      : null)
  const reviewBody = reviewBodyRaw
    ? reviewBodyRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
    : null

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('navHome'),   item: `${SITE_URL}/${locale}` },
      { '@type': 'ListItem', position: 2, name: t('navBrowse'), item: `${SITE_URL}/${locale}/browse` },
      ...(canonicalPlatform
        ? [{ '@type': 'ListItem', position: 3, name: canonicalPlatform.label, item: `${SITE_URL}/${locale}/platform/${canonicalPlatform.slug}` }]
        : []),
      { '@type': 'ListItem', position: canonicalPlatform ? 4 : 3, name: game.title, item: `${SITE_URL}/${locale}/game/${game.slug}` },
    ],
  }

  const reviewLd = scores?.curascore != null ? {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'VideoGame',
      name: game.title,
      gamePlatform: game.platforms.length > 0 ? game.platforms : undefined,
      genre: game.genres.length > 0 ? game.genres : undefined,
      publisher: game.publisher ? { '@type': 'Organization', name: game.publisher } : undefined,
    },
    author: {
      '@type': 'Organization',
      name: 'LumiKin',
      url: SITE_URL,
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: scores.curascore,
      bestRating: 100,
      worstRating: 0,
    },
    datePublished: scores.calculatedAt ? scores.calculatedAt.slice(0, 10) : undefined,
    dateModified: (game.updatedAt ?? scores.calculatedAt)?.slice(0, 10),
    reviewBody: reviewBody ?? undefined,
    url: `${SITE_URL}/en/game/${game.slug}`,
  } : null

  // FAQ schema only emits on /en/* and when a LumiScore exists. Localized
  // FAQ Q&A pairs are deferred to Phase E (translation audit).
  const verdictText =
      scores?.curascore == null                ? null
    : scores.curascore >= 70                    ? 'It scores well on developmental benefits with manageable risks.'
    : scores.curascore >= 50                    ? 'It offers solid benefits but needs parental guidance on the risks.'
    : scores.curascore >= 35                    ? 'There are notable risks worth knowing before letting kids play.'
    :                                             'Significant risks make this hard to recommend for younger players.'
  const ageRatingLine = [game.esrbRating, game.pegiRating].filter(Boolean).join(' · ')

  const faqLd = locale === 'en' && scores?.curascore != null ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Is ${game.title} safe for kids?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `LumiKin gives ${game.title} a LumiScore of ${scores.curascore}/100${scores.recommendedMinAge != null ? `, recommended for ages ${scores.recommendedMinAge} and up` : ''}. ${verdictText}`,
        },
      },
      ...(scores.recommendedMinAge != null ? [{
        '@type': 'Question',
        name: `What age is ${game.title} appropriate for?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `LumiKin's rubric recommends a minimum age of ${scores.recommendedMinAge}+ for ${game.title}${ageRatingLine ? ` (${ageRatingLine})` : ''}, based on benefits, risks, and content review.`,
        },
      }] : []),
      ...(scores.timeRecommendationLabel ? [{
        '@type': 'Question',
        name: `How long should kids play ${game.title}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `LumiKin's recommended play time for ${game.title} is ${scores.timeRecommendationLabel}, calibrated to the game's dopamine, monetization, and social-pressure profile.`,
        },
      }] : []),
      ...(data.review?.risksNarrative ? [{
        '@type': 'Question',
        name: `What are the main risks of ${game.title}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: data.review.risksNarrative.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400),
        },
      }] : []),
    ],
  } : null

  return (
    <>
      <PlausibleSearchReferrer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoGameLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') }}
      />
      {reviewLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') }}
        />
      )}
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') }}
        />
      )}

      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <main className="max-w-2xl lg:max-w-5xl mx-auto px-4 py-6">

          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <a href={`/${locale}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1 py-0.5 -mx-1 rounded">
              {t('navHome')}
            </a>
            <span aria-hidden>/</span>
            <a href={`/${locale}/browse`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1 py-0.5 -mx-1 rounded">
              {t('navBrowse')}
            </a>
            <span aria-hidden>/</span>
            {canonicalPlatform && (
              <>
                <a
                  href={`/${locale}/platform/${canonicalPlatform.slug}`}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1 py-0.5 -mx-1 rounded"
                >
                  {canonicalPlatform.label}
                </a>
                <span aria-hidden>/</span>
              </>
            )}
            <span className="text-slate-700 dark:text-slate-200 truncate">{data.game.title}</span>
          </nav>

          <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">

            {/* ── Left column: the game card ─────────────────────────────────── */}
            <div className="lg:col-span-8 min-w-0">
              <GameCard {...data} userProfiles={userProfiles} />
            </div>

            {/* ── Right rail: supporting actions + context ───────────────────── */}
            <aside className="mt-6 lg:mt-0 lg:col-span-4 space-y-4">

              {/* Library / Wishlist + Compare + Share */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {uid && game.id ? (
                  <LibraryButton
                    gameId={game.id}
                    initialOwned={initialOwned}
                    initialWishlisted={initialWishlisted}
                  />
                ) : <div />}
                <div className="flex items-center gap-2">
                  <a
                    href={`/${locale}/compare?a=${game.slug}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors"
                  >
                    <GitCompareArrows size={15} strokeWidth={2.5} aria-hidden />
                    {tGC('compareThis')}
                  </a>
                  <ShareButton title={game.title} />
                </div>
              </div>

              {/* Parent Tips */}
              {game.id && (
                <Suspense fallback={
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4">
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
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4">
                    <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                      {t('aboutThisGame')}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{excerpt}</p>
                  </div>
                )
              })()}

              {/* Explore more */}
              {relatedGames.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4">
                  <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                    Explore more
                  </h2>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {relatedGames.map(g => (
                      <RelatedGameCard key={g.slug} game={g} />
                    ))}
                  </div>
                </div>
              )}
            </aside>

          </div>
        </main>
      </div>
    </>
  )
}
