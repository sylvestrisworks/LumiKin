import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { randomBytes } from 'crypto'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId    = process.env.EPIC_CLIENT_ID
  const appUrl      = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/epic/connect/callback`

  if (!clientId) return NextResponse.json({ error: 'EPIC_CLIENT_ID not configured' }, { status: 500 })

  const state = randomBytes(16).toString('hex')

  const authUrl = new URL('https://www.epicgames.com/id/authorize')
  authUrl.searchParams.set('client_id',     clientId)
  authUrl.searchParams.set('redirect_uri',  redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope',         'basic_profile')
  authUrl.searchParams.set('state',         state)

  const res = NextResponse.json({ authUrl: authUrl.toString(), redirectUri })
  res.cookies.set('epic_oauth_state', state, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    maxAge:   600, // 10 minutes
    path:     '/api/epic/connect/callback',
  })
  return res
}
