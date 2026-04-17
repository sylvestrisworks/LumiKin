import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { childProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const ProfileSchema = z.object({
  name:        z.string().min(1).max(100),
  birthDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  platforms:   z.array(z.string()).default([]),
  focusSkills: z.array(z.string()).default([]),
})

export async function GET() {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const profiles = await db
    .select()
    .from(childProfiles)
    .where(eq(childProfiles.userId, userId))

  return NextResponse.json({ data: profiles })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = ProfileSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const birthYear = new Date(parsed.data.birthDate).getFullYear()

  const [profile] = await db
    .insert(childProfiles)
    .values({ userId, ...parsed.data, birthYear })
    .returning()

  return NextResponse.json({ data: profile }, { status: 201 })
}
