export const revalidate = 3600

import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, platformExperiences, experienceScores } from '@/lib/db/schema'
import Icon, { type IconName } from '@/components/Icon'
import { curascoreTextEditorial } from '@/lib/ui'

type PlatformTile = {
  slug: string
  name: string
  iconName: IconName
  descKey: string
  count: number
  avgScore: number | null
}

const TRADITIONAL = [
  { slug: 'playstation',     name: 'PlayStation',     keyword: 'PlayStation',     iconName: 'playstation' as IconName, descKey: 'desc_playstation' },
  { slug: 'xbox',            name: 'Xbox',            keyword: 'Xbox',            iconName: 'xbox' as IconName,        descKey: 'desc_xbox' },
  { slug: 'nintendo-switch', name: 'Nintendo Switch', keyword: 'Nintendo Switch', iconName: 'switch' as IconName,      descKey: 'desc_nintendo_switch' },
  { slug: 'pc',              name: 'PC',              keyword: 'PC',              iconName: 'pc' as IconName,          descKey: 'desc_pc' },
  { slug: 'ios',             name: 'iOS',             keyword: 'iOS',             iconName: 'ios' as IconName,         descKey: 'desc_ios' },
  { slug: 'android',         name: 'Android',         keyword: 'Android',         iconName: 'android' as IconName,     descKey: 'desc_android' },
] as const

const UGC = [
  { slug: 'roblox',   dbSlug: 'roblox',            name: 'Roblox',            iconName: 'roblox' as IconName,   descKey: 'desc_roblox' },
  { slug: 'fortnite', dbSlug: 'fortnite-creative', name: 'Fortnite Creative', iconName: 'fortnite' as IconName, descKey: 'desc_fortnite_creative' },
] as const

async function fetchTraditionalStats(keyword: string) {
  const pf = sql`${games.platforms}::text ILIKE ${'%' + keyword + '%'}`
  const [row] = await db
    .select({
      count:    sql<number>`count(${gameScores.id})::int`,
      avgScore: sql<number>`round(avg(${gameScores.curascore}))::int`,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(isNotNull(gameScores.curascore), pf))
  return { count: Number(row?.count ?? 0), avgScore: row?.avgScore ?? null }
}

async function fetchUgcStats(dbSlug: string) {
  const [row] = await db
    .select({
      count:    sql<number>`count(${experienceScores.id})::int`,
      avgScore: sql<number>`round(avg(${experienceScores.curascore}))::int`,
    })
    .from(experienceScores)
    .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
    .innerJoin(games, eq(games.id, platformExperiences.platformId))
    .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore), eq(platformExperiences.isPublic, true)))
  return { count: Number(row?.count ?? 0), avgScore: row?.avgScore ?? null }
}

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'platform' })
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    title:       t('indexMetaTitle' as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    description: t('indexMetaDescription' as any),
    alternates:  { canonical: `/${locale}/platform` },
  }
}

export default async function PlatformIndex({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'platform' })

  const [traditionalStats, ugcStats, [gameTotalRow], [expTotalRow]] = await Promise.all([
    Promise.all(TRADITIONAL.map(p => fetchTraditionalStats(p.keyword))),
    Promise.all(UGC.map(p => fetchUgcStats(p.dbSlug))),
    db.select({ n: sql<number>`count(${gameScores.id})::int` })
      .from(gameScores)
      .where(isNotNull(gameScores.curascore)),
    db.select({ n: sql<number>`count(${experienceScores.id})::int` })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .where(and(isNotNull(experienceScores.curascore), eq(platformExperiences.isPublic, true))),
  ])

  const tiles: PlatformTile[] = [
    ...TRADITIONAL.map((p, i) => ({
      slug: p.slug, name: p.name, iconName: p.iconName, descKey: p.descKey,
      count: traditionalStats[i].count, avgScore: traditionalStats[i].avgScore,
    })),
    ...UGC.map((p, i) => ({
      slug: p.slug, name: p.name, iconName: p.iconName, descKey: p.descKey,
      count: ugcStats[i].count, avgScore: ugcStats[i].avgScore,
    })),
  ].sort((a, b) => b.count - a.count)

  const totalRatings = Number(gameTotalRow?.n ?? 0) + Number(expTotalRow?.n ?? 0)

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center mb-10 border-b border-ink pb-6">
          <h1 className="font-serif text-display-sm sm:text-display text-ink tracking-tight">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {t('indexTitle' as any)}
          </h1>
          <p className="mt-2 font-serif italic text-sm sm:text-base text-muted max-w-xl mx-auto">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {t('indexSubtitle' as any)}
          </p>
          {totalRatings > 0 && (
            <p className="mt-4 text-kicker uppercase text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {t.rich('ledger' as any, {
                ratings: totalRatings,
                platforms: tiles.length,
                b: (c) => <span className="font-serif font-bold text-ink tabular-nums normal-case">{c}</span>,
              })}
            </p>
          )}
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map(tile => (
            <Link
              key={tile.slug}
              href={`/${locale}/platform/${tile.slug}`}
              className="group flex flex-col border border-rule hover:border-ink bg-paper transition-colors"
            >
              <div className="flex items-center gap-3 px-4 pt-4">
                <span className="shrink-0 w-11 h-11 border border-rule group-hover:border-ink flex items-center justify-center text-ink transition-colors">
                  <Icon name={tile.iconName} size={24} label={tile.name} />
                </span>
                <span className="font-serif text-lg text-ink tracking-tight">{tile.name}</span>
              </div>

              <p className="px-4 pt-2 text-xs text-muted leading-snug line-clamp-2 flex-1">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {t(tile.descKey as any)}
              </p>

              <div className="mt-3 mx-4 mb-4 pt-3 border-t border-rule flex items-end justify-between">
                {tile.count > 0 && tile.avgScore != null ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`font-serif text-3xl leading-none tabular-nums ${curascoreTextEditorial(tile.avgScore)}`}>
                        {tile.avgScore}
                      </span>
                      <span className="text-kicker uppercase text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {t('avgShort' as any)}
                      </span>
                    </div>
                    <span className="text-kicker uppercase text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {t('ratedCount' as any, { count: tile.count })}
                    </span>
                  </>
                ) : (
                  <span className="text-kicker uppercase text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t('tileSummaryEmpty' as any)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
