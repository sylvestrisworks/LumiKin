import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { randomBytes } from 'crypto'
import { buildAuthUrl, CLIENT_ID } from '@/lib/xbox/api'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!CLIENT_ID) return NextResponse.json({ error: 'XBOX_CLIENT_ID not configured' }, { status: 500 })

  const appUrl      = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/xbox/connect/callback`
  const state       = randomBytes(16).toString('hex')

  const res = NextResponse.json({ authUrl: buildAuthUrl(state, redirectUri) })
  res.cookies.set('xbox_oauth_state', state, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    maxAge:   600, // 10 minutes
    path:     '/api/xbox/connect/callback',
  })
  return res
}
