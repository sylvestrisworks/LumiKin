import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId   = process.env.EPIC_CLIENT_ID
  const appUrl     = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/epic/connect/callback`

  if (!clientId) return NextResponse.json({ error: 'EPIC_CLIENT_ID not configured' }, { status: 500 })

  const authUrl = new URL('https://www.epicgames.com/id/authorize')
  authUrl.searchParams.set('client_id',     clientId)
  authUrl.searchParams.set('redirect_uri',  redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope',         'basic_profile')

  return NextResponse.json({ authUrl: authUrl.toString(), redirectUri })
}
