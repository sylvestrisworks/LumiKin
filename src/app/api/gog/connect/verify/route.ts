import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { gogConnections } from '@/lib/db/schema'
import { parseCode, exchangeCode, fetchUsername } from '@/lib/gog/api'
import { encryptToken } from '@/lib/token-crypto'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const pastedUrl = typeof (body as Record<string, unknown>)?.pastedUrl === 'string'
    ? ((body as Record<string, unknown>).pastedUrl as string).trim().slice(0, 2000)
    : null

  if (!pastedUrl) {
    return NextResponse.json({ error: 'Missing pastedUrl — please paste the URL from your browser.' }, { status: 400 })
  }

  try {
    const code   = parseCode(pastedUrl)
    const tokens = await exchangeCode(code)
    const username = await fetchUsername(tokens.accessToken)

    // Encrypt OAuth tokens before persisting.
    const encAccess  = encryptToken(tokens.accessToken)
    const encRefresh = encryptToken(tokens.refreshToken)

    await db.insert(gogConnections).values({
      userId:       session.user.id,
      gogUserId:    tokens.gogUserId,
      username,
      accessToken:  encAccess,
      refreshToken: encRefresh,
      expiresAt:    tokens.expiresAt,
    }).onConflictDoUpdate({
      target: gogConnections.userId,
      set: {
        gogUserId:    tokens.gogUserId,
        username,
        accessToken:  encAccess,
        refreshToken: encRefresh,
        expiresAt:    tokens.expiresAt,
        lastSyncedAt: null,
      },
    })

    console.log(`[gog/connect] User ${session.user.id} connected gogUserId ${tokens.gogUserId}`)
    return NextResponse.json({ ok: true, username })
  } catch (err) {
    console.error('[gog/connect] verify failed:', err)
    const message = err instanceof Error && err.message.startsWith('Could not find')
      ? err.message
      : 'GOG account connection failed — please try again.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
