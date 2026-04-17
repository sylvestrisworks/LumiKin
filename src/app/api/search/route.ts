import { NextRequest, NextResponse } from 'next/server'
import { eq, sql, desc, or } from 'drizzle-orm'
import { rateLimit, getIp } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { games, gameScores, platformExperiences, experienceScores } from '@/lib/db/schema'
import type { GameSummary } from '@/types/game'

type SearchResult = GameSummary & { resultType?: 'game' | 'experience' }

export async function GET(req: NextRequest) {
  if (!rateLimit(`search:${getIp(req)}`, 30, 60_000)) {
    return NextResponse.json([], { status: 429 })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1 || q.length > 200) return NextResponse.json([])

  // Single uppercase char → acronym shortcut (e.g. "F" → F-Zero), starts-with only
  if (q.length === 1 && q === q.toUpperCase()) {
    const [gameRows, expRows] = await Promise.all([
      db.select(baseSelect)
        .from(games)
        .leftJoin(gameScores, eq(gameScores.gameId, games.id))
        .where(sql`${games.title} ilike ${q + '%'}`)
        .orderBy(desc(games.releaseDate), desc(gameScores.curascore), desc(games.metacriticScore))
        .limit(6),
      db.select(expSelect)
        .from(platformExperiences)
        .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
        .where(sql`${platformExperiences.title} ilike ${q + '%'}`)
        .orderBy(desc(experienceScores.curascore), desc(platformExperiences.activePlayers))
        .limit(3),
    ])
    return NextResponse.json([...gameRows.map(mapRow), ...expRows.map(mapExpRow)])
  }

  // Normalize: strip leading articles + unaccent + lowercase, applied to both sides
  const qNorm     = sql`regexp_replace(unaccent(lower(${q})), '^(the|a|an)\\s+', '')`
  const titleNorm = sql`regexp_replace(unaccent(lower(${games.title})), '^(the|a|an)\\s+', '')`
  const expTitleNorm = sql`regexp_replace(unaccent(lower(${platformExperiences.title})), '^(the|a|an)\\s+', '')`

  const [gameRows, expRows] = await Promise.all([
    db.select({
        ...baseSelect,
        similarity: sql<number>`word_similarity(${qNorm}, ${titleNorm})`,
      })
      .from(games)
      .leftJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(
        or(
          sql`word_similarity(${qNorm}, ${titleNorm}) > 0.2`,
          sql`unaccent(${games.title}) ilike ${`%${q}%`}`,
          sql`unaccent(${games.developer}) ilike ${`%${q}%`}`,
          sql`(jsonb_typeof(${games.genres}) = 'array' AND exists (
            select 1 from jsonb_array_elements_text(${games.genres}) g
            where unaccent(g) ilike ${`%${q}%`}
          ))`,
        )
      )
      .orderBy(
        sql`word_similarity(${qNorm}, ${titleNorm}) desc`,
        desc(games.releaseDate),
        desc(gameScores.curascore),
        desc(games.metacriticScore),
      )
      .limit(6),

    db.select({
        ...expSelect,
        similarity: sql<number>`word_similarity(${qNorm}, ${expTitleNorm})`,
      })
      .from(platformExperiences)
      .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
      .where(
        or(
          sql`word_similarity(${qNorm}, ${expTitleNorm}) > 0.2`,
          sql`unaccent(${platformExperiences.title}) ilike ${`%${q}%`}`,
          sql`unaccent(${platformExperiences.creatorName}) ilike ${`%${q}%`}`,
        )
      )
      .orderBy(
        sql`word_similarity(${qNorm}, ${expTitleNorm}) desc`,
        desc(experienceScores.curascore),
        desc(platformExperiences.activePlayers),
      )
      .limit(3),
  ])

  return NextResponse.json([...gameRows.map(mapRow), ...expRows.map(mapExpRow)])
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
}): SearchResult {
  return {
    slug:            r.slug,
    title:           r.title,
    developer:       r.developer,
    genres:          Array.isArray(r.genres) ? (r.genres as string[]) : [],
    esrbRating:      r.esrbRating,
    backgroundImage: r.backgroundImage,
    metacriticScore: r.metacriticScore,
    curascore:       r.curascore,
    timeRecommendationMinutes: r.timeRecommendationMinutes,
    timeRecommendationColor:   r.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
    resultType:      'game',
  }
}

const expSelect = {
  slug:                      platformExperiences.slug,
  title:                     platformExperiences.title,
  creatorName:               platformExperiences.creatorName,
  thumbnailUrl:              platformExperiences.thumbnailUrl,
  genre:                     platformExperiences.genre,
  curascore:                 experienceScores.curascore,
  timeRecommendationMinutes: experienceScores.timeRecommendationMinutes,
  timeRecommendationColor:   experienceScores.timeRecommendationColor,
} as const

function mapExpRow(r: {
  slug: string; title: string; creatorName: string | null; thumbnailUrl: string | null
  genre: string | null; curascore: number | null; timeRecommendationMinutes: number | null
  timeRecommendationColor: string | null
}): SearchResult {
  return {
    slug:            r.slug,
    title:           r.title,
    developer:       r.creatorName,
    genres:          r.genre ? [r.genre] : [],
    esrbRating:      null,
    backgroundImage: r.thumbnailUrl,
    metacriticScore: null,
    curascore:       r.curascore,
    timeRecommendationMinutes: r.timeRecommendationMinutes,
    timeRecommendationColor:   r.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
    resultType:      'experience',
  }
}
