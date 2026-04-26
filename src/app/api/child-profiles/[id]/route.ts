import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { childProfiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const ProfileSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  birthDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  platforms:   z.array(z.string()).optional(),
  focusSkills: z.array(z.string()).optional(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getUserId(session: any): string | null {
  return session?.user?.id ?? null
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const userId = await getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = ProfileSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const updateData: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.birthDate) {
    updateData.birthYear = new Date(parsed.data.birthDate).getFullYear()
  }

  const [updated] = await db
    .update(childProfiles)
    .set(updateData)
    .where(and(eq(childProfiles.id, id), eq(childProfiles.userId, userId)))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const userId = await getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  await db
    .delete(childProfiles)
    .where(and(eq(childProfiles.id, id), eq(childProfiles.userId, userId)))

  return NextResponse.json({ ok: true })
}
