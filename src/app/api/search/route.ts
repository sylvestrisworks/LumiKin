import { NextRequest, NextResponse } from 'next/server'
import { eq, sql, desc, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import type { GameSummary } from '@/types/game'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2 || q.length > 200) return NextResponse.json([])

  // Use pg_trgm word_similarity for fuzzy matching (handles typos, partial words).
  // Also keep an ilike fallback so short exact substrings always match.
  const rows = await db
    .select({
      slug:            games.slug,
      title:           games.title,
      developer:       games.developer,
      genres:          games.genres,
      esrbRating:      games.esrbRating,
      backgroundImage: games.backgroundImage,
      metacriticScore: games.metacriticScore,
      curascore:                 gameScores.curascore,
      timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
      timeRecommendationColor:   gameScores.timeRecommendationColor,
      similarity:      sql<number>`word_similarity(${q}, ${games.title})`,
    })
    .from(games)
    .leftJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(
      or(
        sql`word_similarity(${q}, ${games.title}) > 0.2`,
        sql`${games.title} ilike ${'%' + q + '%'}`,
      )
    )
    .orderBy(
      sql`word_similarity(${q}, ${games.title}) desc`,
      desc(gameScores.curascore),
      desc(games.metacriticScore),
    )
    .limit(8)

  const results: GameSummary[] = rows.map((r) => ({
    slug:            r.slug,
    title:           r.title,
    developer:       r.developer,
    genres:          (r.genres as string[]) ?? [],
    esrbRating:      r.esrbRating,
    backgroundImage: r.backgroundImage,
    metacriticScore: r.metacriticScore,
    curascore:       r.curascore,
    timeRecommendationMinutes: r.timeRecommendationMinutes,
    timeRecommendationColor: r.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
  }))

  return NextResponse.json(results)
}
