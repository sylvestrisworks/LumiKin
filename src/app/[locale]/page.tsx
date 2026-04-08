export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { eq, desc, lte, gte, isNotNull, isNull, inArray, sql, and, or, count, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import SearchBar from '@/components/SearchBar'
import PlatformPicker from '@/components/PlatformPicker'
import AgePicker from '@/components/AgePicker'
import CarouselRow from '@/components/CarouselRow'
import type { GameSummary } from '@/types/game'

// ─── Age → ESRB mapping ───────────────────────────────────────────────────────

const ESRB_FOR_AGE: Record<string, string[]> = {
  E:   ['E'],
  E10: ['E', 'E10+'],
  T:   ['E', 'E10+', 'T'],
  M:   ['T', 'M'],
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CarouselRowData = {
  id: string
  title: string
  emoji: string
  browseHref: string
  games: GameSummary[]
}

// ─── Data fetching ────────────────────────────────────────────────────────────

const BASE_SELECT = {
  slug:            games.slug,
  title:           games.title,
  developer:       games.developer,
  genres:          games.genres,
  esrbRating:      games.esrbRating,
  backgroundImage: games.backgroundImage,
  metacriticScore: games.metacriticScore,
  curascore:       gameScores.curascore,
  timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
  timeRecommendationColor:   gameScores.timeRecommendationColor,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSummary(r: any): GameSummary {
  return {
    slug:            r.slug,
    title:           r.title,
    developer:       r.developer ?? null,
    genres:          (r.genres as string[]) ?? [],
    esrbRating:      r.esrbRating ?? null,
    backgroundImage: r.backgroundImage ?? null,
    metacriticScore: r.metacriticScore ?? null,
    curascore:       r.curascore ?? null,
    timeRecommendationMinutes: r.timeRecommendationMinutes ?? null,
    timeRecommendationColor:   (r.timeRecommendationColor ?? null) as 'green' | 'amber' | 'red' | null,
  }
}

async function getStats() {
  const [totalGames, scoredGames, lowRiskGames] = await Promise.all([
    db.select({ n: count() }).from(games).then(r => r[0]?.n ?? 0),
    db.select({ n: count() }).from(gameScores).where(isNotNull(gameScores.curascore)).then(r => r[0]?.n ?? 0),
    db.select({ n: count() }).from(gameScores).where(and(isNotNull(gameScores.curascore), lte(gameScores.ris, 0.3))).then(r => r[0]?.n ?? 0),
  ])
  return { totalGames, scoredGames, lowRiskGames }
}

async function getCarouselRows(platforms: string[], age?: string, locale = 'en'): Promise<CarouselRowData[]> {
  const platformFilter: SQL | undefined = platforms.length > 0
    ? or(...platforms.map(p => sql`${games.platforms}::text ILIKE ${'%' + p + '%'}`))
    : undefined

  const ratings = ESRB_FOR_AGE[age ?? ''] ?? ['E', 'E10+', 'T']
  const ageFilter: SQL = age
    ? inArray(games.esrbRating, ratings)
    : or(isNull(games.esrbRating), inArray(games.esrbRating, ratings))!

  const base = (extra?: SQL) => and(isNotNull(gameScores.curascore), platformFilter, ageFilter, extra)

  const [topRated, coopPlay, lowRisk, highBenefit, teamwork, vrGames, beginnerGames] = await Promise.all([
    db.select(BASE_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(base()).orderBy(desc(gameScores.curascore)).limit(12),
    db.select(BASE_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(base(gte(gameScores.socialEmotionalScore, 0.5))).orderBy(desc(gameScores.socialEmotionalScore)).limit(12),
    db.select(BASE_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(base(lte(gameScores.ris, 0.3))).orderBy(desc(gameScores.curascore)).limit(12),
    db.select(BASE_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(base(gte(gameScores.cognitiveScore, 0.6))).orderBy(desc(gameScores.bds)).limit(12),
    db.select(BASE_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(base(sql`${gameScores.topBenefits}::jsonb @> ${JSON.stringify([{ skill: 'Teamwork' }])}::jsonb`)).orderBy(desc(gameScores.curascore)).limit(12),
    db.select(BASE_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(and(isNotNull(gameScores.curascore), eq(games.isVr, true), ageFilter)).orderBy(desc(gameScores.curascore)).limit(12),
    db.select(BASE_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(and(isNotNull(gameScores.curascore), ageFilter, platformFilter, inArray(games.esrbRating, ['E', 'E10+']), lte(gameScores.ris, 0.25), gte(gameScores.curascore, 55))).orderBy(desc(gameScores.curascore)).limit(12),
  ])

  const browseBase = `/${locale}/browse`

  const rows: CarouselRowData[] = [
    { id: 'top',      title: 'The Highest Curascores', emoji: '⭐', browseHref: `${browseBase}?sort=curascore`,           games: topRated.map(toSummary)    },
    { id: 'coop',     title: 'Family Co-Op',           emoji: '👨‍👩‍👧', browseHref: `${browseBase}?benefits=teamwork`,           games: coopPlay.map(toSummary)    },
    { id: 'safe',     title: 'Safe & Stress-Free',     emoji: '✅', browseHref: `${browseBase}?risk=low`,                 games: lowRisk.map(toSummary)     },
    { id: 'brain',    title: 'Sneaky Smart Games',     emoji: '🧠', browseHref: `${browseBase}?benefits=problem-solving`, games: highBenefit.map(toSummary) },
    { id: 'teamwork', title: 'Team up',                emoji: '🤝', browseHref: `${browseBase}?benefits=teamwork`,        games: teamwork.map(toSummary)    },
    { id: 'vr',       title: 'VR & AR',                emoji: '🥽', browseHref: `${browseBase}?platforms=VR`,             games: vrGames.map(toSummary)     },
    { id: 'beginner', title: 'New to gaming',          emoji: '🎯', browseHref: `${browseBase}?age=E&risk=low`,           games: beginnerGames.map(toSummary) },
  ]

  return rows.filter(r => r.games.length > 0)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const t = await getTranslations({ locale, namespace: 'home' })

  const platformParam = typeof sp.platform === 'string' ? sp.platform : ''
  const platforms = platformParam ? platformParam.split(',').filter(Boolean) : []
  const age       = typeof sp.age === 'string' ? sp.age : undefined

  const [carousels, stats] = await Promise.all([
    getCarouselRows(platforms, age, locale),
    getStats(),
  ])

  const CAROUSEL_TITLES: Record<string, string> = {
    top:      t('carouselTop'),
    coop:     t('carouselCoop'),
    safe:     t('carouselSafe'),
    brain:    t('carouselBrain'),
    teamwork: t('carouselTeamwork'),
    vr:       t('carouselVr'),
    beginner: t('carouselBeginner'),
  }

  const HOW_IT_WORKS = [
    { icon: '🧠', gradient: 'from-indigo-500 to-violet-600', title: t('featureScience'),  body: t('featureScienceBody') },
    { icon: '⚠️', gradient: 'from-amber-500 to-orange-500',  title: t('featureAgenda'),   body: t('featureAgendaBody')  },
    { icon: '⏱',  gradient: 'from-emerald-500 to-teal-600',  title: t('featureTime'),     body: t('featureTimeBody')    },
  ]

  return (
    <div className="bg-slate-50">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="hidden sm:block absolute inset-0 pointer-events-none select-none overflow-hidden">
          <div className="float-1 absolute top-8 left-[8%]  text-4xl opacity-30">🎮</div>
          <div className="float-2 absolute top-12 right-[12%] text-3xl opacity-25">🧠</div>
          <div className="float-3 absolute bottom-10 left-[20%] text-3xl opacity-20">⭐</div>
          <div className="float-1 absolute bottom-8 right-[22%] text-2xl opacity-25">🛡️</div>
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-violet-300/20 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 py-14 sm:py-20 text-center space-y-5">
          <p className="inline-block text-xs font-bold uppercase tracking-widest text-white/70 bg-white/10 px-3 py-1 rounded-full border border-white/20">
            {t('badge')}
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight">
            {t.rich('hero', {
              yellow: (chunks) => <span className="text-yellow-300 drop-shadow-sm">{chunks}</span>,
            })}
          </h1>
          <p className="text-white/80 text-lg max-w-xl mx-auto leading-relaxed">
            {t('heroSub')}
          </p>
          <div className="max-w-xl mx-auto pt-2">
            <SearchBar placeholder={t('searchPlaceholder', { count: stats.scoredGames })} />
          </div>

          {/* Stats row */}
          <div className="flex justify-center gap-2 sm:gap-3 pt-4">
            {[
              { value: stats.scoredGames,  label: t('statsGamesReviewed') },
              { value: stats.lowRiskGames, label: t('statsLowRisk')       },
              { value: '5',                label: t('statsScoringRubrics') },
            ].map(s => (
              <div key={s.label} className="stat-shimmer flex flex-col items-center bg-white/10 border border-white/20 rounded-2xl px-3 sm:px-5 py-3 backdrop-blur-sm">
                <span className="text-xl sm:text-2xl font-extrabold text-white">{s.value}</span>
                <span className="text-[11px] sm:text-xs text-white/70 font-medium mt-0.5">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 overflow-x-hidden">

        {/* Age + Platform pickers */}
        <section className="pt-10 pb-6 space-y-4 text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {t('yourChildsAge')}
          </p>
          <AgePicker current={age} />

          <div className="flex items-center justify-center gap-3 pt-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {t('yourPlatforms')}
            </p>
            {(platforms.length > 0 || age) && (
              <a href={`/${locale}`} className="text-xs font-normal text-indigo-500 hover:text-indigo-700 transition-colors">
                {t('clearFilters')}
              </a>
            )}
          </div>
          <PlatformPicker current={platforms} />
        </section>

        {/* Carousels */}
        {carousels.length > 0 ? (
          <div className="pb-16">
            {carousels.map((row, i) => (
              <CarouselRow
                key={row.id}
                index={i}
                emoji={row.emoji}
                title={CAROUSEL_TITLES[row.id] ?? row.title}
                browseHref={row.browseHref}
                games={row.games}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 pb-12">
            <p className="text-4xl mb-3">🎮</p>
            {(platforms.length > 0 || age) ? (
              <>
                <p className="font-medium text-slate-600">
                  {t('noGamesFound')}
                  {age && ` ${t('noGamesForAge')}`}
                  {platforms.length > 0 && ` ${t('noGamesOnPlatform', { platforms: platforms.join(' / ') })}`}
                </p>
                <a href={`/${locale}`} className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
                  {t('clearFilters')}
                </a>
              </>
            ) : (
              <>
                <p className="font-medium text-slate-600">{t('comingSoon')}</p>
                <p className="text-sm text-slate-400 mt-1">{t('comingSoonSub')}</p>
              </>
            )}
          </div>
        )}

        {/* About */}
        <section className="border-t border-slate-200 py-14 pb-16">
          <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest mb-8">
            {t('howItWorksLabel')}
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-2xl mb-4 shadow-sm`}>
                  {item.icon}
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                href={`/${locale}/browse`}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow-sm transition-colors"
              >
                {t('browseAll')}
                <span aria-hidden>→</span>
              </Link>
              <Link
                href={`/${locale}/faq`}
                className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium text-sm transition-colors"
              >
                {t('howScoring')}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
