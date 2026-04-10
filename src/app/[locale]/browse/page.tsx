export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { eq, desc, asc, sql, and, lte, gte, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm'
import { curascoreBg } from '@/lib/ui'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { games, gameScores, childProfiles } from '@/lib/db/schema'
import BrowseFilters, { ViewToggle, type ActiveFilters } from '@/components/BrowseFilters'
import GameCompactCard from '@/components/GameCompactCard'
import BrowseSearch from '@/components/BrowseSearch'
import { auth } from '@/auth'

export const metadata: Metadata = {
  title: 'Browse Games — PlaySmart',
  description: 'Find the right game for your child. Filter by age, genre, platform, risk level, and more.',
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 48

// ─── Keyword maps ─────────────────────────────────────────────────────────────

const PLATFORM_KEYWORDS: Record<string, string> = {
  PC:          'PC',
  PlayStation: 'PlayStation',
  Xbox:        'Xbox',
  Switch:      'Switch',
  iOS:         'iOS',
  Android:     'Android',
}

const VR_KEYWORDS = ['Oculus', 'Quest', 'Vive', 'Rift', 'Valve Index', 'PlayStation VR', 'PSVR', 'Mixed Reality', 'Gear VR']

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

type ChildFilter = { age: number; platforms: string[] }

async function queryGames(filters: ActiveFilters, child?: ChildFilter): Promise<{ rows: Row[]; total: number }> {
  const conditions: SQL[] = []
  const page   = Math.max(1, filters.page ?? 1)
  const offset = (page - 1) * PAGE_SIZE

  if (filters.q) {
    conditions.push(ilike(games.title, `%${filters.q}%`))
  }

  if (filters.age) {
    const ratings = ESRB_FOR_AGE[filters.age]
    if (ratings) {
      conditions.push(inArray(games.esrbRating, ratings))
    }
  }

  for (const genre of filters.genres) {
    conditions.push(sql`${games.genres}::text ILIKE ${'%' + genre + '%'}`)
  }

  // Standard platform filters
  const standardPlatforms = filters.platforms.filter(p => p !== 'VR')
  for (const platform of standardPlatforms) {
    const keyword = PLATFORM_KEYWORDS[platform] ?? platform
    conditions.push(sql`${games.platforms}::text ILIKE ${'%' + keyword + '%'}`)
  }

  // VR platform filter — match any known VR platform keyword
  if (filters.platforms.includes('VR')) {
    const vrConditions = VR_KEYWORDS.map(k =>
      sql`${games.platforms}::text ILIKE ${'%' + k + '%'}`
    )
    conditions.push(sql`(${sql.join(vrConditions, sql` OR `)})`)
  }

  if (filters.price === 'free') {
    conditions.push(eq(games.basePrice, 0))
  } else if (filters.price === '20') {
    conditions.push(lte(games.basePrice, 20))
  } else if (filters.price === '40') {
    conditions.push(lte(games.basePrice, 40))
  }

  // Fixed: both 'low' and 'medium' use lte only — they are max-risk filters
  if (filters.risk === 'low') {
    conditions.push(lte(gameScores.ris, 0.30))
  } else if (filters.risk === 'medium') {
    conditions.push(lte(gameScores.ris, 0.60))
  }

  if (filters.time) {
    const minMinutes = parseInt(filters.time)
    if (!isNaN(minMinutes)) {
      conditions.push(gte(gameScores.timeRecommendationMinutes, minMinutes))
    }
  }

  for (const benefit of filters.benefits) {
    const skillName = BENEFIT_SKILL_MAP[benefit]
    if (skillName) {
      conditions.push(
        sql`${gameScores.topBenefits}::jsonb @> ${JSON.stringify([{ skill: skillName }])}::jsonb`
      )
    }
  }

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

  // Representation filter: both gender and ethnic diversity scored ≥ 2
  if (filters.rep === 'good') {
    conditions.push(gte(gameScores.representationScore, 4 / 6)) // avg(2,2)/3 = 4/6
  }

  // No propaganda filter: propagandaLevel is null (unscored) or 0
  if (filters.noProp === 'true') {
    conditions.push(
      sql`(${gameScores.propagandaLevel} IS NULL OR ${gameScores.propagandaLevel} = 0)`
    )
  }

  // Bechdel test filter
  if (filters.bechdel === 'pass') {
    conditions.push(eq(gameScores.bechdelResult, 'pass'))
  }

  // Child profile filter: age-appropriate + platform match
  if (child) {
    conditions.push(
      or(
        isNull(gameScores.recommendedMinAge),
        lte(gameScores.recommendedMinAge, child.age),
      )!
    )
    if (child.platforms.length > 0) {
      const platConditions = child.platforms.map(p =>
        sql`${games.platforms}::text ILIKE ${'%' + p + '%'}`
      )
      conditions.push(sql`(${sql.join(platConditions, sql` OR `)})`)
    }
  }

  let orderBy
  switch (filters.sort) {
    case 'benefit':    orderBy = [desc(gameScores.bds),           desc(gameScores.curascore)]; break
    case 'safest':     orderBy = [asc(gameScores.ris),            desc(gameScores.curascore)]; break
    case 'riskiest':   orderBy = [desc(gameScores.ris),           asc(gameScores.curascore)];  break
    case 'newest':     orderBy = [desc(games.releaseDate)];                                    break
    case 'alpha':      orderBy = [asc(games.title)];                                           break
    case 'metacritic': orderBy = [sql`${games.metacriticScore} DESC NULLS LAST`];              break
    default:           orderBy = [desc(gameScores.curascore)];                                 break
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
      .limit(PAGE_SIZE)
      .offset(offset),

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
    time:       str('time'),
    price:      str('price'),
    rep:        str('rep'),
    noProp:     str('noProp'),
    bechdel:    str('bechdel'),
    sort:       str('sort') ?? 'curascore',
    q:          str('q'),
    page:       str('page') ? parseInt(str('page')!) : 1,
    view:       (str('view') as 'list' | 'grid') ?? 'list',
  }
}

// ─── Pagination URL builder ───────────────────────────────────────────────────

function pageUrl(filters: ActiveFilters, targetPage: number, locale = 'en', childId?: number): string {
  const params = new URLSearchParams()
  if (filters.age)               params.set('age',        filters.age)
  if (filters.genres.length)     params.set('genres',     filters.genres.join(','))
  if (filters.platforms.length)  params.set('platforms',  filters.platforms.join(','))
  if (filters.benefits.length)   params.set('benefits',   filters.benefits.join(','))
  if (filters.compliance.length) params.set('compliance', filters.compliance.join(','))
  if (filters.risk)              params.set('risk',       filters.risk)
  if (filters.time)              params.set('time',       filters.time)
  if (filters.price)             params.set('price',      filters.price)
  if (filters.rep)               params.set('rep',        filters.rep)
  if (filters.noProp)            params.set('noProp',     filters.noProp)
  if (filters.bechdel)           params.set('bechdel',    filters.bechdel)
  if (filters.sort && filters.sort !== 'curascore') params.set('sort', filters.sort)
  if (filters.q)                 params.set('q',          filters.q)
  if (filters.view && filters.view !== 'list') params.set('view', filters.view)
  if (childId)                   params.set('child',      String(childId))
  if (targetPage > 1)            params.set('page',       String(targetPage))
  return `/${locale}/browse?${params.toString()}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BrowsePage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const t = await getTranslations({ locale, namespace: 'browse' })
  const filters = parseFilters(sp)

  // Child profile filter
  const childIdParam = typeof sp.child === 'string' ? parseInt(sp.child) : null
  let profiles: { id: number; name: string; birthYear: number; platforms: unknown }[] = []
  let selectedChild: { id: number; name: string; age: number; platforms: string[] } | null = null

  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uid = (session?.user as any)?.id ?? session?.user?.email ?? null
  if (uid) {
    profiles = await db.select({ id: childProfiles.id, name: childProfiles.name, birthYear: childProfiles.birthYear, platforms: childProfiles.platforms })
      .from(childProfiles)
      .where(eq(childProfiles.userId, uid))

    if (childIdParam) {
      const found = profiles.find(p => p.id === childIdParam)
      if (found) {
        selectedChild = {
          id: found.id,
          name: found.name,
          age: new Date().getFullYear() - found.birthYear,
          platforms: (found.platforms as string[]) ?? [],
        }
      }
    }
  }

  const childFilter = selectedChild ? { age: selectedChild.age, platforms: selectedChild.platforms } : undefined
  const { rows, total } = await queryGames(filters, childFilter)

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = filters.page ?? 1

  const activeFilterCount = [
    filters.age, ...filters.genres, ...filters.platforms,
    ...filters.benefits, ...filters.compliance,
    filters.risk, filters.time, filters.price, filters.rep, filters.noProp, filters.bechdel,
  ].filter(Boolean).length

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── Search bar ─────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Suspense>
            <BrowseSearch initialValue={filters.q ?? ''} />
          </Suspense>
        </div>

        <div className="lg:flex gap-8">

          {/* Filters sidebar */}
          <Suspense>
            <BrowseFilters active={filters} totalCount={total} />
          </Suspense>

          {/* Main content */}
          <main className="flex-1 min-w-0">

            {/* Child selector pills */}
            {profiles.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="text-xs text-slate-400 font-medium">For:</span>
                <a
                  href={`/${locale}/browse?${new URLSearchParams(Object.entries(sp as Record<string, string>).filter(([k]) => k !== 'child' && k !== 'page')).toString()}`}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    !selectedChild
                      ? 'bg-slate-800 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  Everyone
                </a>
                {profiles.map(p => {
                  const age = new Date().getFullYear() - p.birthYear
                  const childParams = new URLSearchParams(Object.entries(sp as Record<string, string>).filter(([k]) => k !== 'child' && k !== 'page'))
                  childParams.set('child', String(p.id))
                  return (
                    <a
                      key={p.id}
                      href={`/${locale}/browse?${childParams.toString()}`}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                        selectedChild?.id === p.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
                      }`}
                    >
                      {p.name} <span className="opacity-70">({age})</span>
                    </a>
                  )
                })}
              </div>
            )}

            {/* Header row */}
            <div className="flex items-center justify-between mb-4 gap-3">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{t('title')}</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {t('gamesCount', { count: total })}
                  {activeFilterCount > 0 && ` · ${t('filtersActive', { count: activeFilterCount })}`}
                  {totalPages > 1 && ` · ${t('pageOf', { current: currentPage, total: totalPages })}`}
                </p>
              </div>
              <ViewToggle
                view={filters.view ?? 'list'}
                listHref={pageUrl({ ...filters, view: 'list' }, 1, locale, childIdParam ?? undefined)}
                gridHref={pageUrl({ ...filters, view: 'grid' }, 1, locale, childIdParam ?? undefined)}
              />
            </div>

            {rows.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-semibold text-slate-700">{t('noGames')}</p>
                <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
                  {t('noGamesSub')}
                  {(filters.risk || filters.time || filters.benefits.length > 0) && (
                    <> {t('noGamesRisk')}</>
                  )}
                </p>
                <Link href={`/${locale}/browse`} className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                  {t('clearAllFilters')}
                </Link>
              </div>
            ) : filters.view === 'grid' ? (
              /* ── Grid view ──────────────────────────────────────────────── */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {rows.map(row => (
                  <GameCompactCard
                    key={row.slug}
                    game={{
                      slug:                      row.slug,
                      title:                     row.title,
                      developer:                 row.developer,
                      genres:                    (row.genres as string[]) ?? [],
                      esrbRating:                row.esrbRating,
                      backgroundImage:           row.backgroundImage,
                      metacriticScore:           row.metacriticScore,
                      timeRecommendationMinutes: row.timeRecommendationMinutes,
                      timeRecommendationColor:   row.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
                      curascore:                 row.curascore,
                      bds:                       row.bds,
                      ris:                       row.ris,
                      hasMicrotransactions:      row.hasMicrotransactions ?? false,
                      hasLootBoxes:              row.hasLootBoxes ?? false,
                    }}
                  />
                ))}
              </div>
            ) : (
              /* ── List view ──────────────────────────────────────────────── */
              <ol className="divide-y divide-slate-100">
                {rows.map((row, i) => {
                  const score    = row.curascore
                  const badgeCls = score == null
                    ? 'bg-slate-200 text-slate-500'
                    : `${curascoreBg(score)} text-white`
                  const rank = (currentPage - 1) * PAGE_SIZE + i + 1
                  return (
                    <li key={row.slug}>
                      <Link
                        href={`/${locale}/game/${row.slug}`}
                        className="flex items-center gap-4 py-3 px-2 rounded-lg hover:bg-indigo-50 hover:translate-x-0.5 transition-all group"
                      >
                        <span className="w-7 text-right text-sm font-semibold text-slate-400 shrink-0 group-hover:text-indigo-400 transition-colors">
                          {rank}
                        </span>
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-indigo-100">
                          {row.backgroundImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.backgroundImage} alt={row.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100">
                              <span className="text-sm font-black text-indigo-300">
                                {row.title.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
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
                        {row.timeRecommendationMinutes != null && (
                          <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
                            {row.timeRecommendationMinutes} min/day
                          </span>
                        )}
                        <span className={`w-10 text-center text-xs font-black px-2 py-1 rounded-full shrink-0 ${badgeCls}`}>
                          {score ?? '—'}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            )}

            {/* ── Pagination ───────────────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                {currentPage > 1 && (
                  <Link
                    href={pageUrl(filters, currentPage - 1, locale, childIdParam ?? undefined)}
                    className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                  >
                    ← {t('prevPage')}
                  </Link>
                )}

                {/* Page number pills */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, idx) =>
                    p === '…' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 text-sm">…</span>
                    ) : (
                      <Link
                        key={p}
                        href={pageUrl(filters, p as number, locale, childIdParam ?? undefined)}
                        className={`w-9 h-9 flex items-center justify-center text-sm font-semibold rounded-lg transition-colors ${
                          p === currentPage
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700'
                        }`}
                      >
                        {p}
                      </Link>
                    )
                  )
                }

                {currentPage < totalPages && (
                  <Link
                    href={pageUrl(filters, currentPage + 1, locale, childIdParam ?? undefined)}
                    className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                  >
                    {t('nextPage')} →
                  </Link>
                )}
              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  )
}
