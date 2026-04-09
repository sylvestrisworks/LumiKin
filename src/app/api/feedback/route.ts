import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameFeedback } from '@/lib/db/schema'

const schema = z.object({
  gameSlug: z.string().min(1).max(200),
  type:     z.enum(['too_high', 'too_low', 'outdated', 'missing_info', 'other']),
  comment:  z.string().max(1000).optional(),
})

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { gameSlug, type, comment } = parsed.data

  const [game] = await db.select({ id: games.id }).from(games).where(eq(games.slug, gameSlug)).limit(1)
  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  await db.insert(gameFeedback).values({
    gameId:  game.id,
    type,
    comment: comment ?? null,
    status:  'pending',
  })

  return NextResponse.json({ data: { ok: true } })
}
