import { NextRequest, NextResponse } from 'next/server'
import { eq, ne, lte, desc, sql, and, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import type { GameSummary } from '@/types/game'

// Returns up to 3 lower-risk games in the same genre, excluding the given slug.
// Falls back to genre-only match if no scored alternatives are found.
export async function GET(req: NextRequest) {
  const genre  = req.nextUrl.searchParams.get('genre')
  const excludeSlug = req.nextUrl.searchParams.get('excludeSlug') ?? ''

  if (!genre || genre.length > 100) return NextResponse.json([])

  const rawRis = parseFloat(req.nextUrl.searchParams.get('maxRis') ?? '0.4')
  const maxRis = Number.isFinite(rawRis) ? Math.min(Math.max(rawRis, 0), 1) : 0.4

  // First try: same genre, lower risk, has a score
  const withScores = await db
    .select({
      slug:            games.slug,
      title:           games.title,
      developer:       games.developer,
      genres:          games.genres,
      esrbRating:      games.esrbRating,
      backgroundImage: games.backgroundImage,
      metacriticScore: games.metacriticScore,
      ris:             gameScores.ris,
      timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
      timeRecommendationColor:   gameScores.timeRecommendationColor,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      sql`${games.genres}::jsonb @> ${JSON.stringify([genre])}::jsonb`,
      ne(games.slug, excludeSlug),
      isNotNull(gameScores.ris),
      lte(gameScores.ris, maxRis),
    ))
    .orderBy(desc(gameScores.bds))
    .limit(3)

  if (withScores.length >= 1) {
    return NextResponse.json(withScores.map(toSummary))
  }

  // Fallback: same genre, no score requirement, just sort by metacritic
  const noScore = await db
    .select({
      slug:            games.slug,
      title:           games.title,
      developer:       games.developer,
      genres:          games.genres,
      esrbRating:      games.esrbRating,
      backgroundImage: games.backgroundImage,
      metacriticScore: games.metacriticScore,
      timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
      timeRecommendationColor:   gameScores.timeRecommendationColor,
    })
    .from(games)
    .leftJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      sql`${games.genres}::jsonb @> ${JSON.stringify([genre])}::jsonb`,
      ne(games.slug, excludeSlug),
    ))
    .orderBy(desc(games.metacriticScore))
    .limit(3)

  return NextResponse.json(noScore.map(toSummary))
}

function toSummary(r: {
  slug: string; title: string; developer: string | null
  genres: unknown; esrbRating: string | null; backgroundImage: string | null
  metacriticScore: number | null
  timeRecommendationMinutes?: number | null
  timeRecommendationColor?: string | null
}): GameSummary {
  return {
    slug:            r.slug,
    title:           r.title,
    developer:       r.developer,
    genres:          Array.isArray(r.genres) ? (r.genres as string[]) : [],
    esrbRating:      r.esrbRating,
    backgroundImage: r.backgroundImage,
    metacriticScore: r.metacriticScore,
    timeRecommendationMinutes: r.timeRecommendationMinutes ?? null,
    timeRecommendationColor: r.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
  }
}
