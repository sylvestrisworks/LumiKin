import { eq, and, isNotNull, gt, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, gameTranslations } from '@/lib/db/schema'

export type TrendingRow = {
  slug: string
  title: string
  developer: string | null
  genres: unknown
  esrbRating: string | null
  backgroundImage: string | null

  curascore: number | null
  bds: number | null
  ris: number | null
  timeRecommendationMinutes: number | null
  executiveSummary: string | null
}

const SELECT = {
  slug:                      games.slug,
  title:                     games.title,
  developer:                 games.developer,
  genres:                    games.genres,
  esrbRating:                games.esrbRating,
  backgroundImage:           games.backgroundImage,
  curascore:                 gameScores.curascore,
  bds:                       gameScores.bds,
  ris:                       gameScores.ris,
  timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
  executiveSummary:          gameScores.executiveSummary,
}

const WHERE = and(
  isNotNull(gameScores.curascore),
  isNotNull(games.trendingScore),
  gt(games.trendingScore, 0),
)

// Top trending games, ordered by `games.trendingScore` (mirrors the browse
// page's "Trending" carousel). When a translation row exists for the locale,
// its `executive_summary` overrides the English one so the dek reads in-locale.
export async function fetchTrending(locale: string, limit = 3): Promise<TrendingRow[]> {
  if (locale !== 'en') {
    try {
      const rows = await db
        .select({
          ...SELECT,
          executiveSummary: sql<string | null>`COALESCE(${gameTranslations.executiveSummary}, ${gameScores.executiveSummary})`,
        })
        .from(games)
        .innerJoin(gameScores, eq(gameScores.gameId, games.id))
        .leftJoin(
          gameTranslations,
          and(eq(gameTranslations.gameId, games.id), eq(gameTranslations.locale, locale)),
        )
        .where(WHERE)
        .orderBy(desc(games.trendingScore))
        .limit(limit)
      return rows as TrendingRow[]
    } catch {
      // game_translations not yet migrated — fall through to base query
    }
  }

  const rows = await db
    .select(SELECT)
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(WHERE)
    .orderBy(desc(games.trendingScore))
    .limit(limit)
  return rows as TrendingRow[]
}
