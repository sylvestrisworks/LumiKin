import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { epicConnections } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const TOKEN_URL = 'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token'
const ACCOUNT_URL = 'https://account-public-service-prod.ol.epicgames.com/account/api/public/account'

export async function GET(req: NextRequest) {
  const session = await auth()
  const appUrl  = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'http://localhost:3000'

  const code          = req.nextUrl.searchParams.get('code')
  const error         = req.nextUrl.searchParams.get('error')
  const returnedState = req.nextUrl.searchParams.get('state')
  const storedState   = req.cookies.get('epic_oauth_state')?.value

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings/epic?error=access_denied`)
  }

  if (!storedState || returnedState !== storedState) {
    return NextResponse.redirect(`${appUrl}/settings/epic?error=state_mismatch`)
  }

  if (!session?.user?.id) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const clientId     = process.env.EPIC_CLIENT_ID!
  const clientSecret = process.env.EPIC_CLIENT_SECRET!
  const redirectUri  = `${appUrl}/api/epic/connect/callback`

  try {
    // Exchange code for tokens
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      console.error('[epic/connect/callback] Token exchange failed:', tokenRes.status)
      return NextResponse.redirect(`${appUrl}/settings/epic?error=token_failed`)
    }

    const tokens = await tokenRes.json() as {
      access_token:  string
      refresh_token: string
      expires_in:    number
      account_id:    string
    }

    // Fetch Epic account profile
    const profileRes = await fetch(`${ACCOUNT_URL}/${tokens.account_id}`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json() as { id: string; displayName?: string }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Upsert connection
    await db
      .insert(epicConnections)
      .values({
        userId:        session.user.id,
        epicAccountId: tokens.account_id,
        displayName:   profile.displayName ?? null,
        accessToken:   tokens.access_token,
        refreshToken:  tokens.refresh_token,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: epicConnections.userId,
        set: {
          epicAccountId: tokens.account_id,
          displayName:   profile.displayName ?? null,
          accessToken:   tokens.access_token,
          refreshToken:  tokens.refresh_token,
          expiresAt,
        },
      })

    // Detect locale from cookie for redirect
    const locale = req.cookies.get('NEXT_LOCALE')?.value ?? 'en'
    const res = NextResponse.redirect(`${appUrl}/${locale}/settings/epic?success=1`)
    res.cookies.delete('epic_oauth_state')
    return res
  } catch (err) {
    console.error('[epic/connect/callback] Error:', err)
    return NextResponse.redirect(`${appUrl}/settings/epic?error=server_error`)
  }
}
