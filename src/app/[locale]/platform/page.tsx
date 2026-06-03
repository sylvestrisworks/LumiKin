export const revalidate = 3600

import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, platformExperiences, experienceScores } from '@/lib/db/schema'

type PlatformTile = {
  slug: string
  name: string
  accent: string
  iconBg: string
  iconLabel: string
  descKey: string
  count: number
  avgScore: number | null
}

const TRADITIONAL = [
  { slug: 'playstation',     name: 'PlayStation',     keyword: 'PlayStation',     accent: 'from-blue-950/95 via-blue-900/70 to-slate-900/20',     iconBg: 'bg-blue-700 ring-blue-400/40',     iconLabel: 'PS', descKey: 'desc_playstation' },
  { slug: 'xbox',            name: 'Xbox',            keyword: 'Xbox',            accent: 'from-green-950/95 via-green-900/70 to-slate-900/20',   iconBg: 'bg-green-700 ring-green-400/40',   iconLabel: 'XB', descKey: 'desc_xbox' },
  { slug: 'nintendo-switch', name: 'Nintendo Switch', keyword: 'Nintendo Switch', accent: 'from-red-950/95 via-red-900/70 to-slate-900/20',       iconBg: 'bg-red-600 ring-red-400/40',       iconLabel: 'NS', descKey: 'desc_nintendo_switch' },
  { slug: 'pc',              name: 'PC',              keyword: 'PC',              accent: 'from-violet-950/95 via-violet-900/70 to-slate-900/20', iconBg: 'bg-violet-700 ring-violet-400/40', iconLabel: 'PC', descKey: 'desc_pc' },
  { slug: 'ios',             name: 'iOS',             keyword: 'iOS',             accent: 'from-sky-950/95 via-sky-900/70 to-slate-900/20',       iconBg: 'bg-sky-600 ring-sky-400/40',       iconLabel: 'iOS', descKey: 'desc_ios' },
  { slug: 'android',         name: 'Android',         keyword: 'Android',         accent: 'from-emerald-950/95 via-emerald-900/70 to-slate-900/20', iconBg: 'bg-emerald-600 ring-emerald-400/40', iconLabel: 'AND', descKey: 'desc_android' },
] as const

const UGC = [
  { slug: 'roblox',   dbSlug: 'roblox',            name: 'Roblox',            accent: 'from-red-950/95 via-red-900/70 to-slate-900/20',       iconBg: 'bg-red-600 ring-red-400/40',  iconLabel: 'RB', descKey: 'desc_roblox' },
  { slug: 'fortnite', dbSlug: 'fortnite-creative', name: 'Fortnite Creative', accent: 'from-indigo-950/95 via-indigo-900/70 to-slate-900/20', iconBg: 'bg-blue-600 ring-blue-400/40', iconLabel: 'FN', descKey: 'desc_fortnite_creative' },
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

  const [traditionalStats, ugcStats] = await Promise.all([
    Promise.all(TRADITIONAL.map(p => fetchTraditionalStats(p.keyword))),
    Promise.all(UGC.map(p => fetchUgcStats(p.dbSlug))),
  ])

  const tiles: PlatformTile[] = [
    ...TRADITIONAL.map((p, i) => ({
      slug: p.slug, name: p.name, accent: p.accent, iconBg: p.iconBg, iconLabel: p.iconLabel, descKey: p.descKey,
      count: traditionalStats[i].count, avgScore: traditionalStats[i].avgScore,
    })),
    ...UGC.map((p, i) => ({
      slug: p.slug, name: p.name, accent: p.accent, iconBg: p.iconBg, iconLabel: p.iconLabel, descKey: p.descKey,
      count: ugcStats[i].count, avgScore: ugcStats[i].avgScore,
    })),
  ].sort((a, b) => b.count - a.count)

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
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map(tile => (
            <Link
              key={tile.slug}
              href={`/${locale}/platform/${tile.slug}`}
              className="group overflow-hidden border border-rule hover:border-ink transition-colors"
            >
              <div className={`h-16 bg-gradient-to-br ${tile.accent} flex items-center px-4 gap-3`}>
                <span className={`shrink-0 w-10 h-10 rounded-xl ${tile.iconBg} ring-2 flex items-center justify-center text-white font-black text-[11px] tracking-tight`}>
                  {tile.iconLabel}
                </span>
                <span className="text-white font-serif text-base tracking-tight">{tile.name}</span>
              </div>
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs text-ink/80 leading-snug line-clamp-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {t(tile.descKey as any)}
                </p>
                <p className="text-kicker uppercase text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
                  {tile.count > 0 && tile.avgScore != null
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? t('tileSummary' as any, { count: tile.count, avg: tile.avgScore })
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    : t('tileSummaryEmpty' as any)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
