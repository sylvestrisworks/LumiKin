import { unstable_cache } from 'next/cache'
import { sql, eq, gte, isNotNull, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, gameTranslations, platformExperiences, experienceScores } from '@/lib/db/schema'

export type PlatformStat = {
  platform_name: string
  count: number
}

export type LanguageStat = {
  locale: string
  count: number
}

export type RecentScore = {
  game_id: number
  name: string
  slug: string
  score: number | null
  scored_at: string | null
  platform: string | null
}

export type RecentUgcScore = {
  id: number
  name: string
  slug: string
  score: number | null
  scored_at: string | null
  parent_platform: string
}

export type SiteStats = {
  total_games_scored: number
  scored_last_7_days: number
  scored_last_30_days: number
  platforms: PlatformStat[]
  languages: LanguageStat[]
  recent_scores: RecentScore[]

  // UGC coverage
  total_ugc_experiences_scored: number
  ugc_scored_last_7_days: number
  ugc_scored_last_30_days: number
  ugc_by_parent_platform: PlatformStat[]
  // null: platform_experiences has no publish-date field from the source platform.
  // To enable this metric, add platformPublishedAt to platform_experiences and backfill
  // from the Roblox API (games.v1 `created` field) or Fortnite map metadata.
  median_hours_publish_to_score_ugc: null
  recent_ugc_scores: RecentUgcScore[]
}

async function computeSiteStats(): Promise<SiteStats> {
  const now = new Date()
  const ago7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalResult,
    last7Result,
    last30Result,
    platformRows,
    translationRows,
    recentRows,
    ugcTotalResult,
    ugcLast7Result,
    ugcLast30Result,
    ugcByPlatformRows,
    recentUgcRows,
  ] = await Promise.all([
    // ── Standalone / platform game stats ──────────────────────────────────────

    db.select({ count: sql<number>`count(*)` }).from(gameScores).where(isNotNull(gameScores.curascore)),

    db.select({ count: sql<number>`count(*)` })
      .from(gameScores)
      .where(gte(gameScores.calculatedAt, ago7)),

    db.select({ count: sql<number>`count(*)` })
      .from(gameScores)
      .where(gte(gameScores.calculatedAt, ago30)),

    // platform breakdown — unnest JSONB array, join to scored games only
    db.execute(sql`
      SELECT p.platform_name, count(*)::int AS count
      FROM game_scores gs
      JOIN games g ON g.id = gs.game_id
      CROSS JOIN jsonb_array_elements_text(g.platforms) AS p(platform_name)
      WHERE g.platforms IS NOT NULL AND jsonb_typeof(g.platforms) = 'array' AND g.platforms != '[]'::jsonb
      GROUP BY p.platform_name
      ORDER BY count DESC
    `),

    // non-English translation counts
    db.select({
      locale: gameTranslations.locale,
      count:  sql<number>`count(*)`,
    })
      .from(gameTranslations)
      .groupBy(gameTranslations.locale),

    // 10 most recently scored games
    db.select({
      game_id:   games.id,
      name:      games.title,
      slug:      games.slug,
      score:     gameScores.curascore,
      scored_at: gameScores.calculatedAt,
      platform:  sql<string | null>`CASE WHEN jsonb_typeof(${games.platforms}) = 'array' THEN ${games.platforms}->>0 ELSE NULL END`,
    })
      .from(gameScores)
      .innerJoin(games, eq(games.id, gameScores.gameId))
      .where(isNotNull(gameScores.curascore))
      .orderBy(desc(gameScores.calculatedAt))
      .limit(10),

    // ── UGC experience stats ───────────────────────────────────────────────────

    db.select({ count: sql<number>`count(*)` })
      .from(experienceScores)
      .where(isNotNull(experienceScores.curascore)),

    db.select({ count: sql<number>`count(*)` })
      .from(experienceScores)
      .where(gte(experienceScores.calculatedAt, ago7)),

    db.select({ count: sql<number>`count(*)` })
      .from(experienceScores)
      .where(gte(experienceScores.calculatedAt, ago30)),

    // UGC breakdown by parent platform (e.g. Roblox: 220, Fortnite Creative: 14)
    db.execute(sql`
      SELECT g.title AS platform_name, count(*)::int AS count
      FROM experience_scores es
      JOIN platform_experiences pe ON pe.id = es.experience_id
      JOIN games g ON g.id = pe.platform_id
      WHERE es.curascore IS NOT NULL
      GROUP BY g.title
      ORDER BY count DESC
    `),

    // 10 most recently scored UGC experiences
    db.select({
      id:              platformExperiences.id,
      name:            platformExperiences.title,
      slug:            platformExperiences.slug,
      score:           experienceScores.curascore,
      scored_at:       experienceScores.calculatedAt,
      parent_platform: games.title,
    })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(isNotNull(experienceScores.curascore))
      .orderBy(desc(experienceScores.calculatedAt))
      .limit(10),
  ])

  const totalScored = Number(totalResult[0]?.count ?? 0)

  const langMap = new Map<string, number>([['en', totalScored]])
  for (const row of translationRows) {
    langMap.set(row.locale, Number(row.count))
  }
  const languages: LanguageStat[] = Array.from(langMap.entries()).map(([locale, count]) => ({ locale, count }))

  return {
    total_games_scored:  totalScored,
    scored_last_7_days:  Number(last7Result[0]?.count  ?? 0),
    scored_last_30_days: Number(last30Result[0]?.count ?? 0),
    platforms: (platformRows as unknown as { platform_name: string; count: number }[]).map(r => ({
      platform_name: r.platform_name,
      count: Number(r.count),
    })),
    languages,
    recent_scores: recentRows.map(r => ({
      game_id:   r.game_id,
      name:      r.name,
      slug:      r.slug,
      score:     r.score ?? null,
      scored_at: r.scored_at ? new Date(r.scored_at).toISOString() : null,
      platform:  r.platform ?? null,
    })),

    total_ugc_experiences_scored: Number(ugcTotalResult[0]?.count ?? 0),
    ugc_scored_last_7_days:       Number(ugcLast7Result[0]?.count  ?? 0),
    ugc_scored_last_30_days:      Number(ugcLast30Result[0]?.count ?? 0),
    ugc_by_parent_platform: (ugcByPlatformRows as unknown as { platform_name: string; count: number }[]).map(r => ({
      platform_name: r.platform_name,
      count: Number(r.count),
    })),
    median_hours_publish_to_score_ugc: null,
    recent_ugc_scores: recentUgcRows.map(r => ({
      id:              r.id,
      name:            r.name,
      slug:            r.slug,
      score:           r.score ?? null,
      scored_at:       r.scored_at ? new Date(r.scored_at).toISOString() : null,
      parent_platform: r.parent_platform,
    })),
  }
}

export const fetchSiteStats = unstable_cache(
  computeSiteStats,
  ['site-stats'],
  { revalidate: 3600 },
)
