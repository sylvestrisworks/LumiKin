import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { gameTips } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { z } from 'zod'

const TipSchema = z.object({
  gameId:  z.number().int().positive(),
  content: z.string().min(1).max(280),
  tipType: z.enum(['tip', 'warning', 'praise']),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uid = (session?.user as any)?.id ?? session?.user?.email ?? null
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = TipSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { gameId, content, tipType } = parsed.data

  // Rate limit: max 3 tips per user per game
  const [{ value }] = await db
    .select({ value: count() })
    .from(gameTips)
    .where(and(eq(gameTips.gameId, gameId), eq(gameTips.userId, uid)))

  if (value >= 3) {
    return NextResponse.json({ error: 'You have reached the limit of 3 tips per game.' }, { status: 429 })
  }

  // Derive author display name from session
  const rawName = session?.user?.name ?? session?.user?.email ?? ''
  const authorName = rawName.includes('@')
    ? rawName.split('@')[0]
    : rawName.split(' ')[0] || 'A parent'

  const [tip] = await db.insert(gameTips).values({
    gameId,
    userId: uid,
    authorName,
    content: content.trim(),
    tipType,
  }).returning()

  return NextResponse.json({ data: tip }, { status: 201 })
}
