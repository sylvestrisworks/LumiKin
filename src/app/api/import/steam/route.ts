import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { games, gameScores, userGames } from '@/lib/db/schema'
import { eq, and, ilike, sql } from 'drizzle-orm'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'

const STEAM_API = 'https://api.steampowered.com'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveSteamId(input: string): Promise<string | null> {
  const key = process.env.STEAM_API_KEY
  if (!key) return null

  // Already a 64-bit Steam ID
  if (/^\d{17}$/.test(input.trim())) return input.trim()

  // Profile URL: extract vanity name or direct ID
  const vanityMatch = input.match(/steamcommunity\.com\/id\/([^/?#]+)/)
  const profileMatch = input.match(/steamcommunity\.com\/profiles\/(\d{17})/)

  if (profileMatch) return profileMatch[1]

  if (vanityMatch) {
    const vanity = vanityMatch[1]
    const res = await fetch(
      `${STEAM_API}/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(vanity)}`
    )
    const json = await res.json()
    if (json?.response?.success === 1) return json.response.steamid
    return null
  }

  // Bare vanity name (no URL)
  const bare = input.trim().replace(/^@/, '')
  if (bare && !/[^a-zA-Z0-9_-]/.test(bare)) {
    const res = await fetch(
      `${STEAM_API}/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(bare)}`
    )
    const json = await res.json()
    if (json?.response?.success === 1) return json.response.steamid
  }

  return null
}

type SteamGame = { appid: number; name: string; playtime_forever: number }

async function fetchSteamLibrary(steamId: string): Promise<SteamGame[] | null> {
  const key = process.env.STEAM_API_KEY
  if (!key) return null

  const url = `${STEAM_API}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}&include_appinfo=true&format=json`
  const res = await fetch(url)
  if (!res.ok) return null

  const json = await res.json()
  const gamesList: SteamGame[] = json?.response?.games ?? []
  // Sort by playtime so most-played (most relevant) games are matched first
  return gamesList.sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 200)
}

// Normalise title for loose matching: lowercase, strip punctuation, collapse spaces
function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

// ── Main route ────────────────────────────────────────────────────────────────

const BodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('preview'), steamInput: z.string().min(1) }),
  z.object({ action: z.literal('confirm'), gameIds: z.array(z.number().int().positive()) }),
])

export async function POST(req: NextRequest) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uid = (session?.user as any)?.id ?? session?.user?.email ?? null
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 5 requests per minute per user — enough for a normal import flow
  if (!rateLimit(`steam-import:${uid}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // ── ACTION: preview ────────────────────────────────────────────────────────
  if (parsed.data.action === 'preview') {
    const { steamInput } = parsed.data

    if (!process.env.STEAM_API_KEY) {
      return NextResponse.json({ error: 'Steam API not configured on this server.' }, { status: 503 })
    }

    const steamId = await resolveSteamId(steamInput)
    if (!steamId) {
      return NextResponse.json({ error: 'Could not find a Steam account for that ID or URL. Make sure your profile is public.' }, { status: 404 })
    }

    const steamGames = await fetchSteamLibrary(steamId)
    if (!steamGames) {
      return NextResponse.json({ error: 'Could not fetch your Steam library. Make sure your game list is set to public in Steam Privacy Settings.' }, { status: 404 })
    }

    if (steamGames.length === 0) {
      return NextResponse.json({ error: 'Your Steam library appears to be empty or private.' }, { status: 404 })
    }

    // Fetch user's already-owned game IDs to skip them
    const alreadyOwned = await db
      .select({ gameId: userGames.gameId })
      .from(userGames)
      .where(and(eq(userGames.userId, uid), eq(userGames.listType, 'owned')))
    const ownedSet = new Set(alreadyOwned.map(r => r.gameId))

    // Build a map of all our games: normalised title → { id, slug, title, curascore }
    const allGames = await db
      .select({
        id:        games.id,
        slug:      games.slug,
        title:     games.title,
        curascore: gameScores.curascore,
      })
      .from(games)
      .leftJoin(gameScores, eq(gameScores.gameId, games.id))

    const gameMap = new Map<string, typeof allGames[0]>()
    for (const g of allGames) {
      gameMap.set(normalise(g.title), g)
    }

    type MatchedGame = { gameId: number; slug: string; title: string; curascore: number | null; steamName: string; alreadyOwned: boolean }
    type UnmatchedGame = { steamName: string; appid: number }

    const matched: MatchedGame[] = []
    const unmatched: UnmatchedGame[] = []

    for (const sg of steamGames) {
      const norm = normalise(sg.name)
      let found = gameMap.get(norm) ?? null

      // Fallback: try stripping common suffixes (™, ®, edition markers)
      if (!found) {
        const stripped = norm.replace(/\b(definitive|complete|goty|game of the year|remastered|deluxe|gold|standard)\b/g, '').replace(/\s+/g, ' ').trim()
        found = gameMap.get(stripped) ?? null
      }

      if (found) {
        matched.push({
          gameId:       found.id,
          slug:         found.slug,
          title:        found.title,
          curascore:    found.curascore ?? null,
          steamName:    sg.name,
          alreadyOwned: ownedSet.has(found.id),
        })
      } else {
        unmatched.push({ steamName: sg.name, appid: sg.appid })
      }
    }

    // Dedupe matched by gameId (same game might match multiple steam entries)
    const seenIds = new Set<number>()
    const dedupedMatched = matched.filter(m => {
      if (seenIds.has(m.gameId)) return false
      seenIds.add(m.gameId)
      return true
    })

    return NextResponse.json({
      steamId,
      totalSteamGames: steamGames.length,
      matched: dedupedMatched,
      unmatched: unmatched.slice(0, 50), // cap unmatched list for UI
      unmatchedTotal: unmatched.length,
    })
  }

  // ── ACTION: confirm ────────────────────────────────────────────────────────
  if (parsed.data.action === 'confirm') {
    const { gameIds } = parsed.data

    if (gameIds.length === 0) return NextResponse.json({ added: 0 })

    // Only insert games not already owned
    const alreadyOwned = await db
      .select({ gameId: userGames.gameId })
      .from(userGames)
      .where(and(eq(userGames.userId, uid), eq(userGames.listType, 'owned')))
    const ownedSet = new Set(alreadyOwned.map(r => r.gameId))

    const toInsert = gameIds
      .filter(id => !ownedSet.has(id))
      .map(gameId => ({ userId: uid, gameId, listType: 'owned' as const }))

    if (toInsert.length > 0) {
      try {
        await db.insert(userGames).values(toInsert).onConflictDoNothing()
      } catch (err) {
        console.error('[import/steam] Insert failed — invalid gameId in batch:', err)
        return NextResponse.json({ error: 'Some game IDs were invalid' }, { status: 400 })
      }
    }

    return NextResponse.json({ added: toInsert.length })
  }
}
