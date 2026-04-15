/**
 * GET /api/cron/sync-nintendo
 *
 * Daily sync of Nintendo Switch play time via the Parental Controls (Moon) API.
 * For each connected Nintendo account:
 *   1. Exchange stored session_token for a fresh access_token
 *   2. List devices registered with parental controls
 *   3. Fetch last 7 days of daily summaries per device
 *   4. Upsert play time rows into nintendo_playtime
 *
 * Runs daily via GitHub Actions. Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { nintendoConnections, nintendoPlaytime } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  getAccessToken, getNaId, getDevices,
  getDailySummaries, aggregatePlayTime,
} from '@/lib/nintendo/api'

export const maxDuration = 60

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connections = await db.select().from(nintendoConnections)

  if (connections.length === 0)
    return NextResponse.json({ message: 'No Nintendo accounts connected', synced: 0 })

  console.log(`[sync-nintendo] Syncing ${connections.length} connection(s)`)

  let synced = 0
  const errors: string[] = []

  for (const conn of connections) {
    try {
      await sleep(200)

      const { accessToken } = await getAccessToken(conn.sessionToken)
      const devices         = await getDevices(conn.naId, accessToken)

      if (devices.length === 0) {
        console.log(`[sync-nintendo] No devices for naId ${conn.naId}`)
        continue
      }

      let rowsUpserted = 0

      for (const device of devices) {
        const deviceId   = device.deviceId ?? (device as Record<string, unknown>).id as string
        const deviceName = device.label ?? null
        if (!deviceId) continue

        const summaries = await getDailySummaries(deviceId, accessToken)

        for (const summary of summaries) {
          const byApp = aggregatePlayTime(summary)

          for (const [appId, { playTimeMinutes, title, imageUrl }] of Array.from(byApp)) {
            if (playTimeMinutes <= 0) continue

            await db.insert(nintendoPlaytime).values({
              userId:          conn.userId,
              naId:            conn.naId,
              deviceId,
              deviceName,
              date:            summary.date,
              appId,
              appTitle:        title,
              appImageUrl:     imageUrl,
              playTimeMinutes,
            }).onConflictDoUpdate({
              target: [nintendoPlaytime.naId, nintendoPlaytime.deviceId, nintendoPlaytime.date, nintendoPlaytime.appId],
              set:    { playTimeMinutes, appTitle: title, appImageUrl: imageUrl },
            })

            rowsUpserted++
          }
        }
      }

      await db.update(nintendoConnections)
        .set({ lastSyncedAt: new Date() })
        .where(eq(nintendoConnections.id, conn.id))

      synced++
      console.log(`[sync-nintendo] naId ${conn.naId} → ${rowsUpserted} rows upserted`)
    } catch (err) {
      console.error(`[sync-nintendo] Failed for naId ${conn.naId}:`, err)
      errors.push(conn.naId)
    }
  }

  return NextResponse.json({ synced, errors: errors.length, errorIds: errors })
}
