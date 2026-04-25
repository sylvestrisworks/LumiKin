import { unstable_cache } from 'next/cache'
import { eq, and, gte, lte, isNotNull, desc, notInArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'

export type RelatedGame = {
  slug: string
  title: string
  platforms: string[]
  esrbRating: string | null
  curascore: number
}

type AgeBucket = 'everyone' | 'teen' | 'mature'

function ageBucket(esrb: string | null, pegi: number | null): AgeBucket | null {
  if (esrb === 'E' || esrb === 'E10+') return 'everyone'
  if (esrb === 'T') return 'teen'
  if (esrb === 'M' || esrb === 'AO') return 'mature'
  if (pegi != null) {
    if (pegi <= 12) return 'everyone'
    if (pegi <= 16) return 'teen'
    return 'mature'
  }
  return null
}

async function runQuery(
  excludeSlugs: string[],
  minScore: number,
  maxScore: number,
  platforms: string[] | null,
  bucket: AgeBucket | null,
  limit: number,
): Promise<RelatedGame[]> {
  const rows = await db
    .select({
      slug:       games.slug,
      title:      games.title,
      platforms:  games.platforms,
      esrbRating: games.esrbRating,
      curascore:  gameScores.curascore,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      eq(games.contentType, 'standalone_game'),
      isNotNull(gameScores.curascore),
      gte(gameScores.curascore, minScore),
      lte(gameScores.curascore, maxScore),
      excludeSlugs.length > 0 ? notInArray(games.slug, excludeSlugs) : undefined,
      platforms && platforms.length > 0
        ? sql`(${sql.join(platforms.map(p => sql`${games.platforms} @> ${JSON.stringify([p])}::jsonb`), sql` OR `)})`
        : undefined,
      bucket
        ? sql`CASE
            WHEN ${games.esrbRating} IN ('E', 'E10+') THEN 'everyone'
            WHEN ${games.esrbRating} = 'T' THEN 'teen'
            WHEN ${games.esrbRating} IN ('M', 'AO') THEN 'mature'
            WHEN ${games.pegiRating} <= 12 THEN 'everyone'
            WHEN ${games.pegiRating} <= 16 THEN 'teen'
            WHEN ${games.pegiRating} = 18 THEN 'mature'
            ELSE NULL
          END = ${bucket}`
        : undefined,
    ))
    .orderBy(desc(gameScores.curascore))
    .limit(limit)

  return rows.map(r => ({
    slug:       r.slug,
    title:      r.title,
    platforms:  Array.isArray(r.platforms) ? (r.platforms as string[]) : [],
    esrbRating: r.esrbRating,
    curascore:  r.curascore!,
  }))
}

async function _fetchRelatedGames(
  slug: string,
  curascore: number,
  platforms: string[],
  esrb: string | null,
  pegi: number | null,
): Promise<RelatedGame[]> {
  const bucket = ageBucket(esrb, pegi)
  const found: RelatedGame[] = []
  const seen = new Set<string>([slug])

  const collect = (rows: RelatedGame[]) => {
    for (const r of rows) { found.push(r); seen.add(r.slug) }
  }

  // Pass 1: same platform + ±10 + same age bucket
  collect(await runQuery(
    Array.from(seen),
    Math.max(0, curascore - 10), Math.min(100, curascore + 10),
    platforms, bucket, 5,
  ))
  if (found.length >= 4) return found.slice(0, 5)

  // Pass 2: any platform + ±15 + same age bucket
  collect(await runQuery(
    Array.from(seen),
    Math.max(0, curascore - 15), Math.min(100, curascore + 15),
    null, bucket, 5 - found.length,
  ))
  if (found.length >= 4) return found.slice(0, 5)

  // Pass 3: any platform + ±25 + same age bucket
  collect(await runQuery(
    Array.from(seen),
    Math.max(0, curascore - 25), Math.min(100, curascore + 25),
    null, bucket, 5 - found.length,
  ))
  if (found.length >= 4) return found.slice(0, 5)

  // Pass 4: any platform + ±35 + no bucket filter (catches unrated games and edge cases)
  collect(await runQuery(
    Array.from(seen),
    Math.max(0, curascore - 35), Math.min(100, curascore + 35),
    null, null, 5 - found.length,
  ))

  return found.slice(0, 5)
}

export function fetchRelatedGames(
  slug: string,
  curascore: number,
  platforms: string[],
  esrb: string | null,
  pegi: number | null,
): Promise<RelatedGame[]> {
  return unstable_cache(
    _fetchRelatedGames,
    ['related-games', slug, String(curascore)],
    { revalidate: 86400 },
  )(slug, curascore, platforms, esrb, pegi)
}
