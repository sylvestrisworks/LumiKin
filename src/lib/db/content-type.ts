import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, platformExperiences, experienceScores } from '@/lib/db/schema'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentType = 'standalone_game' | 'platform' | 'ugc_experience'

export type StandaloneGameEntry = {
  contentType: 'standalone_game'
  slug: string
  title: string
  curascore: number | null
}

export type PlatformEntry = {
  contentType: 'platform'
  slug: string
  title: string
  curascore: number | null
}

export type UgcExperienceEntry = {
  contentType: 'ugc_experience'
  slug: string
  title: string
  curascore: number | null
  /** FK to the games.id row for the parent platform (e.g. Roblox's id) */
  parentPlatformId: number
  /** The ID used by the parent platform: Roblox Place ID or Fortnite island code */
  platformNativeId: string
  /** Slug of the parent platform game row (e.g. 'roblox', 'fortnite-creative') */
  platformSlug: string
}

export type ScoredEntry = StandaloneGameEntry | PlatformEntry | UgcExperienceEntry

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolve the content type and key fields for any scored slug.
 * Checks games first (standalone_game / platform), then platform_experiences (ugc_experience).
 * Returns null if the slug is not found in either table.
 */
export async function resolveContentType(slug: string): Promise<ScoredEntry | null> {
  // Check games table first
  const [gameRow] = await db
    .select({
      slug:        games.slug,
      title:       games.title,
      contentType: games.contentType,
      curascore:   gameScores.curascore,
    })
    .from(games)
    .leftJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(eq(games.slug, slug))
    .limit(1)

  if (gameRow) {
    return {
      contentType: gameRow.contentType as 'standalone_game' | 'platform',
      slug:        gameRow.slug,
      title:       gameRow.title,
      curascore:   gameRow.curascore ?? null,
    }
  }

  // Check platform_experiences
  const [expRow] = await db
    .select({
      slug:             platformExperiences.slug,
      title:            platformExperiences.title,
      platformId:       platformExperiences.platformId,
      placeId:          platformExperiences.placeId,
      curascore:        experienceScores.curascore,
      platformSlug:     games.slug,
    })
    .from(platformExperiences)
    .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .innerJoin(games, eq(games.id, platformExperiences.platformId))
    .where(eq(platformExperiences.slug, slug))
    .limit(1)

  if (expRow) {
    return {
      contentType:      'ugc_experience',
      slug:             expRow.slug,
      title:            expRow.title,
      curascore:        expRow.curascore ?? null,
      parentPlatformId: expRow.platformId,
      platformNativeId: expRow.placeId,
      platformSlug:     expRow.platformSlug,
    }
  }

  return null
}
