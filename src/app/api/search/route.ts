import { NextRequest, NextResponse } from 'next/server'
import { eq, sql, desc, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import type { GameSummary } from '@/types/game'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1 || q.length > 200) return NextResponse.json([])

  // Single uppercase char → acronym shortcut (e.g. "F" → F-Zero), starts-with only
  if (q.length === 1 && q === q.toUpperCase()) {
    const rows = await db
      .select(baseSelect)
      .from(games)
      .leftJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(sql`${games.title} ilike ${q + '%'}`)
      .orderBy(desc(gameScores.curascore), desc(games.metacriticScore))
      .limit(8)
    return NextResponse.json(rows.map(mapRow))
  }

  // Normalize: strip leading articles + unaccent + lowercase, applied to both sides
  // so "legend of zelda" matches "The Legend of Zelda", "pokemon" matches "Pokémon"
  const qNorm    = sql`regexp_replace(unaccent(lower(${q})), '^(the|a|an)\\s+', '')`
  const titleNorm = sql`regexp_replace(unaccent(lower(${games.title})), '^(the|a|an)\\s+', '')`

  const rows = await db
    .select({
      ...baseSelect,
      similarity: sql<number>`word_similarity(${qNorm}, ${titleNorm})`,
    })
    .from(games)
    .leftJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(
      or(
        // Fuzzy title match
        sql`word_similarity(${qNorm}, ${titleNorm}) > 0.2`,
        // Exact substring on title (catches short tokens the trigram misses)
        sql`unaccent(${games.title}) ilike ${`%${q}%`}`,
        // Developer name match
        sql`unaccent(${games.developer}) ilike ${`%${q}%`}`,
        // Genre match (jsonb array) — guard against null/scalar genres
        sql`(jsonb_typeof(${games.genres}) = 'array' AND exists (
          select 1 from jsonb_array_elements_text(${games.genres}) g
          where unaccent(g) ilike ${`%${q}%`}
        ))`,
      )
    )
    .orderBy(
      sql`word_similarity(${qNorm}, ${titleNorm}) desc`,
      desc(gameScores.curascore),
      desc(games.metacriticScore),
    )
    .limit(8)

  return NextResponse.json(rows.map(mapRow))
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const baseSelect = {
  slug:                      games.slug,
  title:                     games.title,
  developer:                 games.developer,
  genres:                    games.genres,
  esrbRating:                games.esrbRating,
  backgroundImage:           games.backgroundImage,
  metacriticScore:           games.metacriticScore,
  curascore:                 gameScores.curascore,
  timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
  timeRecommendationColor:   gameScores.timeRecommendationColor,
} as const

function mapRow(r: {
  slug: string; title: string; developer: string | null; genres: unknown
  esrbRating: string | null; backgroundImage: string | null; metacriticScore: number | null
  curascore: number | null; timeRecommendationMinutes: number | null; timeRecommendationColor: string | null
}): GameSummary {
  return {
    slug:            r.slug,
    title:           r.title,
    developer:       r.developer,
    genres:          (r.genres as string[]) ?? [],
    esrbRating:      r.esrbRating,
    backgroundImage: r.backgroundImage,
    metacriticScore: r.metacriticScore,
    curascore:       r.curascore,
    timeRecommendationMinutes: r.timeRecommendationMinutes,
    timeRecommendationColor:   r.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
  }
}
