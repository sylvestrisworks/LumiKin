export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import Link from 'next/link'
import { eq, desc, asc, sql, and, lte, gte, ilike, type SQL } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import BrowseFilters, { type ActiveFilters } from '@/components/BrowseFilters'
import SearchBar from '@/components/SearchBar'

export const metadata: Metadata = {
  title: 'Browse Games — PlaySmart',
  description: 'Find the right game for your child. Filter by age, genre, platform, and risk level.',
}

// ─── Platform keyword mapping ─────────────────────────────────────────────────

const PLATFORM_KEYWORDS: Record<string, string> = {
  PC:          'PC',
  PlayStation: 'PlayStation',
  Xbox:        'Xbox',
  Switch:      'Switch',
  iOS:         'iOS',
  Android:     'Android',
}

const ESRB_FOR_AGE: Record<string, string[]> = {
  E:   ['E'],
  E10: ['E', 'E10+'],
  T:   ['E', 'E10+', 'T'],
  M:   ['T', 'M'],
}

const BENEFIT_SKILL_MAP: Record<string, string> = {
  'problem-solving': 'Problem Solving',
  spatial:           'Spatial Awareness',
  teamwork:          'Teamwork',
  creativity:        'Creativity',
  communication:     'Communication',
}

// ─── Data fetching ────────────────────────────────────────────────────────────

type Row = {
  slug: string
  title: string
  developer: string | null
  genres: unknown
  esrbRating: string | null
  backgroundImage: string | null
  metacriticScore: number | null
  timeRecommendationMinutes: number | null
  timeRecommendationColor: string | null
  curascore: number | null
  bds: number | null
  ris: number | null
  hasMicrotransactions: boolean | null
  hasLootBoxes: boolean | null
}

async function queryGames(filters: ActiveFilters): Promise<{ rows: Row[]; total: number }> {
  const conditions: SQL[] = []

  // Search query
  if (filters.q) {
    conditions.push(ilike(games.title, `%${filters.q}%`))
  }

  // Age / ESRB
  if (filters.age) {
    const ratings = ESRB_FOR_AGE[filters.age]
    if (ratings) {
      conditions.push(
        sql`${games.esrbRating} = ANY(ARRAY[${sql.join(ratings.map(r => sql`${r}`), sql`, `)}])`
      )
    }
  }

  // Genre (jsonb array contains)
  for (const genre of filters.genres) {
    conditions.push(sql`${games.genres}::jsonb @> ${JSON.stringify([genre])}::jsonb`)
  }

  // Platform (text search within jsonb array)
  for (const platform of filters.platforms) {
    const keyword = PLATFORM_KEYWORDS[platform] ?? platform
    conditions.push(sql`${games.platforms}::text ILIKE ${'%' + keyword + '%'}`)
  }

  // Price
  if (filters.price === 'free') {
    conditions.push(eq(games.basePrice, 0))
  } else if (filters.price === '20') {
    conditions.push(lte(games.basePrice, 20))
  } else if (filters.price === '40') {
    conditions.push(lte(games.basePrice, 40))
  }

  // Risk level
  if (filters.risk === 'low') {
    conditions.push(lte(gameScores.ris, 0.3))
  } else if (filters.risk === 'medium') {
    conditions.push(gte(gameScores.ris, 0.31), lte(gameScores.ris, 0.6))
  }

  // Time recommendation
  if (filters.time) {
    const minMinutes = parseInt(filters.time)
    if (!isNaN(minMinutes)) {
      conditions.push(gte(gameScores.timeRecommendationMinutes, minMinutes))
    }
  }

  // Benefit focus — filter games where topBenefits contains the skill
  for (const benefit of filters.benefits) {
    const skillName = BENEFIT_SKILL_MAP[benefit]
    if (skillName) {
      conditions.push(
        sql`${gameScores.topBenefits}::jsonb @> ${JSON.stringify([{ skill: skillName }])}::jsonb`
      )
    }
  }

  // Compliance — game must have 'compliant' status for each selected regulation
  for (const regulation of filters.compliance) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM compliance_status cs
        WHERE cs.game_id = ${games.id}
          AND cs.regulation = ${regulation}
          AND cs.status = 'compliant'
      )`
    )
  }

  // Sort order
  let orderBy
  switch (filters.sort) {
    case 'benefit':   orderBy = [desc(gameScores.bds), desc(gameScores.curascore)]; break
    case 'safest':    orderBy = [asc(gameScores.ris), desc(gameScores.curascore)];  break
    case 'newest':    orderBy = [desc(games.releaseDate)];                          break
    case 'alpha':     orderBy = [asc(games.title)];                                break
    case 'metacritic': orderBy = [desc(games.metacriticScore)];                    break
    default:          orderBy = [desc(gameScores.curascore)];                       break
  }

  const where = conditions.length ? and(...conditions) : undefined

  const [rows, countResult] = await Promise.all([
    db
      .select({
        slug:            games.slug,
        title:           games.title,
        developer:       games.developer,
        genres:          games.genres,
        esrbRating:      games.esrbRating,
        backgroundImage: games.backgroundImage,
        metacriticScore: games.metacriticScore,
        hasMicrotransactions: games.hasMicrotransactions,
        hasLootBoxes:    games.hasLootBoxes,
        timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
        timeRecommendationColor:   gameScores.timeRecommendationColor,
        curascore:       gameScores.curascore,
        bds:             gameScores.bds,
        ris:             gameScores.ris,
      })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(48),

    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(where),
  ])

  return { rows: rows as Row[], total: Number(countResult[0]?.count ?? 0) }
}

// ─── Parse search params ──────────────────────────────────────────────────────

function parseFilters(sp: Record<string, string | string[] | undefined>): ActiveFilters {
  const str = (key: string) => (typeof sp[key] === 'string' ? sp[key] as string : undefined)
  const arr = (key: string): string[] => {
    const v = sp[key]
    if (!v) return []
    return typeof v === 'string' ? v.split(',').filter(Boolean) : v
  }
  return {
    age:        str('age'),
    genres:     arr('genres'),
    platforms:  arr('platforms'),
    benefits:   arr('benefits'),
    compliance: arr('compliance'),
    risk:       str('risk'),
    time:      str('time'),
    price:     str('price'),
    sort:      str('sort') ?? 'curascore',
    q:         str('q'),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = { searchParams: Record<string, string | string[] | undefined> }

export default async function BrowsePage({ searchParams }: Props) {
  const filters = parseFilters(searchParams)
  const { rows, total } = await queryGames(filters)

  const activeFilterCount = [
    filters.age, ...filters.genres, ...filters.platforms,
    ...filters.benefits, ...filters.compliance, filters.risk, filters.time, filters.price,
  ].filter(Boolean).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/" className="text-lg font-bold text-indigo-700 tracking-tight shrink-0">
            PlaySmart
          </Link>
          <div className="flex-1 max-w-md">
            <SearchBar placeholder="Search games…" />
          </div>
          <Link href="/compare" className="text-sm text-slate-600 hover:text-indigo-700 shrink-0 transition-colors">
            Compare
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-8">

          {/* Filters sidebar */}
          <Suspense>
            <BrowseFilters active={filters} totalCount={total} />
          </Suspense>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Browse games</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {total} game{total !== 1 ? 's' : ''}
                  {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active`}
                </p>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-medium text-slate-600">No games match these filters</p>
                <p className="text-sm mt-1">
                  Try removing some filters.{' '}
                  {(filters.risk || filters.time || filters.benefits.length > 0) && (
                    <span>Note: risk and benefit filters only apply to reviewed games.</span>
                  )}
                </p>
              </div>
            ) : (
              <ol className="divide-y divide-slate-100">
                {rows.map((row, i) => {
                  const score = row.curascore
                  const scoreBg =
                    score == null   ? 'bg-slate-200 text-slate-500' :
                    score >= 70     ? 'bg-emerald-600 text-white' :
                    score >= 40     ? 'bg-amber-500 text-white' :
                                      'bg-red-600 text-white'
                  return (
                    <li key={row.slug}>
                      <Link
                        href={`/game/${row.slug}`}
                        className="flex items-center gap-4 py-3 px-2 rounded-lg hover:bg-indigo-50 transition-colors group"
                      >
                        {/* Rank number */}
                        <span className="w-7 text-right text-sm font-semibold text-slate-400 shrink-0">
                          {i + 1}
                        </span>

                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-indigo-100">
                          {row.backgroundImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.backgroundImage}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-sm font-black text-indigo-300">
                                {row.title.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Title + meta */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                            {row.title}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {(row.genres as string[])[0] ?? row.developer ?? ''}
                            {row.esrbRating && (
                              <span className="ml-2 text-slate-400">{row.esrbRating}</span>
                            )}
                          </p>
                        </div>

                        {/* Time rec */}
                        {row.timeRecommendationMinutes != null && (
                          <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
                            {row.timeRecommendationMinutes} min/day
                          </span>
                        )}

                        {/* Curascore badge */}
                        <span className={`w-10 text-center text-xs font-black px-2 py-1 rounded-full shrink-0 ${scoreBg}`}>
                          {score ?? '—'}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            )}

            {total > 48 && (
              <p className="text-center text-sm text-slate-400 mt-8">
                Showing first 48 of {total} games. Refine filters to narrow results.
              </p>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
