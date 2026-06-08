/**
 * GET /api/cron/sync-xbox-library
 *
 * For each connected Xbox account:
 *   1. Refresh the MSA access token if expired
 *   2. Re-derive XBL→XSTS auth, fetch title history
 *   3. Upsert into xbox_library
 *   4. Best-effort match titles → games table → upsert into user_games (source 'xbox')
 *
 * Runs nightly via GitHub Actions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { xboxConnections, xboxLibrary } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logCronRun } from '@/lib/cron-logger'
import { decryptToken, encryptToken } from '@/lib/token-crypto'
import { refreshAccessToken, authorize, fetchTitleHistory } from '@/lib/xbox/api'
import { buildGameTitleMap, matchTitle } from '@/lib/library/match'
import { upsertOwnedGames } from '@/lib/library/owned'

export const maxDuration = 300

/** Returns a valid MSA access token, refreshing + persisting if expired. */
async function validAccessToken(
  conn: typeof xboxConnections.$inferSelect,
  redirectUri: string,
): Promise<string | null> {
  let plainAccess: string
  let plainRefresh: string
  try {
    plainAccess  = decryptToken(conn.accessToken)
    plainRefresh = decryptToken(conn.refreshToken)
  } catch (err) {
    console.error('[sync-xbox-library] Failed to decrypt tokens for connection', conn.id, err)
    return null
  }

  if (conn.expiresAt > new Date(Date.now() + 60_000)) return plainAccess

  try {
    const tokens = await refreshAccessToken(plainRefresh, redirectUri)
    await db.update(xboxConnections).set({
      accessToken:  encryptToken(tokens.accessToken),
      refreshToken: encryptToken(tokens.refreshToken),
      expiresAt:    tokens.expiresAt,
    }).where(eq(xboxConnections.id, conn.id))
    return tokens.accessToken
  } catch (err) {
    console.warn('[sync-xbox-library] Token refresh failed for user', conn.userId, err)
    return null
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runStartedAt = new Date()
  const appUrl       = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
  const redirectUri  = `${appUrl}/api/xbox/connect/callback`

  const connections = await db.select().from(xboxConnections)
  if (connections.length === 0) return NextResponse.json({ ok: true, synced: 0 })

  const gameTitleMap = await buildGameTitleMap({ withScores: false })

  let synced = 0

  for (const conn of connections) {
    const accessToken = await validAccessToken(conn, redirectUri)
    if (!accessToken) continue

    let titles
    try {
      const xsts = await authorize(accessToken)
      titles = await fetchTitleHistory(xsts.xuid, xsts.authHeader)
    } catch (err) {
      console.warn('[sync-xbox-library] Title fetch failed for user', conn.userId, err)
      continue
    }

    if (titles.length === 0) {
      console.log(`[sync-xbox-library] No titles for user ${conn.userId}`)
      continue
    }

    const matchedGameIds: number[] = []
    for (const t of titles) {
      const gameId = matchTitle(t.name, gameTitleMap)?.id ?? null

      await db
        .insert(xboxLibrary)
        .values({ userId: conn.userId, xuid: conn.xuid, titleId: t.titleId, name: t.name, gameId })
        .onConflictDoUpdate({
          target: [xboxLibrary.userId, xboxLibrary.titleId],
          set: { name: t.name, gameId },
        })

      if (gameId) matchedGameIds.push(gameId)
    }

    await upsertOwnedGames(conn.userId, matchedGameIds, 'xbox')

    await db.update(xboxConnections).set({ lastSyncedAt: new Date() }).where(eq(xboxConnections.id, conn.id))
    console.log(`[sync-xbox-library] Synced ${titles.length} titles for user ${conn.userId}`)
    synced++
  }

  await logCronRun('sync-xbox-library', runStartedAt, { itemsProcessed: synced, errors: 0 })
  return NextResponse.json({ ok: true, synced, total: connections.length })
}
