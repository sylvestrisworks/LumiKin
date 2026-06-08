/**
 * GET /api/cron/sync-gog-library
 *
 * For each connected GOG account:
 *   1. Refresh the access token if expired
 *   2. Fetch owned products (with titles)
 *   3. Upsert into gog_library
 *   4. Best-effort match products → games table → upsert into user_games (source 'gog')
 *
 * Runs nightly via GitHub Actions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gogConnections, gogLibrary } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logCronRun } from '@/lib/cron-logger'
import { decryptToken, encryptToken } from '@/lib/token-crypto'
import { refreshAccessToken, fetchOwnedProducts } from '@/lib/gog/api'
import { buildGameTitleMap, matchTitle } from '@/lib/library/match'
import { upsertOwnedGames } from '@/lib/library/owned'

export const maxDuration = 300

/** Returns a valid access token, refreshing + persisting if expired. */
async function validAccessToken(conn: typeof gogConnections.$inferSelect): Promise<string | null> {
  let plainAccess: string
  let plainRefresh: string
  try {
    plainAccess  = decryptToken(conn.accessToken)
    plainRefresh = decryptToken(conn.refreshToken)
  } catch (err) {
    console.error('[sync-gog-library] Failed to decrypt tokens for connection', conn.id, err)
    return null
  }

  if (conn.expiresAt > new Date(Date.now() + 60_000)) return plainAccess

  try {
    const tokens = await refreshAccessToken(plainRefresh)
    await db.update(gogConnections).set({
      accessToken:  encryptToken(tokens.accessToken),
      refreshToken: encryptToken(tokens.refreshToken),
      expiresAt:    tokens.expiresAt,
    }).where(eq(gogConnections.id, conn.id))
    return tokens.accessToken
  } catch (err) {
    console.warn('[sync-gog-library] Token refresh failed for user', conn.userId, err)
    return null
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runStartedAt = new Date()

  const connections = await db.select().from(gogConnections)
  if (connections.length === 0) return NextResponse.json({ ok: true, synced: 0 })

  // Load all game titles for matching (once, shared across all users).
  const gameTitleMap = await buildGameTitleMap({ withScores: false })

  let synced = 0

  for (const conn of connections) {
    const token = await validAccessToken(conn)
    if (!token) continue

    const products = await fetchOwnedProducts(token)
    if (products.length === 0) {
      console.log(`[sync-gog-library] No products for user ${conn.userId}`)
      continue
    }

    const matchedGameIds: number[] = []
    for (const p of products) {
      const gameId = matchTitle(p.title, gameTitleMap)?.id ?? null

      await db
        .insert(gogLibrary)
        .values({
          userId:    conn.userId,
          gogUserId: conn.gogUserId,
          productId: p.productId,
          title:     p.title,
          gameId,
        })
        .onConflictDoUpdate({
          target: [gogLibrary.userId, gogLibrary.productId],
          set: { title: p.title, gameId },
        })

      if (gameId) matchedGameIds.push(gameId)
    }

    // Add matched games to the user's owned library, tagged as GOG-sourced
    await upsertOwnedGames(conn.userId, matchedGameIds, 'gog')

    await db.update(gogConnections).set({ lastSyncedAt: new Date() }).where(eq(gogConnections.id, conn.id))
    console.log(`[sync-gog-library] Synced ${products.length} products for user ${conn.userId}`)
    synced++
  }

  await logCronRun('sync-gog-library', runStartedAt, { itemsProcessed: synced, errors: 0 })
  return NextResponse.json({ ok: true, synced, total: connections.length })
}
