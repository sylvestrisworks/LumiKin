/**
 * Shared title → catalog game matching for library imports.
 *
 * Steam, Epic, and GOG all return free-text game titles that we need to map onto
 * rows in our `games` table. This module centralises the normalisation + fuzzy
 * matching that used to live inline in the Steam import route, so every platform
 * benefits from the same (better) matching.
 */

import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export type CatalogGame = {
  id:        number
  slug:      string
  title:     string
  curascore: number | null
}

/** Lowercase, strip punctuation/trademark marks, collapse whitespace. */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Edition / packaging markers that distinguish a store SKU from our catalogue title.
const EDITION_MARKERS = /\b(definitive|complete|goty|game of the year|remastered|deluxe|gold|standard|ultimate|enhanced|anniversary)\b/g

// Trailing platform qualifiers stores append to the same game (e.g. Xbox/Steam
// list "Minecraft for Nintendo Switch", "Hades - Windows"). Stripped from the
// END only, so a title like "PC Building Simulator" is never touched.
const PLATFORM_SUFFIX = /\s+(for\s+)?(nintendo\s+switch|windows(\s+1[01])?|win\s*1[01]|pc|xbox(\s+one|\s+series\s+[xs])?|playstation(\s+[45])?|ps[45])\s*$/

/** Repeatedly strip trailing platform qualifiers from an already-normalised title. */
function stripPlatformSuffix(norm: string): string {
  let out = norm
  let prev: string
  do { prev = out; out = out.replace(PLATFORM_SUFFIX, '').trim() } while (out !== prev && out.length > 0)
  return out
}

/**
 * Match a store title against a normalised catalogue map. Tries an exact
 * normalised hit, then progressively looser candidates: edition markers
 * stripped, trailing platform qualifiers stripped, and both.
 */
export function matchTitle(
  title: string,
  gameMap: Map<string, CatalogGame>,
): CatalogGame | null {
  const norm = normalizeTitle(title)
  const exact = gameMap.get(norm)
  if (exact) return exact

  const noEdition  = norm.replace(EDITION_MARKERS, '').replace(/\s+/g, ' ').trim()
  const candidates = [
    noEdition,
    stripPlatformSuffix(norm),
    stripPlatformSuffix(noEdition),
  ]
  for (const c of candidates) {
    if (c && c !== norm) {
      const found = gameMap.get(c)
      if (found) return found
    }
  }
  return null
}

/**
 * Build a `normalizedTitle → CatalogGame` map of the entire catalogue.
 * Pass `withScores: false` to skip the gameScores join when curascore isn't needed
 * (e.g. background crons that only need the matched gameId).
 */
export async function buildGameTitleMap(
  opts: { withScores?: boolean } = {},
): Promise<Map<string, CatalogGame>> {
  const withScores = opts.withScores ?? true

  const rows = withScores
    ? await db
        .select({
          id:        games.id,
          slug:      games.slug,
          title:     games.title,
          curascore: gameScores.curascore,
        })
        .from(games)
        .leftJoin(gameScores, eq(gameScores.gameId, games.id))
    : (await db
        .select({ id: games.id, slug: games.slug, title: games.title })
        .from(games)
      ).map(g => ({ ...g, curascore: null as number | null }))

  const map = new Map<string, CatalogGame>()
  for (const g of rows) {
    map.set(normalizeTitle(g.title), { ...g, curascore: g.curascore ?? null })
  }
  return map
}
