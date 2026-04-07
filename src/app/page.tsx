export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { eq, desc, isNotNull, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import SearchBar from '@/components/SearchBar'
import { curascoreBg } from '@/lib/ui'
import type { GameSummary } from '@/types/game'

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
  bds:             gameScores.bds,
  timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
  timeRecommendationColor:   gameScores.timeRecommendationColor,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): GameSummary {
  return {
    slug:            r.slug,
    title:           r.title,
    developer:       r.developer,
    genres:          (r.genres as string[]) ?? [],
    esrbRating:      r.esrbRating,
    backgroundImage: r.backgroundImage,
    metacriticScore: r.metacriticScore,
    curascore:       r.curascore,
    bds:             r.bds,
    timeRecommendationMinutes: r.timeRecommendationMinutes,
    timeRecommendationColor:   r.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
  }
}

async function getShelves() {
  const q = () => db.select(BASE_SELECT).from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))

  const [topRated, youngKids, noSpending, buildSkills] = await Promise.all([
    // 1. Top rated — best curascore overall
    q().where(isNotNull(gameScores.curascore))
      .orderBy(desc(gameScores.curascore)).limit(10),

    // 2. Great for young kids — E or E10+, best curascore
    q().where(and(
      isNotNull(gameScores.curascore),
      inArray(games.esrbRating, ['E', 'E10+']),
    )).orderBy(desc(gameScores.curascore)).limit(10),

    // 3. No spending pressure — no microtransactions, best curascore
    q().where(and(
      isNotNull(gameScores.curascore),
      eq(games.hasMicrotransactions, false),
    )).orderBy(desc(gameScores.curascore)).limit(10),

    // 4. Builds real skills — highest BDS
    q().where(isNotNull(gameScores.bds))
      .orderBy(desc(gameScores.bds)).limit(10),
  ])

  return {
    topRated:   topRated.map(mapRow),
    youngKids:  youngKids.map(mapRow),
    noSpending: noSpending.map(mapRow),
    buildSkills: buildSkills.map(mapRow),
  }
}

// ─── GameTile ─────────────────────────────────────────────────────────────────

function GameTile({ game }: { game: GameSummary }) {
  return (
    <Link
      href={`/game/${game.slug}`}
      className="group w-40 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden
        hover:shadow-md hover:border-indigo-300 hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative h-24 bg-indigo-100 overflow-hidden">
        {game.backgroundImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.backgroundImage}
            alt={game.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100">
            <span className="text-2xl font-black text-indigo-300 select-none">
              {game.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        {game.curascore != null && (
          <div className={`absolute top-1.5 right-1.5 ${curascoreBg(game.curascore)} text-white text-xs font-black px-1.5 py-0.5 rounded-full`}>
            {game.curascore}
          </div>
        )}
        {game.esrbRating && (
          <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-xs font-bold px-1.5 py-0.5 rounded">
            {game.esrbRating}
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors">
          {game.title}
        </p>
        <p className="text-xs text-slate-400 truncate mt-0.5">
          {game.genres[0] ?? game.developer ?? ''}
        </p>
      </div>
    </Link>
  )
}

// ─── Shelf ────────────────────────────────────────────────────────────────────

function Shelf({ title, href, games: shelfGames }: {
  title: string
  href: string
  games: GameSummary[]
}) {
  if (shelfGames.length === 0) return null
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <Link
          href={href}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition-colors shrink-0"
        >
          See all →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {shelfGames.map((game) => (
          <GameTile key={game.slug} game={game} />
        ))}
      </div>
    </div>
  )
}

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'Ages 5–8',     href: '/browse?age=E',             emoji: '🌱' },
  { label: 'Ages 9–12',    href: '/browse?age=E10',           emoji: '🎮' },
  { label: 'Teens',        href: '/browse?age=T',             emoji: '🧩' },
  { label: 'Puzzle',       href: '/browse?genres=Puzzle',     emoji: '🔍' },
  { label: 'Teamwork',     href: '/browse?benefits=teamwork', emoji: '🤝' },
  { label: 'Platformers',  href: '/browse?genres=Platformer', emoji: '🏃' },
  { label: 'Strategy',     href: '/browse?genres=Strategy',   emoji: '♟️' },
  { label: 'Low Risk',     href: '/browse?risk=low',          emoji: '✅' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const { topRated, youngKids, noSpending, buildSkills } = await getShelves()

  return (
    <div className="bg-slate-50">
      <main className="max-w-4xl mx-auto px-4">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="py-10 text-center space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
            Grounded in child development
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-none">
            Game ratings that go{' '}
            <span className="text-indigo-600">beyond the age label</span>
          </h1>
          <p className="text-slate-500 text-base leading-relaxed max-w-xl mx-auto">
            Every Curascore reflects what a game actually does to a developing mind —
            the skills it builds, the habits it forms, and how much daily play makes sense.
          </p>
          <div className="max-w-xl mx-auto pt-2">
            <SearchBar placeholder="Search 500+ games…" />
          </div>
        </section>

        {/* ── Category pills ────────────────────────────────────────────────── */}
        <section className="pb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Browse by category
          </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full
                  text-sm font-medium text-slate-700 shadow-sm
                  hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 hover:-translate-y-0.5
                  transition-all duration-200"
              >
                <span>{c.emoji}</span>
                <span>{c.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Shelves ───────────────────────────────────────────────────────── */}
        <section className="space-y-8 pb-12">
          <Shelf
            title="🏆 Top rated"
            href="/browse?sort=curascore"
            games={topRated}
          />
          <Shelf
            title="🌱 Great for young kids"
            href="/browse?age=E"
            games={youngKids}
          />
          <Shelf
            title="💚 No spending pressure"
            href="/browse?price=free"
            games={noSpending}
          />
          <Shelf
            title="🧠 Builds real skills"
            href="/browse?sort=benefit"
            games={buildSkills}
          />
        </section>

        {/* ── About ─────────────────────────────────────────────────────────── */}
        <section className="border-t border-slate-200 py-8 pb-12">
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: '🧠',
                title: 'Developmental lens',
                body: 'Our scoring framework draws on cognitive science, social-emotional learning, and behavioral research — translated into a single, clear score.',
              },
              {
                icon: '⚠️',
                title: 'Honest about risks',
                body: 'We flag dopamine loops, loot boxes, spending pressure, and social mechanics — the design patterns that matter most for developing minds.',
              },
              {
                icon: '⏱',
                title: 'Time limits that hold up',
                body: "Each game's daily limit follows from its actual benefit and risk profile. Better games earn more time.",
              },
            ].map((item) => (
              <div key={item.title} className="text-center px-2">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-bold text-slate-800 mb-1.5">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
