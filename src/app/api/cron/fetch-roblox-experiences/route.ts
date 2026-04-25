/**
 * GET /api/cron/fetch-roblox-experiences
 *
 * Three jobs per run:
 *   1. Refresh live stats (activePlayers, visitCount) for all existing experiences
 *   2. Seed from CURATED_UNIVERSE_IDS — insert any not yet in DB
 *   3. Discovery crawl — fetch recommendations for a sample of existing games
 *      and insert newly-discovered experiences (this is the growth engine)
 *
 * Discovery math:
 *   - Each game → up to 40 recommendations
 *   - Sample 25 existing games per run, 4 runs/day = ~100 discovery calls/day
 *   - Expected new games: 5–20/run after dedup → ~40–80/day
 *   - 5 000 games in ~2–3 months from a cold start
 *
 * Runs every 6 hours via GitHub Actions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games } from '@/lib/db/schema'
import { eq, inArray, sql, lt } from 'drizzle-orm'

const STALE_SCORE_DAYS    = 90
const DISCOVERY_SAMPLE    = 25   // how many existing games to crawl per run
const MAX_INSERTS_PER_RUN = 50   // cap new inserts per run to stay within budget

export const maxDuration = 300

// ─── Seed list — top Roblox experiences by active player count ────────────────
// These get inserted on first run; the crawler then expands outward from them.

const CURATED_UNIVERSE_IDS: string[] = [
  // Already seeded (kept for safety)
  '2316994223',  // Pet Simulator X
  '1831550657',  // Creatures of Sonaria
  '2619619496',  // BedWars
  '2440500124',  // Doors
  '1008451066',  // Da Hood
  '5569032992',  // Dandy's World
  // Top games by all-time visits / active players
  '914941352',   // Adopt Me!
  '142823291',   // Murder Mystery 2
  '1211944200',  // Tower of Hell
  '606849621',   // Jailbreak
  '735030788',   // Royale High
  '286090429',   // Arsenal
  '2753915549',  // Blox Fruits
  '361944958',   // Saber Simulator
  '189707',      // Natural Disaster Survival
  '192800',      // Work at a Pizza Place
  '508750',      // Speed Run 4
  '1330195249',  // Brookhaven RP
  '3262816151',  // Piggy
  '4372614302',  // Anime Battlegrounds X
  '3233893879',  // Shindo Life
  '1537690962',  // AUT: A Universal Time
  '2788229376',  // Anime Dimensions
  '2534724415',  // Kaiju Universe
  '4476194961',  // Wacky Wizards
  '4612243393',  // Build a Boat for Treasure
  '301549746',   // Theme Park Tycoon 2
  '10547456691', // Anime Defense Simulator
  '2747795440',  // Mining Simulator 2
  '4689643849',  // Strongman Simulator
  '4674438642',  // Pet Simulator 99
  '3737493148',  // Escape Room
  '3260590327',  // Bubble Gum Simulator
  '1885944660',  // Tapping Simulator
  '5649117742',  // Dress to Impress
  '4975220430',  // My Hello Kitty Café
  '3959478030',  // Roblox High School 2
  '2042782478',  // Super Golf!
  '142823291',   // Murder Mystery 2 (dup — harmless)
  '2694511069',  // Obby But You're on a Bike!
  '4564719648',  // Tapping Legends X
  '5723090419',  // Sol's RNG
  '13822889',    // Lumber Tycoon 2
  '155615604',   // Prison Life
  '948915281',   // Bee Swarm Simulator
  '3260590327',  // Bubble Gum Simulator (dup)
  '1294190829',  // Piggy: Book 2
  '11337801278', // Rainbow Friends 2
  '7631567469',  // Rainbow Friends
  '2917215400',  // Squid Game
  '7696753609',  // Break In 2
  '5701523558',  // Five Nights at Freddy's: Roleplay
  '9726563958',  // Fisch
  '6978066406',  // Skibidi Toilet Tower Defense
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

let _lastBatchDebug: { status: number; bodySnippet: string } | null = null

async function fetchUniversesBatch(universeIds: string[]): Promise<RobloxGame[]> {
  if (universeIds.length === 0) return []
  // Use smaller chunks — large batches are more likely to be silently dropped
  const chunks: string[][] = []
  for (let i = 0; i < universeIds.length; i += 10) chunks.push(universeIds.slice(i, i + 10))

  const results: RobloxGame[] = []
  for (const chunk of chunks) {
    try {
      const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${chunk.join(',')}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://www.roblox.com',
          'Referer': 'https://www.roblox.com/',
        },
      })
      const rawBody = await res.text().catch(() => '')
      _lastBatchDebug = { status: res.status, bodySnippet: rawBody.slice(0, 300) }
      if (!res.ok) {
        console.error(`[fetch-roblox] games batch HTTP ${res.status}: ${rawBody.slice(0, 200)}`)
        continue
      }
      let data: { data?: RobloxGame[] }
      try { data = JSON.parse(rawBody) } catch { console.error(`[fetch-roblox] JSON parse error: ${rawBody.slice(0, 200)}`); continue }
      console.log(`[fetch-roblox] games batch: ${data.data?.length ?? 0} games for ${chunk.length} IDs`)
      results.push(...(data.data ?? []))
    } catch (e) {
      console.error(`[fetch-roblox] games batch network error:`, e)
    }
  }
  return results
}

/**
 * Batch-fetch thumbnails for up to 100 universe IDs in a single request.
 * Returns a map of universeId → imageUrl (only includes IDs with a completed thumbnail).
 */
async function fetchThumbnailsBatch(universeIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (universeIds.length === 0) return result
  // API supports up to 100 IDs per request
  const chunks: string[][] = []
  for (let i = 0; i < universeIds.length; i += 100) chunks.push(universeIds.slice(i, i + 100))
  for (const chunk of chunks) {
    try {
      const res = await fetch(
        `https://thumbnails.roblox.com/v1/games/icons?universeIds=${chunk.join(',')}&size=512x512&format=Png&isCircular=false`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://www.roblox.com',
            'Referer': 'https://www.roblox.com/',
          },
        }
      )
      if (!res.ok) continue
      const data = await res.json() as { data?: Array<{ targetId: number; state: string; imageUrl: string }> }
      for (const item of data.data ?? []) {
        if (item.state === 'Completed' && item.imageUrl) {
          result.set(String(item.targetId), item.imageUrl)
        }
      }
    } catch { /* skip chunk */ }
  }
  return result
}

async function placeToUniverse(placeId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`)
    if (!res.ok) return null
    const data = await res.json() as { universeId: number | null }
    return data.universeId ? String(data.universeId) : null
  } catch { return null }
}

/**
 * Fetch recommended universe IDs for a given universe.
 * Uses the same public endpoint Roblox uses for "You Might Also Like" — no auth needed.
 */
async function fetchRecommendations(universeId: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://games.roblox.com/v1/games/recommendations/game/${universeId}?maxRows=40&model.isPaginationEnabled=false`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return []
    const data = await res.json() as { games?: Array<{ universeId: number }> }
    return (data.games ?? []).map(g => String(g.universeId))
  } catch { return [] }
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 255)
}

function isValidGame(game: RobloxGame): boolean {
  if (!game.name || game.name.trim() === '') return false
  if (game.isPublic === false) return false
  if (/\u2019s Place$|'s Place$/.test(game.name)) return false  // placeholder games (straight or curly apostrophe)
  if (game.visits === 0 && game.playing === 0) return false
  return true
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    return await handler(req)
  } catch (err) {
    console.error('[fetch-roblox] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handler(req: NextRequest): Promise<NextResponse> {

  // Optional helper: ?add=PLACE_ID to resolve a place ID to universe ID
  const addPlaceId = req.nextUrl.searchParams.get('add')
  if (addPlaceId) {
    const universeId = await placeToUniverse(addPlaceId)
    if (!universeId) return NextResponse.json({ error: `No universe found for place ${addPlaceId}` }, { status: 404 })
    return NextResponse.json({ universeId, hint: `Add "${universeId}" to CURATED_UNIVERSE_IDS or it will be picked up by the crawler` })
  }

  // Bulk mode: ?bulk=true — lifts per-run caps, crawls all existing games for discovery
  const isBulk = req.nextUrl.searchParams.get('bulk') === 'true'
  const discoverySample  = isBulk ? 9999 : DISCOVERY_SAMPLE
  const maxInserts       = isBulk ? 500  : MAX_INSERTS_PER_RUN

  // Find Roblox platform row
  const [roblox] = await db.select({ id: games.id }).from(games).where(eq(games.slug, 'roblox')).limit(1)
  if (!roblox) return NextResponse.json({ error: 'Roblox platform row not found in games table' }, { status: 500 })

  // ── Load all existing experiences ───────────────────────────────────────────
  const existing = await db
    .select({
      id:           platformExperiences.id,
      universeId:   platformExperiences.universeId,
      slug:         platformExperiences.slug,
      title:        platformExperiences.title,
      description:  platformExperiences.description,
      genre:        platformExperiences.genre,
      maxPlayers:   platformExperiences.maxPlayers,
      thumbnailUrl: platformExperiences.thumbnailUrl,
    })
    .from(platformExperiences)

  const existingUniverseIds = new Set(existing.map(e => e.universeId).filter(Boolean) as string[])

  // ── Discovery: crawl recommendations from a random sample ───────────────────
  const discoveredUniverseIds = new Set<string>()
  if (existing.length > 0) {
    // Pick a random sample of existing experiences to crawl recommendations for
    const shuffled = [...existing].sort(() => Math.random() - 0.5)
    const sample = shuffled.slice(0, discoverySample)

    await Promise.all(
      sample.map(async exp => {
        if (!exp.universeId) return
        const recs = await fetchRecommendations(exp.universeId)
        for (const uid of recs) {
          if (!existingUniverseIds.has(uid)) discoveredUniverseIds.add(uid)
        }
      })
    )
    console.log(`[fetch-roblox] Discovery crawl: ${discoveredUniverseIds.size} new universe IDs found`)
  }

  // ── Merge curated + discovered ───────────────────────────────────────────────
  const newUniverseIds = [
    ...CURATED_UNIVERSE_IDS.filter(id => !existingUniverseIds.has(id)),
    ...Array.from(discoveredUniverseIds),
  ]
  // Deduplicate
  const newUniverseIdsDeduped = Array.from(new Set(newUniverseIds)).slice(0, maxInserts)

  // ── Batch-fetch metadata for all IDs (existing + new) ───────────────────────
  const allUniverseIds = [...Array.from(existingUniverseIds), ...newUniverseIdsDeduped]
  console.log(`[fetch-roblox] Fetching metadata for ${allUniverseIds.length} IDs (${existingUniverseIds.size} existing + ${newUniverseIdsDeduped.length} new)`)
  const gamesData = await fetchUniversesBatch(allUniverseIds)
  const gameMap = new Map(gamesData.map(g => [String(g.id), g]))
  console.log(`[fetch-roblox] gameMap has ${gameMap.size} entries`)

  const refreshed: string[] = []
  const inserted:  string[] = []
  const errors:    string[] = []

  // ── Restore missing thumbnails for existing experiences ──────────────────────
  const missingThumbIds = existing
    .filter(e => !e.thumbnailUrl && e.universeId)
    .map(e => e.universeId as string)

  let existingThumbMap = new Map<string, string>()
  if (missingThumbIds.length > 0) {
    console.log(`[fetch-roblox] Fetching missing thumbnails for ${missingThumbIds.length} existing experiences`)
    existingThumbMap = await fetchThumbnailsBatch(missingThumbIds)
    console.log(`[fetch-roblox] Restored ${existingThumbMap.size} missing thumbnails`)

    for (const exp of existing) {
      if (!exp.universeId || exp.thumbnailUrl) continue
      const url = existingThumbMap.get(exp.universeId)
      if (!url) continue
      try {
        await db.update(platformExperiences)
          .set({ thumbnailUrl: url, updatedAt: new Date() })
          .where(eq(platformExperiences.id, exp.id))
      } catch (err) {
        console.error(`[fetch-roblox] Thumbnail restore error for ${exp.universeId}:`, err)
      }
    }
  }

  // ── Refresh existing experiences ─────────────────────────────────────────────
  for (const exp of existing) {
    if (!exp.universeId) continue
    const game = gameMap.get(exp.universeId)
    if (!game) continue

    try {
      const contentChanged =
        exp.title       !== game.name ||
        exp.description !== (game.description ?? null) ||
        exp.genre       !== (game.genre ?? null) ||
        exp.maxPlayers  !== game.maxPlayers

      await db.update(platformExperiences).set({
        activePlayers: game.playing,
        visitCount:    game.visits,
        title:         game.name,
        description:   game.description ?? null,
        genre:         game.genre ?? null,
        maxPlayers:    game.maxPlayers,
        ...(contentChanged ? { needsRescore: true } : {}),
        updatedAt:     new Date(),
      }).where(eq(platformExperiences.id, exp.id))

      if (contentChanged) console.log(`[fetch-roblox] Content change: ${game.name} → flagged for rescore`)
      refreshed.push(exp.slug)
    } catch (err) {
      console.error(`[fetch-roblox] Refresh error for ${exp.universeId}:`, err)
    }
  }

  // ── Insert new experiences ───────────────────────────────────────────────────
  // Pre-fetch all thumbnails in one batch to avoid N sequential HTTP calls
  const validNewIds = newUniverseIdsDeduped.filter(id => {
    const g = gameMap.get(id)
    return g && isValidGame(g)
  })
  const thumbnailMap = await fetchThumbnailsBatch(validNewIds)
  console.log(`[fetch-roblox] Thumbnails fetched: ${thumbnailMap.size}/${validNewIds.length}`)

  for (const universeId of newUniverseIdsDeduped) {
    const game = gameMap.get(universeId)
    if (!game || !isValidGame(game)) continue

    try {
      const thumbnailUrl = thumbnailMap.get(universeId) ?? null
      let slug = slugify(game.name)

      // Resolve slug collision
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
      existingUniverseIds.add(universeId) // prevent dup inserts in same run
      console.log(`[fetch-roblox] Inserted: ${game.name} (${universeId})`)
    } catch (err) {
      console.error(`[fetch-roblox] Insert error for universe ${universeId}:`, err)
      errors.push(universeId)
    }
  }

  // ── Stale-score sweep (rescore experiences older than STALE_SCORE_DAYS) ──────
  const staleCutoff = new Date()
  staleCutoff.setDate(staleCutoff.getDate() - STALE_SCORE_DAYS)

  const staleRows = await db
    .select({ id: experienceScores.experienceId })
    .from(experienceScores)
    .where(lt(experienceScores.calculatedAt, staleCutoff))

  let ageMarked = 0
  if (staleRows.length > 0) {
    const staleIds = staleRows.map(r => r.id)
    await db.update(platformExperiences)
      .set({ needsRescore: true })
      .where(inArray(platformExperiences.id, staleIds))
    ageMarked = staleIds.length
    console.log(`[fetch-roblox] Stale sweep: ${ageMarked} experience(s) flagged (>${STALE_SCORE_DAYS} days old)`)
  }

  return NextResponse.json({
    existing:          existing.length,
    thumbnailsRestored: existingThumbMap.size,
    refreshed:         refreshed.length,
    discovered:        discoveredUniverseIds.size,
    inserted:          inserted.length,
    newGames:          inserted,
    errors:            errors.length,
    ageMarked,
    _debug: {
      gameMapSize:    gameMap.size,
      newUniverseIds: newUniverseIdsDeduped.length,
      allUniverseIds: allUniverseIds.length,
    },
  })
}
