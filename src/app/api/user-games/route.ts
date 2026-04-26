import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { userGames, games, gameScores } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const AddSchema = z.object({
  gameId:   z.number().int().positive(),
  listType: z.enum(['owned', 'wishlist']).default('owned'),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function userId(session: any): string | null {
  return session?.user?.id ?? null
}

export async function GET() {
  const session = await auth()
  const uid = userId(session)
  if (!uid) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const rows = await db
    .select({
      id:                        userGames.id,
      listType:                  userGames.listType,
      addedAt:                   userGames.addedAt,
      gameId:                    games.id,
      slug:                      games.slug,
      title:                     games.title,
      backgroundImage:           games.backgroundImage,
      esrbRating:                games.esrbRating,
      genres:                    games.genres,
      platforms:                 games.platforms,
      hasMicrotransactions:      games.hasMicrotransactions,
      hasLootBoxes:              games.hasLootBoxes,
      curascore:                 gameScores.curascore,
      bds:                       gameScores.bds,
      ris:                       gameScores.ris,
      cognitiveScore:            gameScores.cognitiveScore,
      socialEmotionalScore:      gameScores.socialEmotionalScore,
      motorScore:                gameScores.motorScore,
      timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
      timeRecommendationColor:   gameScores.timeRecommendationColor,
    })
    .from(userGames)
    .innerJoin(games, eq(games.id, userGames.gameId))
    .leftJoin(gameScores, eq(gameScores.gameId, userGames.gameId))
    .where(eq(userGames.userId, uid))

  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const uid = userId(session)
  if (!uid) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = AddSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { gameId, listType } = parsed.data

  // Upsert — ignore if already exists
  const [row] = await db
    .insert(userGames)
    .values({ userId: uid, gameId, listType })
    .onConflictDoNothing()
    .returning()

  return NextResponse.json({ data: row ?? null }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  const uid = userId(session)
  if (!uid) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const gameId   = parseInt(searchParams.get('gameId') ?? '')
  const listType = searchParams.get('listType') ?? ''

  if (isNaN(gameId)) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })
  if (listType !== 'owned' && listType !== 'wishlist') return NextResponse.json({ error: 'Invalid listType' }, { status: 400 })

  await db
    .delete(userGames)
    .where(and(
      eq(userGames.userId, uid),
      eq(userGames.gameId, gameId),
      eq(userGames.listType, listType),
    ))

  return NextResponse.json({ ok: true })
}
