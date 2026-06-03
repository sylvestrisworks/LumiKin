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
  const [t, tNav] = await Promise.all([
    getTranslations({ locale, namespace: 'ageHub' }),
    getTranslations({ locale, namespace: 'game' }),
  ])

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

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: tNav('navHome'),     item: `${SITE_URL}/${locale}` },
      { '@type': 'ListItem', position: 2, name: t('indexTitle'),     item: `${SITE_URL}/${locale}/age` },
      { '@type': 'ListItem', position: 3, name: t('ageLink', { age }), item: `${SITE_URL}/${locale}/age/${age}` },
    ],
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') }}
      />
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">

        <nav
          className="mb-6 flex items-center gap-1.5 text-kicker uppercase text-muted"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          <Link href={`/${locale}`} className="hover:text-accent transition-colors">
            {tNav('navHome')}
          </Link>
          <span aria-hidden className="text-rule">/</span>
          <Link href={`/${locale}/age`} className="hover:text-accent transition-colors">
            {t('indexTitle')}
          </Link>
          <span aria-hidden className="text-rule">/</span>
          <span className="text-ink truncate">{t('ageLink', { age })}</span>
        </nav>

        <header className="text-center mb-10 border-b border-ink pb-6">
          <p
            className="text-kicker uppercase font-semibold text-accent"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('eyebrow')}
          </p>
          <h1 className="mt-2 font-serif text-display-sm sm:text-display text-ink tracking-tight">
            {t('title', { age })}
          </h1>
          <p className="mt-2 font-serif italic text-sm sm:text-base text-muted max-w-2xl mx-auto">
            {t('subtitle', { age })}
          </p>

          <div className="mt-5 flex items-center justify-center gap-4 text-xs">
            <Link
              href={strict ? `/${locale}/age/${age}` : `/${locale}/age/${age}?strict=1`}
              className={`px-3 py-1.5 text-kicker uppercase font-semibold border transition-colors ${
                strict
                  ? 'bg-ink border-ink text-paper'
                  : 'border-rule text-ink hover:border-ink hover:text-accent'
              }`}
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {strict ? t('strictOn', { age }) : t('strictOff', { age })}
            </Link>
            <Link
              href={`/${locale}/browse?age=${esrbBand}`}
              className="text-kicker uppercase text-muted hover:text-accent"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {t('openInBrowse')}
            </Link>
          </div>
        </header>

        {/* Perfect fit shelf */}
        {perfectFit.length === 0 ? (
          <div className="text-center py-16 border border-rule">
            <p className="text-4xl mb-3">🎮</p>
            <p className="font-serif text-lg text-ink">{t('noGames')}</p>
            <Link
              href={`/${locale}/age`}
              className="mt-4 inline-block text-kicker uppercase font-semibold text-accent hover:underline"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {t('tryAnotherAge')}
            </Link>
          </div>
        ) : (
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-4 border-t border-ink pt-4">
              <h2
                className="text-kicker uppercase font-semibold text-muted"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {t('perfectFit')}
              </h2>
              <span className="text-[11px] text-muted">
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
            <div className="flex items-baseline justify-between mb-4 border-t border-ink pt-4">
              <h2
                className="text-kicker uppercase font-semibold text-muted"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {t('stretchPicks')}
              </h2>
            </div>
            <p className="text-xs text-muted mb-3 max-w-2xl">
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
        <section className="mt-12 pt-8 border-t border-ink">
          <p
            className="text-kicker uppercase font-semibold text-muted mb-4 text-center"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('switchAge')}
          </p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {otherAges.map(a => (
              <Link
                key={a}
                href={`/${locale}/age/${a}`}
                className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
                style={{ fontVariantCaps: 'all-small-caps' }}
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
