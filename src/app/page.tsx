export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { eq, desc, lte, gte, isNotNull, sql, and, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import SearchBar from '@/components/SearchBar'
import PlatformPicker from '@/components/PlatformPicker'
import AgePicker from '@/components/AgePicker'
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

async function getCarouselRows(platform?: string, age?: string): Promise<CarouselRow[]> {
  const platformFilter: SQL | undefined = platform
    ? sql`${games.platforms}::text ILIKE ${'%' + platform + '%'}`
    : undefined

  const ratings = age ? ESRB_FOR_AGE[age] : undefined
  const ageFilter: SQL | undefined = ratings
    ? sql`${games.esrbRating} = ANY(ARRAY[${sql.join(ratings.map(r => sql`${r}`), sql`, `)}])`
    : undefined

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

// ─── Components ───────────────────────────────────────────────────────────────

function curascoreBg(score: number | null | undefined): string {
  if (score == null) return 'bg-slate-500'
  if (score >= 70) return 'bg-emerald-500'
  if (score >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

function CarouselTile({ game }: { game: GameSummary }) {
  return (
    <Link
      href={`/game/${game.slug}`}
      className="group shrink-0 w-36 sm:w-44"
    >
      {/* Image */}
      <div className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-indigo-100">
        {game.backgroundImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.backgroundImage}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-200">
            <span className="text-2xl font-black text-indigo-300 select-none">
              {game.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        {/* Curascore badge */}
        {game.curascore != null && (
          <span className={`absolute top-1.5 right-1.5 ${curascoreBg(game.curascore)} text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none`}>
            {game.curascore}
          </span>
        )}
        {/* ESRB */}
        {game.esrbRating && (
          <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[9px] font-bold px-1 py-0.5 rounded leading-none">
            {game.esrbRating}
          </span>
        )}
        {/* Time rec */}
        {game.timeRecommendationMinutes != null && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] font-semibold px-1 py-0.5 rounded leading-none">
            {game.timeRecommendationMinutes}m
          </span>
        )}
      </div>
      {/* Title */}
      <p className="mt-2 text-xs font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors leading-tight">
        {game.title}
      </p>
      <p className="text-[10px] text-slate-400 truncate mt-0.5">
        {game.genres[0] ?? game.developer ?? ''}
      </p>
    </Link>
  )
}

function Carousel({ row }: { row: CarouselRow }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <span>{row.emoji}</span>
          <span>{row.title}</span>
        </h2>
        <Link
          href={row.browseHref}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors shrink-0"
        >
          See all →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {row.games.map(game => (
          <CarouselTile key={game.slug} game={game} />
        ))}
      </div>
    </section>
  )
}

const QUICK_LINKS = [
  { label: 'Ages 5–8',     href: '/browse?age=E',                emoji: '🌱' },
  { label: 'Ages 9–12',    href: '/browse?age=E10',              emoji: '🎮' },
  { label: 'Teens',        href: '/browse?age=T',                emoji: '🧩' },
  { label: 'Puzzle',       href: '/browse?genres=Puzzle',        emoji: '🔍' },
  { label: 'Teamwork',     href: '/browse?benefits=teamwork',    emoji: '🤝' },
  { label: 'Strategy',     href: '/browse?genres=Strategy',      emoji: '♟️' },
  { label: 'Low Risk',     href: '/browse?risk=low',             emoji: '✅' },
  { label: 'Free to play', href: '/browse?price=free',           emoji: '🆓' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = { searchParams: Record<string, string | string[] | undefined> }

export default async function HomePage({ searchParams }: Props) {
  const platform = typeof searchParams.platform === 'string' ? searchParams.platform : undefined
  const age      = typeof searchParams.age === 'string' ? searchParams.age : undefined
  const carousels = await getCarouselRows(platform, age)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-indigo-700 tracking-tight">PlaySmart</span>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <a href="/discover" className="hover:text-indigo-700 transition-colors">Discover</a>
            <a href="/browse" className="hover:text-indigo-700 transition-colors">Browse</a>
            <a href="/faq" className="hover:text-indigo-700 transition-colors">How it works</a>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 overflow-x-hidden">

        {/* Hero */}
        <section className="py-10 text-center space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
            Grounded in child development
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
            Game ratings that go{' '}
            <span className="text-indigo-600">beyond the age label</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Every Curascore reflects what a game actually does to a developing mind —
            the skills it builds, the habits it forms, and how much daily play makes sense.
          </p>
          <div className="max-w-xl mx-auto pt-2">
            <SearchBar placeholder="Search 500+ games…" />
          </div>
        </section>

        {/* Age + Platform pickers */}
        <section className="pb-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Your child&apos;s age
            </p>
          </div>
          <AgePicker current={age} />

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Your platform
            </p>
            {(platform || age) && (
              <a href="/" className="text-xs font-normal text-indigo-500 hover:text-indigo-700 transition-colors">
                Clear filters
              </a>
            )}
          </div>
          <PlatformPicker current={platform} />
        </section>

        {/* Quick-filter pills */}
        <section className="pb-6">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {QUICK_LINKS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm text-slate-700 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-colors shadow-sm"
              >
                <span>{c.emoji}</span>
                <span>{c.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Carousels */}
        {carousels.length > 0 ? (
          <div className="space-y-8 pb-12">
            {carousels.map(row => <Carousel key={row.id} row={row} />)}
          </div>
        ) : (
          <div className="text-center py-16 pb-12">
            <p className="text-4xl mb-3">🎮</p>
            {(platform || age) ? (
              <>
                <p className="font-medium text-slate-600">
                  No reviewed games found
                  {age && ` for that age group`}
                  {platform && ` on ${platform}`}
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
        <section className="border-t border-slate-200 py-8 pb-12">
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: '🧠', title: 'Developmental lens',       body: 'Our scoring framework draws on cognitive science, social-emotional learning, and behavioral development — translated into a single, clear score.' },
              { icon: '⚠️', title: 'Honest about risks',      body: 'We identify dopamine loops, loot boxes, spending pressure, and social mechanics — the design patterns that matter most for developing minds.' },
              { icon: '⏱',  title: 'Time limits that hold up', body: "Each game's daily limit follows from its actual benefit and risk profile. Better games earn more time." },
            ].map((item) => (
              <div key={item.title} className="text-center px-2">
                <div className="text-3xl mb-2">{item.icon}</div>
                <h3 className="font-semibold text-slate-800 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        PlaySmart — game ratings for parents ·{' '}
        <a href="/faq" className="hover:text-indigo-600 transition-colors">How it works</a>
      </footer>
    </div>
  )
}
