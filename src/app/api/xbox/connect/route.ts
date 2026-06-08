import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { xboxConnections, xboxLibrary } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { removeOwnedBySource } from '@/lib/library/owned'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ connected: false })

  const [conn] = await db
    .select({
      xuid:         xboxConnections.xuid,
      gamertag:     xboxConnections.gamertag,
      lastSyncedAt: xboxConnections.lastSyncedAt,
    })
    .from(xboxConnections)
    .where(eq(xboxConnections.userId, session.user.id))
    .limit(1)

  return NextResponse.json(conn ? { connected: true, ...conn } : { connected: false })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await Promise.all([
    db.delete(xboxConnections).where(eq(xboxConnections.userId, session.user.id)),
    db.delete(xboxLibrary).where(eq(xboxLibrary.userId, session.user.id)),
    // Remove only Xbox-sourced owned games — leave Steam/Epic/GOG/manual intact.
    removeOwnedBySource(session.user.id, 'xbox'),
  ])

  return NextResponse.json({ ok: true })
}
