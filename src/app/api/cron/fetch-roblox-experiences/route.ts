/**
 * GET /api/cron/fetch-roblox-experiences
 *
 * Two jobs in one run:
 *   1. Refresh live stats (activePlayers, visitCount) for all existing experiences
 *   2. Check a curated list of popular universe IDs — insert any not yet in DB
 *
 * Note: Roblox's public discovery/charts API requires auth and is not available.
 * New games are added via the CURATED_UNIVERSE_IDS list below.
 * To add a game manually: find the place ID in the Roblox URL and add its universe ID here.
 *
 * Runs every 6 hours via GitHub Actions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformExperiences, games } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

export const maxDuration = 60

// ─── Curated popular experiences not yet seeded ───────────────────────────────
// Add universe IDs here to have them auto-ingested on the next cron run.
// Find: open a Roblox game URL → place ID → use /api/cron/fetch-roblox-experiences?add=PLACE_ID to resolve

const CURATED_UNIVERSE_IDS: string[] = [
  '2316994223',  // Pet Simulator X
  '1831550657',  // Creatures of Sonaria
  '2619619496',  // BedWars
  '2440500124',  // Doors
  '1008451066',  // Da Hood
  '5569032992',  // Dandy's World
  // Add more by using ?add=PLACE_ID on this endpoint to resolve universe IDs
]

// ─── Roblox API helpers ───────────────────────────────────────────────────────

type RobloxGame = {
  id: number
  rootPlaceId: number
  name: string
  description: string | null
  creator: { id: number; name: string; type: string }
  playing: number
  visits: number
  maxPlayers: number
  genre: string
  isPublic: boolean
}

async function fetchUniversesBatch(universeIds: string[]): Promise<RobloxGame[]> {
  if (universeIds.length === 0) return []
  // API accepts up to 100 IDs at once
  const chunks: string[][] = []
  for (let i = 0; i < universeIds.length; i += 100) chunks.push(universeIds.slice(i, i + 100))

  const results: RobloxGame[] = []
  for (const chunk of chunks) {
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${chunk.join(',')}`)
    if (!res.ok) continue
    const data = await res.json() as { data?: RobloxGame[] }
    results.push(...(data.data ?? []))
  }
  return results
}

async function fetchThumbnail(universeId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`
    )
    if (!res.ok) return null
    const data = await res.json() as { data?: Array<{ state: string; imageUrl: string }> }
    return data.data?.find(t => t.state === 'Completed')?.imageUrl ?? null
  } catch { return null }
}

async function placeToUniverse(placeId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`)
    if (!res.ok) return null
    const data = await res.json() as { universeId: number | null }
    return data.universeId ? String(data.universeId) : null
  } catch { return null }
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 255)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Optional: ?add=PLACE_ID to resolve and queue a single new game
  const addPlaceId = req.nextUrl.searchParams.get('add')
  if (addPlaceId) {
    const universeId = await placeToUniverse(addPlaceId)
    if (!universeId) return NextResponse.json({ error: `No universe found for place ${addPlaceId}` }, { status: 404 })
    return NextResponse.json({ universeId, message: `Add ${universeId} to CURATED_UNIVERSE_IDS in the route file` })
  }

  // ── 1. Get all existing experiences ─────────────────────────────────────────
  const existing = await db
    .select({ id: platformExperiences.id, universeId: platformExperiences.universeId, slug: platformExperiences.slug })
    .from(platformExperiences)

  const existingUniverseIds = new Set(existing.map(e => e.universeId).filter(Boolean) as string[])

  // ── 2. Determine which curated IDs are new ───────────────────────────────────
  const newUniverseIds = CURATED_UNIVERSE_IDS.filter(id => !existingUniverseIds.has(id))

  // ── 3. Batch-fetch metadata for all (existing + new) ─────────────────────────
  const allUniverseIds = [...Array.from(existingUniverseIds), ...newUniverseIds]
  const games_data = await fetchUniversesBatch(allUniverseIds)

  const refreshed: string[] = []
  const inserted:  string[] = []
  const errors:    string[] = []

  // Find Roblox platform row
  const [roblox] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, 'roblox'))
    .limit(1)

  if (!roblox) return NextResponse.json({ error: 'Roblox platform row not found in games table' }, { status: 500 })

  for (const game of games_data) {
    // Skip placeholder/private games — isPublic is undefined for public games in this API
    if (game.isPublic === false || !game.name || game.name.includes("'s Place") || !game.playing && game.visits === 0) {
      continue
    }

    const universeId = String(game.id)
    const existingRow = existing.find(e => e.universeId === universeId)

    try {
      if (existingRow) {
        // Refresh stats only
        await db.update(platformExperiences).set({
          activePlayers: game.playing,
          visitCount:    game.visits,
          updatedAt:     new Date(),
        }).where(eq(platformExperiences.id, existingRow.id))
        refreshed.push(existingRow.slug)
      } else {
        // New experience — fetch thumbnail and insert
        const thumbnailUrl = await fetchThumbnail(universeId)
        let slug = slugify(game.name)

        // Check slug collision
        const [collision] = await db
          .select({ id: platformExperiences.id })
          .from(platformExperiences)
          .where(eq(platformExperiences.slug, slug))
          .limit(1)
        if (collision) slug = `${slug}-${universeId}`

        await db.insert(platformExperiences).values({
          slug,
          platformId:    roblox.id,
          universeId,
          placeId:       String(game.rootPlaceId),
          title:         game.name,
          description:   game.description,
          creatorName:   game.creator?.name ?? null,
          creatorId:     game.creator?.id ? String(game.creator.id) : null,
          thumbnailUrl,
          genre:         game.genre ?? null,
          isPublic:      true,
          visitCount:    game.visits,
          activePlayers: game.playing,
          maxPlayers:    game.maxPlayers,
          lastFetchedAt: new Date(),
        })
        inserted.push(game.name)
        console.log(`[fetch-roblox] Inserted: ${game.name}`)
      }
    } catch (err) {
      console.error(`[fetch-roblox] Error for universe ${universeId}:`, err)
      errors.push(universeId)
    }
  }

  return NextResponse.json({
    refreshed: refreshed.length,
    inserted:  inserted.length,
    errors:    errors.length,
    newGames:  inserted,
  })
}
