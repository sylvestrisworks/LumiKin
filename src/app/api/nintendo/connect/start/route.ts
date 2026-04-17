import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { buildAuthUrl, generateVerifier } from '@/lib/nintendo/api'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const verifier = generateVerifier()
  const authUrl  = buildAuthUrl(verifier)

  const res = NextResponse.json({ authUrl })
  res.cookies.set('nintendo_pkce_verifier', verifier, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    maxAge:   600, // 10 minutes — enough to complete the flow
    path:     '/api/nintendo/connect/verify',
  })
  return res
}
