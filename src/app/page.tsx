export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { eq, desc, lte, gte, isNotNull, sql, and, or, type SQL } from 'drizzle-orm'
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

async function getCarouselRows(platforms: string[], age?: string): Promise<CarouselRow[]> {
  const platformFilter: SQL | undefined = platforms.length > 0
    ? or(...platforms.map(p => sql`${games.platforms}::text ILIKE ${'%' + p + '%'}`))
    : undefined

  // When no age is selected, default to family-friendly (E / E10+ / T).
  // M-rated games are only shown when the parent explicitly picks "17+ Mature".
  const ratings = ESRB_FOR_AGE[age ?? ''] ?? ['E', 'E10+', 'T']
  const ageFilter: SQL = age
    ? sql`${games.esrbRating} = ANY(ARRAY[${sql.join(ratings.map(r => sql`${r}`), sql`, `)}])`
    : sql`(${games.esrbRating} IS NULL OR ${games.esrbRating} = ANY(ARRAY[${sql.join(ratings.map(r => sql`${r}`), sql`, `)}]))`

  const base = (extra?: SQL) => and(isNotNull(gameScores.curascore), platformFilter, ageFilter, extra)

  const [topRated, coopPlay, lowRisk, highBenefit, teamwork] = await Promise.all([

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
  ])

  const rows: CarouselRow[] = [
    { id: 'top',      title: 'Top rated',          emoji: '⭐', browseHref: '/browse?sort=curascore',            games: topRated.map(toSummary)  },
    { id: 'coop',     title: 'Play together',      emoji: '👨‍👩‍👧', browseHref: '/browse?benefits=teamwork',            games: coopPlay.map(toSummary)  },
    { id: 'safe',     title: 'Low risk picks',     emoji: '✅', browseHref: '/browse?risk=low',                  games: lowRisk.map(toSummary)   },
    { id: 'brain',    title: 'Build your brain',   emoji: '🧠', browseHref: '/browse?benefits=problem-solving',  games: highBenefit.map(toSummary) },
    { id: 'teamwork', title: 'Team up',             emoji: '🤝', browseHref: '/browse?benefits=teamwork',         games: teamwork.map(toSummary)  },
  ]

  return rows.filter(r => r.games.length > 0)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = { searchParams: Record<string, string | string[] | undefined> }

export default async function HomePage({ searchParams }: Props) {
  const platformParam = typeof searchParams.platform === 'string' ? searchParams.platform : ''
  const platforms = platformParam ? platformParam.split(',').filter(Boolean) : []
  const age       = typeof searchParams.age === 'string' ? searchParams.age : undefined
  const carousels = await getCarouselRows(platforms, age)

  return (
    <div className="bg-slate-50">
      <main className="max-w-4xl mx-auto px-4 overflow-x-hidden">

        {/* Hero */}
        <section className="py-12 sm:py-16 text-center space-y-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
            Grounded in child development
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
            Game ratings that go{' '}
            <span className="text-indigo-600">beyond the age label</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
            Every Curascore reflects what a game actually does to a developing mind —
            the skills it builds, the habits it forms, and how much daily play makes sense.
          </p>
          <div className="max-w-xl mx-auto pt-4">
            <SearchBar placeholder="Search 500+ games…" />
          </div>
        </section>

        {/* Age + Platform pickers */}
        <section className="pb-10 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Your child&apos;s age
            </p>
          </div>
          <AgePicker current={age} />

          <div className="flex items-center justify-between pt-1">
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
          <div className="grid sm:grid-cols-3 gap-10">
            {[
              { icon: '🧠', title: 'Developmental lens',       body: 'Our scoring framework draws on cognitive science, social-emotional learning, and behavioral development — translated into a single, clear score.' },
              { icon: '⚠️', title: 'Honest about risks',      body: 'We identify dopamine loops, loot boxes, spending pressure, and social mechanics — the design patterns that matter most for developing minds.' },
              { icon: '⏱',  title: 'Time limits that hold up', body: "Each game's daily limit follows from its actual benefit and risk profile. Better games earn more time." },
            ].map((item) => (
              <div key={item.title} className="text-center px-4">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="font-semibold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
