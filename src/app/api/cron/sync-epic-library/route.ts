/**
 * GET /api/cron/sync-epic-library
 *
 * For each connected Epic account:
 *   1. Refresh the access token if expired
 *   2. Fetch entitlements (owned catalog items)
 *   3. Upsert into epic_library
 *   4. Best-effort match catalog items → games table → upsert into user_games
 *
 * Runs nightly via GitHub Actions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { epicConnections, epicLibrary, games, userGames } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logCronRun } from '@/lib/cron-logger'

export const maxDuration = 300

const TOKEN_URL        = 'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token'
const ENTITLEMENTS_URL = 'https://entitlements-public-service-prod.ol.epicgames.com/entitlements/api/account'
const CATALOG_URL      = 'https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared-info/bulk/items'

type EpicEntitlement = {
  id:            string
  catalogItemId: string
  namespace:     string
  appName:       string | null
}

type CatalogItem = {
  id:    string
  title: string | null
}

async function refreshToken(conn: typeof epicConnections.$inferSelect): Promise<string | null> {
  if (conn.expiresAt > new Date(Date.now() + 60_000)) return conn.accessToken

  const clientId     = process.env.EPIC_CLIENT_ID!
  const clientSecret = process.env.EPIC_CLIENT_SECRET!
  const creds        = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refreshToken }),
    })
    if (!res.ok) return null

    const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
    await db.update(epicConnections).set({
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      expiresAt:    new Date(Date.now() + data.expires_in * 1000),
    }).where(eq(epicConnections.id, conn.id))

    return data.access_token
  } catch {
    return null
  }
}

async function fetchEntitlements(accountId: string, token: string): Promise<EpicEntitlement[]> {
  try {
    const res = await fetch(`${ENTITLEMENTS_URL}/${accountId}/entitlements?start=0&count=5000`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

async function fetchCatalogTitles(
  items: Array<{ namespace: string; catalogItemId: string }>
): Promise<Map<string, string>> {
  const titleMap = new Map<string, string>()
  if (items.length === 0) return titleMap

  // Batch into groups of 50 (API limit)
  for (let i = 0; i < items.length; i += 50) {
    const batch = items.slice(i, i + 50)
    try {
      const params = new URLSearchParams()
      batch.forEach(({ namespace, catalogItemId }) => {
        params.append('id',        catalogItemId)
        params.append('namespace', namespace)
      })

      const res = await fetch(`${CATALOG_URL}?${params}`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue

      const data = await res.json() as Record<string, CatalogItem>
      for (const [id, item] of Object.entries(data)) {
        if (item.title) titleMap.set(id, item.title)
      }
    } catch {
      // Catalog fetch is best-effort — proceed without titles
    }
  }
  return titleMap
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runStartedAt = new Date()

  const connections = await db.select().from(epicConnections)
  if (connections.length === 0) return NextResponse.json({ ok: true, synced: 0 })

  // Load all game titles for matching (once, shared across all users)
  const allGames = await db.select({ id: games.id, title: games.title }).from(games)
  const gameTitleMap = new Map(allGames.map(g => [g.title.toLowerCase(), g.id]))

  let synced = 0

  for (const conn of connections) {
    const token = await refreshToken(conn)
    if (!token) {
      console.warn(`[sync-epic-library] Token refresh failed for user ${conn.userId}`)
      continue
    }

    const entitlements = await fetchEntitlements(conn.epicAccountId, token)
    if (entitlements.length === 0) {
      console.log(`[sync-epic-library] No entitlements for user ${conn.userId}`)
      continue
    }

    // Fetch catalog titles for best-effort matching
    const titleMap = await fetchCatalogTitles(
      entitlements.map(e => ({ namespace: e.namespace, catalogItemId: e.catalogItemId }))
    )

    // Upsert into epic_library + try to match game IDs
    for (const item of entitlements) {
      const title  = titleMap.get(item.catalogItemId) ?? null
      const gameId = title ? (gameTitleMap.get(title.toLowerCase()) ?? null) : null

      await db
        .insert(epicLibrary)
        .values({
          userId:        conn.userId,
          epicAccountId: conn.epicAccountId,
          catalogItemId: item.catalogItemId,
          namespace:     item.namespace,
          appName:       item.appName ?? null,
          title,
          gameId,
        })
        .onConflictDoUpdate({
          target: [epicLibrary.userId, epicLibrary.catalogItemId],
          set: { title, gameId, appName: item.appName ?? null },
        })

      // Add matched games to user_games library
      if (gameId) {
        await db
          .insert(userGames)
          .values({ userId: conn.userId, gameId, listType: 'owned' })
          .onConflictDoNothing()
      }
    }

    await db.update(epicConnections).set({ lastSyncedAt: new Date() }).where(eq(epicConnections.id, conn.id))
    console.log(`[sync-epic-library] Synced ${entitlements.length} entitlements for user ${conn.userId}`)
    synced++
  }

  await logCronRun('sync-epic-library', runStartedAt, { itemsProcessed: synced, errors: 0 })
  return NextResponse.json({ ok: true, synced, total: connections.length })
}
