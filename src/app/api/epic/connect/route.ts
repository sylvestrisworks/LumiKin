import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { epicConnections, epicLibrary } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { removeOwnedBySource } from '@/lib/library/owned'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ connected: false })

  const [conn] = await db
    .select({
      epicAccountId: epicConnections.epicAccountId,
      displayName:   epicConnections.displayName,
      lastSyncedAt:  epicConnections.lastSyncedAt,
    })
    .from(epicConnections)
    .where(eq(epicConnections.userId, session.user.id))
    .limit(1)

  return NextResponse.json(conn ? { connected: true, ...conn } : { connected: false })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [conn] = await db
    .select({ epicAccountId: epicConnections.epicAccountId })
    .from(epicConnections)
    .where(eq(epicConnections.userId, session.user.id))
    .limit(1)

  if (conn) {
    await Promise.all([
      db.delete(epicConnections).where(eq(epicConnections.userId, session.user.id)),
      db.delete(epicLibrary).where(eq(epicLibrary.userId, session.user.id)),
      // Remove only Epic-sourced owned games — leave Steam/GOG/manual entries intact.
      removeOwnedBySource(session.user.id, 'epic'),
    ])
  }

  return NextResponse.json({ ok: true })
}
