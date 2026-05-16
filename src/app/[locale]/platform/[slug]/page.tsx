export const revalidate = 3600

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { eq, and, desc, asc, isNotNull, lte, gte, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, platformExperiences, experienceScores } from '@/lib/db/schema'
import PlatformExperienceCard, { type PlatformExperienceSummary } from '@/components/PlatformExperienceCard'
import PlatformScoreHistogram, { type HistogramBucket } from '@/components/PlatformScoreHistogram'
import CarouselRow from '@/components/CarouselRow'
import Icon, { type IconName } from '@/components/Icon'
import { curascoreText } from '@/lib/ui'
import type { GameSummary } from '@/types/game'
import { Sparkles, Zap, Clock, Trophy, ShieldCheck, Gamepad2 } from 'lucide-react'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'

// ─── UGC platform aliases ─────────────────────────────────────────────────────
const SLUG_ALIASES: Record<string, string> = {
  fortnite: 'fortnite-creative',
}
const DB_TO_URL: Record<string, string> = {
  'fortnite-creative': 'fortnite',
}

// ─── UGC platform styling ─────────────────────────────────────────────────────
const UGC_ACCENT: Record<string, string> = {
  roblox:              'from-red-950/95 via-red-900/70 to-slate-900/20',
  'fortnite-creative': 'from-indigo-950/95 via-indigo-900/70 to-slate-900/20',
}
const UGC_ICON_BG: Record<string, string> = {
  roblox:              'bg-red-600 ring-red-400/40',
  'fortnite-creative': 'bg-blue-600 ring-blue-400/40',
}
const UGC_ICON_NAME: Record<string, IconName> = {
  roblox:              'roblox',
  'fortnite-creative': 'fortnite',
}

// ─── Traditional platform config ──────────────────────────────────────────────
// description and editorial text live in messages/*/platform namespace
type PlatformConfig = {
  name: string
  keyword: string     // matched against games.platforms JSON via ILIKE
  browseKey: string   // matches PLATFORM_KEYWORDS key in browse/page.tsx
  accent: string      // Tailwind gradient for hero
  iconBg: string      // Tailwind bg+ring for icon
  iconName: IconName  // brand logo
  msgKey: string      // key suffix used in messages: desc_{msgKey}, editorial_{msgKey}
}

const TRADITIONAL_PLATFORMS: Record<string, PlatformConfig> = {
  playstation: {
    name: 'PlayStation',
    keyword: 'PlayStation',
    browseKey: 'PlayStation',
    accent: 'from-blue-950/95 via-blue-900/70 to-slate-900/20',
    iconBg: 'bg-blue-700 ring-blue-400/40',
    iconName: 'playstation',
    msgKey: 'playstation',
  },
  xbox: {
    name: 'Xbox',
    keyword: 'Xbox',
    browseKey: 'Xbox',
    accent: 'from-green-950/95 via-green-900/70 to-slate-900/20',
    iconBg: 'bg-green-700 ring-green-400/40',
    iconName: 'xbox',
    msgKey: 'xbox',
  },
  'nintendo-switch': {
    name: 'Nintendo Switch',
    keyword: 'Nintendo Switch',
    browseKey: 'Switch',
    accent: 'from-red-950/95 via-red-900/70 to-slate-900/20',
    iconBg: 'bg-red-600 ring-red-400/40',
    iconName: 'switch',
    msgKey: 'nintendo_switch',
  },
  ios: {
    name: 'iOS',
    keyword: 'iOS',
    browseKey: 'iOS',
    accent: 'from-sky-950/95 via-sky-900/70 to-slate-900/20',
    iconBg: 'bg-sky-600 ring-sky-400/40',
    iconName: 'ios',
    msgKey: 'ios',
  },
  android: {
    name: 'Android',
    keyword: 'Android',
    browseKey: 'Android',
    accent: 'from-emerald-950/95 via-emerald-900/70 to-slate-900/20',
    iconBg: 'bg-emerald-600 ring-emerald-400/40',
    iconName: 'android',
    msgKey: 'android',
  },
  pc: {
    name: 'PC',
    keyword: 'PC',
    browseKey: 'PC',
    accent: 'from-violet-950/95 via-violet-900/70 to-slate-900/20',
    iconBg: 'bg-violet-700 ring-violet-400/40',
    iconName: 'pc',
    msgKey: 'pc',
  },
}

// ─── Game select + mapper ─────────────────────────────────────────────────────
const GAME_SELECT = {
  slug:                      games.slug,
  title:                     games.title,
  developer:                 games.developer,
  genres:                    games.genres,
  esrbRating:                games.esrbRating,
  backgroundImage:           games.backgroundImage,
  curascore:                 gameScores.curascore,
  calculatedAt:              gameScores.calculatedAt,
  timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
  timeRecommendationColor:   gameScores.timeRecommendationColor,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGameSummary(r: any): GameSummary {
  return {
    slug:                      r.slug,
    title:                     r.title,
    developer:                 r.developer ?? null,
    genres:                    Array.isArray(r.genres) ? (r.genres as string[]) : [],
    esrbRating:                r.esrbRating ?? null,
    backgroundImage:           r.backgroundImage ?? null,
    curascore:                 r.curascore ?? null,
    calculatedAt:              r.calculatedAt ? new Date(r.calculatedAt).toISOString() : null,
    timeRecommendationMinutes: r.timeRecommendationMinutes ?? null,
    timeRecommendationColor:   (r.timeRecommendationColor ?? null) as 'green' | 'amber' | 'red' | null,
  }
}

// ─── Stats helper ─────────────────────────────────────────────────────────────
async function fetchPlatformStats(keyword: string) {
  const platformFilter = sql`${games.platforms}::text ILIKE ${'%' + keyword + '%'}`
  const [row] = await db
    .select({
      count:    sql<number>`count(${gameScores.id})::int`,
      avgScore: sql<number>`round(avg(${gameScores.curascore}))::int`,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(isNotNull(gameScores.curascore), platformFilter))
  return { count: Number(row?.count ?? 0), avgScore: row?.avgScore ?? null }
}

type Props = { params: Promise<{ locale: string; slug: string }> }

// ─── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params

  const traditional = TRADITIONAL_PLATFORMS[slug]
  if (traditional) {
    const t = await getTranslations({ locale, namespace: 'platform' })
    const { count, avgScore } = await fetchPlatformStats(traditional.keyword)
    const description = count > 0 && avgScore != null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? t('metaDescription' as any, { count, name: traditional.name, avg: avgScore })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : t(`desc_${traditional.msgKey}` as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const title = t('metaTitle' as any, { name: traditional.name })
    const ogImage = `/api/og/platform/${slug}`
    return {
      title,
      description,
      alternates: { canonical: `/${locale}/platform/${slug}` },
      openGraph: {
        title,
        description,
        type: 'website',
        images: [{ url: ogImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
    }
  }

  const dbSlug = SLUG_ALIASES[slug] ?? slug
  const [platform] = await db
    .select({ title: games.title })
    .from(games)
    .where(eq(games.slug, dbSlug))
    .limit(1)

  if (!platform) return {}
  return {
    title: `${platform.title} Hub — LumiKin`,
    description: `LumiKin safety scores for ${platform.title} experiences. Browse ratings by score, find the safest picks, and see what to watch out for.`,
    alternates: { canonical: `/${locale}/platform/${slug}` },
  }
}

// ─── Static params ────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const ugcPlatforms = await db
    .select({ slug: games.slug })
    .from(games)
    .where(eq(games.contentType, 'platform'))

  const locales = ['en', 'es', 'fr', 'sv', 'de']
  const ugcSlugs = ugcPlatforms.map(p => DB_TO_URL[p.slug] ?? p.slug)
  const traditionalSlugs = Object.keys(TRADITIONAL_PLATFORMS)
  const allSlugs = [...ugcSlugs, ...traditionalSlugs]

  return locales.flatMap(locale =>
    allSlugs.map(slug => ({ locale, slug }))
  )
}

// ─── UGC platform helpers ─────────────────────────────────────────────────────
function toExperienceSummary(
  exp: typeof platformExperiences.$inferSelect,
  score: typeof experienceScores.$inferSelect | null,
): PlatformExperienceSummary {
  return {
    slug:                      exp.slug,
    title:                     exp.title,
    thumbnailUrl:              exp.thumbnailUrl,
    creatorName:               exp.creatorName,
    activePlayers:             exp.activePlayers,
    curascore:                 score?.curascore ?? null,
    timeRecommendationMinutes: score?.timeRecommendationMinutes ?? null,
    recommendedMinAge:         score?.recommendedMinAge ?? null,
    strangerRisk:              score?.strangerRisk ?? null,
    monetizationScore:         score?.monetizationScore ?? null,
    inputConfidence:           score?.inputConfidence ?? null,
  }
}

function ExperienceGrid({
  experiences,
  locale,
  platformSlug,
}: {
  experiences: PlatformExperienceSummary[]
  locale: string
  platformSlug: string
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:snap-none">
      {experiences.map(exp => (
        <div key={exp.slug} className="snap-start shrink-0 w-44 sm:w-auto">
          <PlatformExperienceCard exp={exp} locale={locale} platformSlug={platformSlug} />
        </div>
      ))}
    </div>
  )
}

// ─── Breadcrumb helper ────────────────────────────────────────────────────────
function buildBreadcrumbLd(args: {
  locale: string
  slug: string
  platformName: string
  homeLabel: string
  browseLabel: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: args.homeLabel,   item: `${SITE_URL}/${args.locale}` },
      { '@type': 'ListItem', position: 2, name: args.browseLabel, item: `${SITE_URL}/${args.locale}/browse` },
      { '@type': 'ListItem', position: 3, name: args.platformName, item: `${SITE_URL}/${args.locale}/platform/${args.slug}` },
    ],
  }
}

function BreadcrumbNav({
  locale,
  homeLabel,
  browseLabel,
  platformName,
}: {
  locale: string
  homeLabel: string
  browseLabel: string
  platformName: string
}) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
      <a href={`/${locale}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1 py-0.5 -mx-1 rounded">
        {homeLabel}
      </a>
      <span aria-hidden>/</span>
      <a href={`/${locale}/browse`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1 py-0.5 -mx-1 rounded">
        {browseLabel}
      </a>
      <span aria-hidden>/</span>
      <span className="text-slate-700 dark:text-slate-200 truncate">{platformName}</span>
    </nav>
  )
}

// ─── Traditional platform page ────────────────────────────────────────────────
async function TraditionalPlatformPage({
  slug,
  locale,
  config,
}: {
  slug: string
  locale: string
  config: PlatformConfig
}) {
  const pf = sql`${games.platforms}::text ILIKE ${'%' + config.keyword + '%'}`
  const base = and(isNotNull(gameScores.curascore), pf)

  const [t, tNav, [statsRow], bucketRows, topRated, safest, forKids, coop, recent] = await Promise.all([
    getTranslations({ locale, namespace: 'platform' }),
    getTranslations({ locale, namespace: 'game' }),

    db.select({
      count:        sql<number>`count(${gameScores.id})::int`,
      avgScore:     sql<number>`round(avg(${gameScores.curascore}))::int`,
      maxScore:     sql<number>`max(${gameScores.curascore})::int`,
      avgBds:       sql<number>`avg(${gameScores.bds})`,
      avgRis:       sql<number>`avg(${gameScores.ris})`,
      avgTime:      sql<number>`round(avg(${gameScores.timeRecommendationMinutes}))::int`,
      safestCount:  sql<number>`count(*) filter (where ${gameScores.ris} <= 0.25)::int`,
    })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base),

    db.select({
      bucket: sql<number>`floor(${gameScores.curascore} / 10) * 10`,
      count:  sql<number>`count(*)::int`,
    })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base)
      .groupBy(sql`floor(${gameScores.curascore} / 10) * 10`)
      .orderBy(sql`floor(${gameScores.curascore} / 10) * 10`),

    db.select(GAME_SELECT)
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base)
      .orderBy(desc(gameScores.curascore))
      .limit(12),

    db.select(GAME_SELECT)
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(and(base, lte(gameScores.ris, 0.25)))
      .orderBy(asc(gameScores.ris), desc(gameScores.curascore))
      .limit(12),

    db.select(GAME_SELECT)
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(and(base, inArray(games.esrbRating, ['E', 'E10+'])))
      .orderBy(desc(gameScores.bds), desc(gameScores.curascore))
      .limit(12),

    db.select(GAME_SELECT)
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(and(base, gte(gameScores.socialEmotionalScore, 0.5)))
      .orderBy(desc(gameScores.socialEmotionalScore), desc(gameScores.curascore))
      .limit(12),

    db.select(GAME_SELECT)
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base)
      .orderBy(desc(gameScores.calculatedAt))
      .limit(12),
  ] as const)

  const scoredCount = Number(statsRow?.count ?? 0)
  const avgScore    = statsRow?.avgScore ?? null
  const maxScore    = statsRow?.maxScore ?? null
  const avgBds      = statsRow?.avgBds != null ? Number(statsRow.avgBds) : null
  const avgRis      = statsRow?.avgRis != null ? Number(statsRow.avgRis) : null
  const avgTime     = statsRow?.avgTime ?? null
  const safestCount = Number(statsRow?.safestCount ?? 0)
  const topGame     = topRated[0] ?? null
  const buckets     = bucketRows as HistogramBucket[]
  const b           = `/${locale}/browse?platforms=${config.browseKey}`

  const carouselRows = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { id: 'top',    title: t('topRated' as any),  iconName: 'topscore', browseHref: `${b}&sort=curascore`,    games: topRated.map(toGameSummary) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { id: 'safest', title: t('safest' as any),    iconName: 'family',   browseHref: `${b}&sort=safest`,       games: safest.map(toGameSummary)   },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { id: 'kids',   title: t('forKids' as any),   iconName: 'beginner', browseHref: `${b}&age=E10`,           games: forKids.map(toGameSummary)  },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { id: 'coop',   title: t('coop' as any),      iconName: 'family',   browseHref: `${b}&benefits=teamwork`, games: coop.map(toGameSummary)     },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { id: 'recent', title: t('recent' as any),    iconName: 'new',      browseHref: `${b}&sort=newest`,       games: recent.map(toGameSummary)   },
  ].filter(r => r.games.length >= 3)

  // JSON-LD: CollectionPage + ItemList of top games
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metaTitle = t('metaTitle' as any, { name: config.name })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const descText  = t(`desc_${config.msgKey}` as any)
  const breadcrumbLd = buildBreadcrumbLd({
    locale,
    slug,
    platformName: config.name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    homeLabel: tNav('navHome' as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browseLabel: tNav('navBrowse' as any),
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: metaTitle,
    description: descText,
    url: `${SITE_URL}/${locale}/platform/${slug}`,
    mainEntity: {
      '@type': 'ItemList',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: `${t('topRated' as any)} — ${config.name}`,
      numberOfItems: Math.min(topRated.length, 10),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      itemListElement: (topRated as any[]).slice(0, 10).map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: r.title,
        url: `${SITE_URL}/${locale}/game/${r.slug}`,
      })),
    },
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <script
        type="application/ld+json"
        // Escape script-context-breaking sequences. Game titles in itemListElement
        // come from third-party APIs and could in principle contain "</script>".
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') }}
      />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        <BreadcrumbNav
          locale={locale}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          homeLabel={tNav('navHome' as any)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          browseLabel={tNav('navBrowse' as any)}
          platformName={config.name}
        />

        {/* Hero — platform banner */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-700 shadow-lg bg-slate-900">
          <div className={`absolute inset-0 bg-gradient-to-br ${config.accent}`} />
          <div className="relative px-6 py-7 flex items-center gap-5">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ${config.iconBg} ring-2 flex items-center justify-center shrink-0 shadow-lg`}>
              <Icon name={config.iconName} size={48} className="text-white" label={config.name} />
            </div>
            <div className="flex-1 min-w-0">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <span className="inline-block text-[11px] font-semibold bg-white/10 text-white/70 border border-white/20 px-2 py-0.5 rounded-full tracking-wide uppercase mb-1.5">
                {t('badge' as any)}
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{config.name}</h1>
              <p className="text-sm text-white/70 mt-1 line-clamp-2">{descText}</p>
            </div>
          </div>
        </div>

        {/* Average LumiScore — circle hero */}
        {avgScore != null && (
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 px-6 pt-6 pb-6 text-center">
            <Link
              href={`/${locale}/browse?platforms=${config.browseKey}`}
              className="absolute top-3 right-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-600 hover:border-indigo-400 rounded-full px-2.5 py-1 transition-colors"
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {t('browseAll' as any)}
            </Link>

            <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
              Average LumiScore
            </p>

            <div
              className={`leading-none font-bold tabular-nums ${curascoreText(avgScore)}`}
              style={{ fontFamily: "Georgia, 'Iowan Old Style', serif", fontSize: 'clamp(64px, 14vw, 96px)' }}
            >
              {avgScore}
            </div>

            <p
              className="text-sm text-slate-400 dark:text-slate-500 mt-2"
              style={{ fontVariant: 'small-caps', letterSpacing: '0.06em' }}
            >
              out of 100
            </p>

            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              across <span className="font-bold text-slate-700 dark:text-slate-200">{scoredCount}</span> rated {config.name} games
            </p>
          </div>
        )}

        {/* Growth + Risk pillars */}
        {scoredCount > 0 && avgBds != null && avgRis != null && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-3xl p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-200 dark:bg-green-800 rounded-xl flex items-center justify-center">
                  <Sparkles size={16} className="text-green-700 dark:text-green-300" strokeWidth={2.5} />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-green-700 dark:text-green-400">Avg Growth</p>
              </div>
              <p className="text-3xl font-black tracking-tighter text-green-900 dark:text-green-200">
                {Math.round(avgBds * 100)}
                <span className="text-base font-bold text-green-600 dark:text-green-400">/100</span>
              </p>
              <p className="text-xs font-semibold text-green-700 dark:text-green-400">Benefit Density</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-3xl p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-200 dark:bg-orange-800 rounded-xl flex items-center justify-center">
                  <Zap size={16} className="text-orange-700 dark:text-orange-300" strokeWidth={2.5} />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-orange-700 dark:text-orange-400">Avg Risk</p>
              </div>
              <p className="text-3xl font-black tracking-tighter text-orange-900 dark:text-orange-200">
                {Math.round(avgRis * 100)}
                <span className="text-base font-bold text-orange-600 dark:text-orange-400">/100</span>
              </p>
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">Engagement Hooks</p>
            </div>
          </div>
        )}

        {/* Stats strip */}
        {scoredCount > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-center">
              <Gamepad2 size={16} className="mx-auto mb-1 text-slate-400 dark:text-slate-500" />
              <p className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">{scoredCount}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Games rated</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-center">
              <ShieldCheck size={16} className="mx-auto mb-1 text-emerald-500" />
              <p className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">{safestCount}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Safest picks</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-center">
              <Trophy size={16} className="mx-auto mb-1 text-amber-500" />
              <p className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">{maxScore ?? '—'}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Top score</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-center">
              <Clock size={16} className="mx-auto mb-1 text-blue-500" />
              <p className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">{avgTime ?? '—'}<span className="text-xs font-bold">m</span></p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Avg time/day</p>
            </div>
          </div>
        )}

        {/* Top pick highlight */}
        {topGame && topGame.curascore != null && (
          <Link
            href={`/${locale}/game/${topGame.slug}`}
            className="block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 rounded-2xl overflow-hidden transition-colors group"
          >
            <div className="flex items-center gap-3 p-3">
              {topGame.backgroundImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={topGame.backgroundImage} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Trophy size={11} strokeWidth={2.5} /> Highest-rated {config.name} pick
                </p>
                <p className="text-base font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {topGame.title}
                </p>
                {topGame.developer && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{topGame.developer}</p>
                )}
              </div>
              <div className={`shrink-0 text-2xl font-black tabular-nums ${curascoreText(topGame.curascore)}`} style={{ fontFamily: "Georgia, 'Iowan Old Style', serif" }}>
                {topGame.curascore}
              </div>
            </div>
          </Link>
        )}

        {/* Score distribution */}
        {scoredCount > 0 && (
          <PlatformScoreHistogram
            buckets={buckets}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            scoreDistributionLabel={t('scoreDistribution' as any)}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            scoredSuffix={t('scoredSuffix' as any)}
          />
        )}

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {scoredCount === 0 && (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {t('noGames' as any)}
          </div>
        )}

        {/* Editorial intro — crawlable context for search engines */}
        {scoredCount > 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {t(`editorial_${config.msgKey}` as any)}
          </p>
        )}

        {/* Carousels */}
        {carouselRows.length > 0 && (
          <div className="pb-4">
            {carouselRows.map((row, i) => (
              <CarouselRow
                key={row.id}
                index={i}
                iconName={row.iconName}
                title={row.title}
                browseHref={row.browseHref}
                games={row.games}
              />
            ))}
          </div>
        )}

      </main>
    </div>
  )
}

// ─── UGC platform page ────────────────────────────────────────────────────────
export default async function PlatformHubPage({ params }: Props) {
  const { locale, slug } = await params

  // Traditional gaming platform
  const traditional = TRADITIONAL_PLATFORMS[slug]
  if (traditional) {
    return <TraditionalPlatformPage slug={slug} locale={locale} config={traditional} />
  }

  // UGC platform (Roblox, Fortnite Creative, etc.)
  const [t, tNav] = await Promise.all([
    getTranslations({ locale, namespace: 'platform' }),
    getTranslations({ locale, namespace: 'game' }),
  ])
  const dbSlug = SLUG_ALIASES[slug] ?? slug

  const [
    platformRows,
    [statsRow],
    bucketRows,
    topRows,
    bottomRows,
    recentRows,
  ] = await Promise.all([
    db
      .select({
        id:              games.id,
        slug:            games.slug,
        title:           games.title,
        description:     games.description,
        backgroundImage: games.backgroundImage,
        esrbRating:      games.esrbRating,
        pegiRating:      games.pegiRating,
        contentType:     games.contentType,
      })
      .from(games)
      .where(eq(games.slug, dbSlug))
      .limit(1),

    db
      .select({
        count:        sql<number>`count(${experienceScores.id})::int`,
        avgScore:     sql<number>`round(avg(${experienceScores.curascore}))::int`,
        maxScore:     sql<number>`max(${experienceScores.curascore})::int`,
        avgBds:       sql<number>`avg(${experienceScores.benefitScore})`,
        avgRis:       sql<number>`avg(${experienceScores.riskScore})`,
        avgTime:      sql<number>`round(avg(${experienceScores.timeRecommendationMinutes}))::int`,
        safestCount:  sql<number>`count(*) filter (where ${experienceScores.riskScore} <= 0.25)::int`,
      })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore))),

    db
      .select({
        bucket: sql<number>`floor(${experienceScores.curascore} / 10) * 10`,
        count:  sql<number>`count(*)::int`,
      })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore)))
      .groupBy(sql`floor(${experienceScores.curascore} / 10) * 10`)
      .orderBy(sql`floor(${experienceScores.curascore} / 10) * 10`),

    db
      .select({ exp: platformExperiences, score: experienceScores })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore)))
      .orderBy(desc(experienceScores.curascore))
      .limit(10),

    db
      .select({ exp: platformExperiences, score: experienceScores })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore)))
      .orderBy(asc(experienceScores.curascore))
      .limit(10),

    db
      .select({ exp: platformExperiences, score: experienceScores })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore)))
      .orderBy(desc(experienceScores.calculatedAt))
      .limit(10),
  ])

  const platform = platformRows[0]
  if (!platform || platform.contentType !== 'platform') notFound()

  const buckets = bucketRows as HistogramBucket[]
  const topExperiences    = topRows.map(r    => toExperienceSummary(r.exp, r.score))
  const bottomExperiences = bottomRows.map(r => toExperienceSummary(r.exp, r.score))
  const recentExperiences = recentRows.map(r => toExperienceSummary(r.exp, r.score))

  const scoredCount  = Number(statsRow?.count ?? 0)
  const avgScore     = statsRow?.avgScore ?? null
  const maxScore     = statsRow?.maxScore ?? null
  const avgBds       = statsRow?.avgBds != null ? Number(statsRow.avgBds) : null
  const avgRis       = statsRow?.avgRis != null ? Number(statsRow.avgRis) : null
  const avgTime      = statsRow?.avgTime ?? null
  const safestCount  = Number(statsRow?.safestCount ?? 0)
  const topExperience = topExperiences[0] ?? null
  const accent       = UGC_ACCENT[dbSlug] ?? 'from-slate-950/95 via-slate-900/70 to-slate-900/20'
  const iconBg       = UGC_ICON_BG[dbSlug] ?? 'bg-indigo-600 ring-indigo-400/40'
  const iconName     = UGC_ICON_NAME[dbSlug] ?? null
  const initials     = platform.title.slice(0, 2).toUpperCase()

  const breadcrumbLd = buildBreadcrumbLd({
    locale,
    slug,
    platformName: platform.title,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    homeLabel: tNav('navHome' as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browseLabel: tNav('navBrowse' as any),
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') }}
      />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        <BreadcrumbNav
          locale={locale}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          homeLabel={tNav('navHome' as any)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          browseLabel={tNav('navBrowse' as any)}
          platformName={platform.title}
        />

        {/* Platform hero */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-700 shadow-lg bg-slate-900">
          {platform.backgroundImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={platform.backgroundImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          )}
          <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
          <div className="relative px-6 py-7 flex items-center gap-5">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ${iconBg} ring-2 flex items-center justify-center shrink-0 shadow-lg`}>
              {iconName ? (
                <Icon name={iconName} size={48} className="text-white" label={platform.title} />
              ) : (
                <span className="text-3xl font-black text-white select-none">{initials}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span className="inline-block text-[11px] font-semibold bg-white/10 text-white/70 border border-white/20 px-2 py-0.5 rounded-full tracking-wide uppercase mb-1.5">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {t('badge' as any)}
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{platform.title}</h1>
              {platform.description && (
                <p className="text-sm text-white/70 mt-1 line-clamp-2">{platform.description}</p>
              )}
              {(platform.esrbRating || platform.pegiRating) && (
                <div className="flex items-center gap-2 mt-2">
                  {platform.esrbRating && (
                    <span className="text-[10px] font-bold bg-white/10 border border-white/15 text-white/70 px-2 py-0.5 rounded-full">
                      ESRB {platform.esrbRating}
                    </span>
                  )}
                  {platform.pegiRating && (
                    <span className="text-[10px] font-bold bg-white/10 border border-white/15 text-white/70 px-2 py-0.5 rounded-full">
                      PEGI {platform.pegiRating}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Average LumiScore — circle hero */}
        {avgScore != null && (
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 px-6 pt-6 pb-6 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
              Average LumiScore
            </p>
            <div
              className={`leading-none font-bold tabular-nums ${curascoreText(avgScore)}`}
              style={{ fontFamily: "Georgia, 'Iowan Old Style', serif", fontSize: 'clamp(64px, 14vw, 96px)' }}
            >
              {avgScore}
            </div>
            <p
              className="text-sm text-slate-400 dark:text-slate-500 mt-2"
              style={{ fontVariant: 'small-caps', letterSpacing: '0.06em' }}
            >
              out of 100
            </p>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              across <span className="font-bold text-slate-700 dark:text-slate-200">{scoredCount}</span> scored experiences
            </p>
          </div>
        )}

        {/* Growth + Risk pillars */}
        {scoredCount > 0 && avgBds != null && avgRis != null && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-3xl p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-200 dark:bg-green-800 rounded-xl flex items-center justify-center">
                  <Sparkles size={16} className="text-green-700 dark:text-green-300" strokeWidth={2.5} />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-green-700 dark:text-green-400">Avg Growth</p>
              </div>
              <p className="text-3xl font-black tracking-tighter text-green-900 dark:text-green-200">
                {Math.round(avgBds * 100)}
                <span className="text-base font-bold text-green-600 dark:text-green-400">/100</span>
              </p>
              <p className="text-xs font-semibold text-green-700 dark:text-green-400">Benefit Density</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-3xl p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-200 dark:bg-orange-800 rounded-xl flex items-center justify-center">
                  <Zap size={16} className="text-orange-700 dark:text-orange-300" strokeWidth={2.5} />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-orange-700 dark:text-orange-400">Avg Risk</p>
              </div>
              <p className="text-3xl font-black tracking-tighter text-orange-900 dark:text-orange-200">
                {Math.round(avgRis * 100)}
                <span className="text-base font-bold text-orange-600 dark:text-orange-400">/100</span>
              </p>
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">Engagement Hooks</p>
            </div>
          </div>
        )}

        {/* Stats strip */}
        {scoredCount > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-center">
              <Gamepad2 size={16} className="mx-auto mb-1 text-slate-400 dark:text-slate-500" />
              <p className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">{scoredCount}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Experiences</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-center">
              <ShieldCheck size={16} className="mx-auto mb-1 text-emerald-500" />
              <p className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">{safestCount}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Safest picks</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-center">
              <Trophy size={16} className="mx-auto mb-1 text-amber-500" />
              <p className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">{maxScore ?? '—'}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Top score</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-center">
              <Clock size={16} className="mx-auto mb-1 text-blue-500" />
              <p className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">{avgTime ?? '—'}<span className="text-xs font-bold">m</span></p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Avg time/day</p>
            </div>
          </div>
        )}

        {/* Top pick highlight */}
        {topExperience && topExperience.curascore != null && (
          <Link
            href={`/${locale}/game/${dbSlug}/${topExperience.slug}`}
            className="block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 rounded-2xl overflow-hidden transition-colors group"
          >
            <div className="flex items-center gap-3 p-3">
              {topExperience.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={topExperience.thumbnailUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Trophy size={11} strokeWidth={2.5} /> Highest-rated {platform.title} experience
                </p>
                <p className="text-base font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {topExperience.title}
                </p>
                {topExperience.creatorName && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{topExperience.creatorName}</p>
                )}
              </div>
              <div className={`shrink-0 text-2xl font-black tabular-nums ${curascoreText(topExperience.curascore)}`} style={{ fontFamily: "Georgia, 'Iowan Old Style', serif" }}>
                {topExperience.curascore}
              </div>
            </div>
          </Link>
        )}

        {/* Score distribution histogram */}
        {scoredCount > 0 && (
          <PlatformScoreHistogram
            buckets={buckets}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            scoreDistributionLabel={t('scoreDistribution' as any)}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            scoredSuffix={t('scoredSuffix' as any)}
          />
        )}

        {scoredCount === 0 && (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            No scored experiences yet. Check back soon.
          </div>
        )}

        {/* Top rated */}
        {topExperiences.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {t('topRated' as any)}
            </h2>
            <ExperienceGrid
              experiences={topExperiences}
              locale={locale}
              platformSlug={dbSlug}
            />
          </section>
        )}

        {/* Lowest rated */}
        {bottomExperiences.length > 0 && scoredCount >= 4 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {t('lowestRated' as any)}
            </h2>
            <ExperienceGrid
              experiences={bottomExperiences}
              locale={locale}
              platformSlug={dbSlug}
            />
          </section>
        )}

        {/* Recently scored */}
        {recentExperiences.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {t('recent' as any)}
            </h2>
            <ExperienceGrid
              experiences={recentExperiences}
              locale={locale}
              platformSlug={dbSlug}
            />
          </section>
        )}

      </main>
    </div>
  )
}
