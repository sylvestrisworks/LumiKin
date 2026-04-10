import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { gameTipVotes } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uid = (session?.user as any)?.id ?? session?.user?.email ?? null
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const tipId = parseInt(id)
  if (isNaN(tipId)) return NextResponse.json({ error: 'Invalid tip id' }, { status: 400 })

  // Toggle: remove if exists, insert if not
  const existing = await db
    .select({ id: gameTipVotes.id })
    .from(gameTipVotes)
    .where(and(eq(gameTipVotes.tipId, tipId), eq(gameTipVotes.userId, uid)))
    .limit(1)

  if (existing.length > 0) {
    await db.delete(gameTipVotes).where(eq(gameTipVotes.id, existing[0].id))
    return NextResponse.json({ voted: false })
  } else {
    await db.insert(gameTipVotes).values({ tipId, userId: uid })
    return NextResponse.json({ voted: true })
  }
}
