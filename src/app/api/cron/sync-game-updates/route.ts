/**
 * GET /api/cron/sync-game-updates
 *
 * Marks games for re-scoring when they have changed since their last review.
 * Two triggers:
 *
 *   1. RAWG-triggered: fetches the 40 most recently updated games from RAWG and
 *      marks any already in our DB as needsRescore when RAWG's `updated` timestamp
 *      is newer than our stored rawgUpdatedAt.
 *
 *   2. Age-based sweep: marks needsRescore on any scored game whose score is
 *      older than STALE_DAYS (default 180 days). Ensures all games get periodically
 *      re-evaluated even if RAWG doesn't flag them.
 *
 * The review-games cron picks up needsRescore=true games alongside unreviewed ones.
 *
 * Runs daily via GitHub Actions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { and, eq, inArray, lt, sql } from 'drizzle-orm'

export const maxDuration = 60

const RAWG_API_KEY  = process.env.RAWG_API_KEY
const STALE_DAYS    = 180   // re-score after 6 months regardless of RAWG changes
const RAWG_PAGE_SIZE = 40   // max RAWG returns per page

type RawgGame = {
  id: number
  updated: string  // ISO date string
}

async function fetchRecentlyUpdatedFromRawg(): Promise<RawgGame[]> {
  if (!RAWG_API_KEY) return []

  // Look back 30 days for recently changed games on RAWG
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceStr = since.toISOString().slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)

  try {
    const url = `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&ordering=-updated&dates=${sinceStr},${todayStr}&page_size=${RAWG_PAGE_SIZE}`
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`[sync-game-updates] RAWG fetch failed: ${res.status}`)
      return []
    }
    const data = await res.json() as { results?: RawgGame[] }
    return data.results ?? []
  } catch (err) {
    console.error('[sync-game-updates] RAWG error:', err)
    return []
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let rawgMarked = 0
  let ageMarked  = 0

  // ── 1. RAWG-triggered rescore ──────────────────────────────────────────────
  const recentRawg = await fetchRecentlyUpdatedFromRawg()

  if (recentRawg.length > 0) {
    const rawgIds = recentRawg.map(g => g.id)

    // Find games we have that match these RAWG IDs
    const matching = await db
      .select({ id: games.id, rawgId: games.rawgId, rawgUpdatedAt: games.rawgUpdatedAt })
      .from(games)
      .where(inArray(games.rawgId, rawgIds))

    for (const row of matching) {
      if (!row.rawgId) continue
      const rawgGame = recentRawg.find(g => g.id === row.rawgId)
      if (!rawgGame) continue

      const rawgUpdated  = new Date(rawgGame.updated)
      const ourUpdatedAt = row.rawgUpdatedAt

      // Mark stale if RAWG shows a newer update than we recorded
      if (!ourUpdatedAt || rawgUpdated > ourUpdatedAt) {
        await db.update(games).set({
          needsRescore:  true,
          rawgUpdatedAt: rawgUpdated,
        }).where(eq(games.id, row.id))
        rawgMarked++
        console.log(`[sync-game-updates] RAWG update detected for game id ${row.id}`)
      }
    }
  }

  // ── 2. Age-based sweep ─────────────────────────────────────────────────────
  const staleCutoff = new Date()
  staleCutoff.setDate(staleCutoff.getDate() - STALE_DAYS)

  // Find game IDs with stale scores (and not already flagged)
  const staleScores = await db
    .select({ gameId: gameScores.gameId })
    .from(gameScores)
    .innerJoin(games, eq(gameScores.gameId, games.id))
    .where(
      and(
        lt(gameScores.calculatedAt, staleCutoff),
        eq(games.needsRescore, false),
      )
    )

  if (staleScores.length > 0) {
    const staleGameIds = staleScores.map(s => s.gameId)
    await db.update(games)
      .set({ needsRescore: true })
      .where(inArray(games.id, staleGameIds))
    ageMarked = staleGameIds.length
    console.log(`[sync-game-updates] Age sweep: marked ${ageMarked} games stale (>${STALE_DAYS} days old)`)
  }

  // ── 3. Report queue depth ──────────────────────────────────────────────────
  const [{ count: queued }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(games)
    .where(eq(games.needsRescore, true))

  return NextResponse.json({
    rawgMarked,
    ageMarked,
    totalQueued: Number(queued),
  })
}
