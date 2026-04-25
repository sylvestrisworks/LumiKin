'use server'

import { db } from '@/lib/db'
import { games, platformExperiences } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { fetchRobloxExperience } from '@/lib/roblox/api'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 255)
}

export type FetchExperienceResult =
  | { success: true;  slug: string; title: string; isNew: boolean }
  | { success: false; error: string }

/**
 * Server action: fetch Roblox experience metadata by Place ID and upsert into DB.
 * The Roblox platform game row must already exist in `games` with contentType='platform'.
 */
export async function upsertRobloxExperience(placeId: string): Promise<FetchExperienceResult> {
  try {
    // Find the Roblox platform row
    const [roblox] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, 'roblox'))
      .limit(1)

    if (!roblox) {
      return { success: false, error: 'Roblox platform entry not found in games table' }
    }

    const meta = await fetchRobloxExperience(placeId)
    const slug = slugify(meta.title)

    const row = {
      platformId:    roblox.id,
      placeId:       meta.placeId,
      universeId:    meta.universeId,
      title:         meta.title,
      description:   meta.description,
      creatorName:   meta.creatorName,
      creatorId:     meta.creatorId,
      thumbnailUrl:  meta.thumbnailUrl,
      genre:         meta.genre,
      isPublic:      meta.isPublic,
      visitCount:    meta.visitCount,
      activePlayers: meta.activePlayers,
      maxPlayers:    meta.maxPlayers,
      lastFetchedAt: new Date(),
      updatedAt:     new Date(),
    }

    const [existing] = await db
      .select({ id: platformExperiences.id, slug: platformExperiences.slug })
      .from(platformExperiences)
      .where(eq(platformExperiences.placeId, placeId))
      .limit(1)

    if (existing) {
      await db
        .update(platformExperiences)
        .set(row)
        .where(eq(platformExperiences.id, existing.id))
      return { success: true, slug: existing.slug, title: meta.title, isNew: false }
    }

    // Ensure slug is unique
    let finalSlug = slug
    const [collision] = await db
      .select({ id: platformExperiences.id })
      .from(platformExperiences)
      .where(eq(platformExperiences.slug, slug))
      .limit(1)
    if (collision) finalSlug = `${slug}-${meta.placeId}`

    await db.insert(platformExperiences).values({ slug: finalSlug, ...row })
    return { success: true, slug: finalSlug, title: meta.title, isNew: true }

  } catch (err) {
    return { success: false, error: String(err) }
  }
}
