import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { gogConnections, gogLibrary } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { removeOwnedBySource } from '@/lib/library/owned'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ connected: false })

  const [conn] = await db
    .select({
      gogUserId:    gogConnections.gogUserId,
      username:     gogConnections.username,
      lastSyncedAt: gogConnections.lastSyncedAt,
    })
    .from(gogConnections)
    .where(eq(gogConnections.userId, session.user.id))
    .limit(1)

  return NextResponse.json(conn ? { connected: true, ...conn } : { connected: false })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await Promise.all([
    db.delete(gogConnections).where(eq(gogConnections.userId, session.user.id)),
    db.delete(gogLibrary).where(eq(gogLibrary.userId, session.user.id)),
    // Remove only GOG-sourced owned games — leave Steam/Epic/manual entries intact.
    removeOwnedBySource(session.user.id, 'gog'),
  ])

  return NextResponse.json({ ok: true })
}
