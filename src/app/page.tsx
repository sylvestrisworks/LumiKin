export const dynamic = 'force-dynamic'

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

type CarouselRow = {
  id: string
  title: string
  emoji: string
  browseHref: string
  games: GameSummary[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VR_KEYWORDS = ['Oculus', 'Quest', 'Vive', 'Rift', 'Valve Index', 'PlayStation VR', 'PSVR', 'Mixed Reality', 'Gear VR']

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

async function getCarouselRows(platforms: string[], age?: string): Promise<CarouselRow[]> {
  const platformFilter: SQL | undefined = platforms.length > 0
    ? or(...platforms.map(p => sql`${games.platforms}::text ILIKE ${'%' + p + '%'}`))
    : undefined

  // When no age is selected, default to family-friendly (E / E10+ / T).
  // M-rated games are only shown when the parent explicitly picks "17+ Mature".
  const ratings = ESRB_FOR_AGE[age ?? ''] ?? ['E', 'E10+', 'T']
  const ageFilter: SQL = age
    ? inArray(games.esrbRating, ratings)
    : or(isNull(games.esrbRating), inArray(games.esrbRating, ratings))!

  const base = (extra?: SQL) => and(isNotNull(gameScores.curascore), platformFilter, ageFilter, extra)

  const [topRated, coopPlay, lowRisk, highBenefit, teamwork, vrGames] = await Promise.all([

    // Top rated overall
    db.select(BASE_SELECT).from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base())
      .orderBy(desc(gameScores.curascore))
      .limit(12),

    // Play together — high social-emotional score (teamwork, communication, empathy)
    db.select(BASE_SELECT).from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base(gte(gameScores.socialEmotionalScore, 0.5)))
      .orderBy(desc(gameScores.socialEmotionalScore))
      .limit(12),

    // Low risk — RIS ≤ 0.30
    db.select(BASE_SELECT).from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base(lte(gameScores.ris, 0.3)))
      .orderBy(desc(gameScores.curascore))
      .limit(12),

    // Build your brain — high cognitive score
    db.select(BASE_SELECT).from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base(gte(gameScores.cognitiveScore, 0.6)))
      .orderBy(desc(gameScores.bds))
      .limit(12),

    // Team up — games with teamwork in topBenefits
    db.select(BASE_SELECT).from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base(sql`${gameScores.topBenefits}::jsonb @> ${JSON.stringify([{ skill: 'Teamwork' }])}::jsonb`))
      .orderBy(desc(gameScores.curascore))
      .limit(12),

    // VR — any game on a known VR platform (ignores age/platform pickers intentionally)
    db.select(BASE_SELECT).from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(and(
        isNotNull(gameScores.curascore),
        or(...VR_KEYWORDS.map(k => sql`${games.platforms}::text ILIKE ${'%' + k + '%'}`)),
      ))
      .orderBy(desc(gameScores.curascore))
      .limit(12),
  ])

  const rows: CarouselRow[] = [
    { id: 'top',      title: 'Top rated',          emoji: '⭐', browseHref: '/browse?sort=curascore',            games: topRated.map(toSummary)  },
    { id: 'coop',     title: 'Play together',      emoji: '👨‍👩‍👧', browseHref: '/browse?benefits=teamwork',            games: coopPlay.map(toSummary)  },
    { id: 'safe',     title: 'Low risk picks',     emoji: '✅', browseHref: '/browse?risk=low',                  games: lowRisk.map(toSummary)   },
    { id: 'brain',    title: 'Build your brain',   emoji: '🧠', browseHref: '/browse?benefits=problem-solving',  games: highBenefit.map(toSummary) },
    { id: 'teamwork', title: 'Team up',             emoji: '🤝', browseHref: '/browse?benefits=teamwork',         games: teamwork.map(toSummary)  },
    { id: 'vr',       title: 'VR & AR',             emoji: '🥽', browseHref: '/browse?platforms=VR',               games: vrGames.map(toSummary)   },
  ]

  return rows.filter(r => r.games.length > 0)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = { searchParams: Record<string, string | string[] | undefined> }

export default async function HomePage({ searchParams }: Props) {
  const platformParam = typeof searchParams.platform === 'string' ? searchParams.platform : ''
  const platforms = platformParam ? platformParam.split(',').filter(Boolean) : []
  const age       = typeof searchParams.age === 'string' ? searchParams.age : undefined

  const [carousels, stats] = await Promise.all([
    getCarouselRows(platforms, age),
    getStats(),
  ])

  return (
    <div className="bg-slate-50">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="hero-gradient relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          <div className="float-1 absolute top-8 left-[8%]  text-4xl opacity-30">🎮</div>
          <div className="float-2 absolute top-12 right-[12%] text-3xl opacity-25">🧠</div>
          <div className="float-3 absolute bottom-10 left-[20%] text-3xl opacity-20">⭐</div>
          <div className="float-1 absolute bottom-8 right-[22%] text-2xl opacity-25">🛡️</div>
          {/* Large blurred circles for depth */}
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-violet-300/20 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 py-14 sm:py-20 text-center space-y-5">
          <p className="inline-block text-xs font-bold uppercase tracking-widest text-white/70 bg-white/10 px-3 py-1 rounded-full border border-white/20">
            Grounded in child development
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight">
            Game ratings that go{' '}
            <span className="text-yellow-300 drop-shadow-sm">beyond the age label</span>
          </h1>
          <p className="text-white/80 text-lg max-w-xl mx-auto leading-relaxed">
            Every Curascore reflects what a game actually does to a developing mind —
            the skills it builds, the habits it forms, and how much daily play makes sense.
          </p>
          <div className="max-w-xl mx-auto pt-2">
            <SearchBar placeholder={`Search ${stats.scoredGames}+ reviewed games…`} />
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            {[
              { value: stats.scoredGames,  label: 'games reviewed'  },
              { value: stats.lowRiskGames, label: 'low-risk picks'  },
              { value: '5',                label: 'scoring rubrics' },
            ].map(s => (
              <div key={s.label} className="stat-shimmer flex flex-col items-center bg-white/10 border border-white/20 rounded-2xl px-5 py-3 backdrop-blur-sm">
                <span className="text-2xl font-extrabold text-white">{s.value}</span>
                <span className="text-xs text-white/70 font-medium mt-0.5">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 overflow-x-hidden">

        {/* Age + Platform pickers */}
        <section className="pt-10 pb-6 space-y-4 text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Your child&apos;s age
          </p>
          <AgePicker current={age} />

          <div className="flex items-center justify-center gap-3 pt-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Your platforms
            </p>
            {(platforms.length > 0 || age) && (
              <a href="/" className="text-xs font-normal text-indigo-500 hover:text-indigo-700 transition-colors">
                Clear filters
              </a>
            )}
          </div>
          <PlatformPicker current={platforms} />
        </section>

        {/* Carousels */}
        {carousels.length > 0 ? (
          <div className="pb-16">
            {carousels.map((row, i) => (
              <CarouselRow key={row.id} index={i} emoji={row.emoji} title={row.title} browseHref={row.browseHref} games={row.games} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 pb-12">
            <p className="text-4xl mb-3">🎮</p>
            {(platforms.length > 0 || age) ? (
              <>
                <p className="font-medium text-slate-600">
                  No reviewed games found
                  {age && ` for that age group`}
                  {platforms.length > 0 && ` on ${platforms.join(' / ')}`}
                </p>
                <a href="/" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
                  Clear filters
                </a>
              </>
            ) : (
              <>
                <p className="font-medium text-slate-600">Game ratings coming soon</p>
                <p className="text-sm text-slate-400 mt-1">We&apos;re reviewing games now — check back shortly.</p>
              </>
            )}
          </div>
        )}

        {/* About */}
        <section className="border-t border-slate-200 py-14 pb-16">
          <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest mb-8">
            How it works
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: '🧠',
                gradient: 'from-indigo-500 to-violet-600',
                title: 'Developmental lens',
                body: 'Our scoring framework draws on cognitive science, social-emotional learning, and behavioral development — translated into a single, clear score.',
              },
              {
                icon: '⚠️',
                gradient: 'from-amber-500 to-orange-500',
                title: 'Honest about risks',
                body: 'We identify dopamine loops, loot boxes, spending pressure, and social mechanics — the design patterns that matter most for developing minds.',
              },
              {
                icon: '⏱',
                gradient: 'from-emerald-500 to-teal-600',
                title: 'Time limits that hold up',
                body: "Each game's daily limit follows from its actual benefit and risk profile. Better games earn more time.",
              },
            ].map((item) => (
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
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow-sm transition-colors"
            >
              Browse all games
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/faq"
              className="ml-4 inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium text-sm transition-colors"
            >
              How does scoring work?
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
