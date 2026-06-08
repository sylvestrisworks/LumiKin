import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { buildAuthUrl } from '@/lib/gog/api'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // GOG is a confidential client (client secret), so no PKCE verifier is needed —
  // the user pastes the redirect URL back and we exchange the code server-side.
  return NextResponse.json({ authUrl: buildAuthUrl() })
}
