export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import GameCompactCard from '@/components/GameCompactCard'

const MIN_AGE = 4
const MAX_AGE = 17
const SHELF_SIZE = 24

type Props = {
  params: Promise<{ locale: string; n: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function parseAge(raw: string): number | null {
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < MIN_AGE || n > MAX_AGE) return null
  return n
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, n } = await params
  const age = parseAge(n)
  if (age == null) return { title: 'LumiKin' }
  const t = await getTranslations({ locale, namespace: 'ageHub' })
  return {
    title: t('metaTitle', { age }),
    description: t('metaDescription', { age }),
    alternates: { canonical: `/${locale}/age/${age}` },
  }
}

type Row = {
  slug: string
  title: string
  developer: string | null
  genres: unknown
  esrbRating: string | null
  backgroundImage: string | null
  metacriticScore: number | null
  hasMicrotransactions: boolean | null
  hasLootBoxes: boolean | null
  timeRecommendationMinutes: number | null
  timeRecommendationColor: string | null
  curascore: number | null
  bds: number | null
  ris: number | null
  recommendedMinAge: number | null
}

const GAME_SELECT = {
  slug:                      games.slug,
  title:                     games.title,
  developer:                 games.developer,
  genres:                    games.genres,
  esrbRating:                games.esrbRating,
  backgroundImage:           games.backgroundImage,
  metacriticScore:           games.metacriticScore,
  hasMicrotransactions:      games.hasMicrotransactions,
  hasLootBoxes:              games.hasLootBoxes,
  timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
  timeRecommendationColor:   gameScores.timeRecommendationColor,
  curascore:                 gameScores.curascore,
  bds:                       gameScores.bds,
  ris:                       gameScores.ris,
  recommendedMinAge:         gameScores.recommendedMinAge,
}

async function fetchShelf(where: SQL, limit: number): Promise<Row[]> {
  const rows = await db
    .select(GAME_SELECT)
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(where)
    .orderBy(desc(gameScores.curascore), asc(gameScores.recommendedMinAge))
    .limit(limit)
  return rows as Row[]
}

function rowToCard(r: Row) {
  return {
    slug:                      r.slug,
    title:                     r.title,
    developer:                 r.developer,
    genres:                    (r.genres as string[]) ?? [],
    esrbRating:                r.esrbRating,
    backgroundImage:           r.backgroundImage,
    metacriticScore:           r.metacriticScore,
    timeRecommendationMinutes: r.timeRecommendationMinutes,
    timeRecommendationColor:   r.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
    curascore:                 r.curascore,
    bds:                       r.bds,
    ris:                       r.ris,
    hasMicrotransactions:      r.hasMicrotransactions ?? false,
    hasLootBoxes:              r.hasLootBoxes ?? false,
  }
}

export default async function AgePage({ params, searchParams }: Props) {
  const { locale, n } = await params
  const age = parseAge(n)
  if (age == null) notFound()

  const sp = await searchParams
  const strict = sp.strict === '1'
  const t = await getTranslations({ locale, namespace: 'ageHub' })

  const released = or(isNull(games.releaseDate), lte(games.releaseDate, new Date()))!
  const scored = isNotNull(gameScores.curascore)

  // Perfect fit: recommendedMinAge ≤ age (or null, conservatively included)
  const perfectFitWhere = and(
    released,
    scored,
    or(
      isNull(gameScores.recommendedMinAge),
      lte(gameScores.recommendedMinAge, age),
    )!,
  )!

  // Slight stretch: 1–2 years above. Only fetched when not in strict mode.
  const stretchWhere = and(
    released,
    scored,
    isNotNull(gameScores.recommendedMinAge),
    gte(gameScores.recommendedMinAge, age + 1),
    lte(gameScores.recommendedMinAge, age + 2),
  )!

  const [perfectFit, stretch] = await Promise.all([
    fetchShelf(perfectFitWhere, SHELF_SIZE),
    strict ? Promise.resolve([] as Row[]) : fetchShelf(stretchWhere, 12),
  ])

  // Map age → existing ESRB band so the "open in advanced filters" link prefilters
  const esrbBand = age <= 7 ? 'E' : age <= 12 ? 'E10' : age <= 15 ? 'T' : 'M'

  const otherAges = [4, 6, 8, 10, 12, 14, 16].filter(a => a !== age)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">

        <nav className="mb-4 text-xs text-slate-400 dark:text-slate-500">
          <Link href={`/${locale}/age`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
            ← {t('backToAges')}
          </Link>
        </nav>

        <header className="text-center mb-8">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
            {t('eyebrow')}
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {t('title', { age })}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            {t('subtitle', { age })}
          </p>

          <div className="mt-4 flex items-center justify-center gap-3 text-xs">
            <Link
              href={strict ? `/${locale}/age/${age}` : `/${locale}/age/${age}?strict=1`}
              className={`px-3 py-1.5 rounded-full border font-medium transition-colors ${
                strict
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-300'
              }`}
            >
              {strict ? t('strictOn', { age }) : t('strictOff', { age })}
            </Link>
            <Link
              href={`/${locale}/browse?age=${esrbBand}`}
              className="text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              {t('openInBrowse')}
            </Link>
          </div>
        </header>

        {/* Perfect fit shelf */}
        {perfectFit.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <p className="text-4xl mb-3">🎮</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200">{t('noGames')}</p>
            <Link
              href={`/${locale}/age`}
              className="mt-4 inline-block text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('tryAnotherAge')}
            </Link>
          </div>
        ) : (
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                {t('perfectFit')}
              </h2>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {t('perfectFitNote', { age })}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
              {perfectFit.map(r => (
                <GameCompactCard key={r.slug} game={rowToCard(r)} />
              ))}
            </div>
          </section>
        )}

        {/* Slight stretch shelf */}
        {!strict && stretch.length > 0 && (
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                {t('stretchPicks')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 max-w-2xl">
              {t('stretchNote', { age })}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
              {stretch.map(r => (
                <GameCompactCard key={r.slug} game={rowToCard(r)} />
              ))}
            </div>
          </section>
        )}

        {/* Other ages */}
        <section className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 text-center">
            {t('switchAge')}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {otherAges.map(a => (
              <Link
                key={a}
                href={`/${locale}/age/${a}`}
                className="text-sm px-3.5 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-indigo-300 hover:text-indigo-700 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors font-medium"
              >
                {t('ageLink', { age: a })}
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
