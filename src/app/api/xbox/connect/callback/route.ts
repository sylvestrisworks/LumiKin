import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { xboxConnections } from '@/lib/db/schema'
import { exchangeCode, authorize, fetchGamertag } from '@/lib/xbox/api'
import { encryptToken } from '@/lib/token-crypto'

const VALID_LOCALES = new Set(['en', 'de', 'es', 'fr', 'sv'])

export async function GET(req: NextRequest) {
  const session = await auth()
  const appUrl  = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'http://localhost:3000'

  const rawLocale = req.cookies.get('NEXT_LOCALE')?.value ?? ''
  const locale    = VALID_LOCALES.has(rawLocale) ? rawLocale : 'en'
  const settings  = `${appUrl}/${locale}/settings/xbox`

  const code          = req.nextUrl.searchParams.get('code')
  const error         = req.nextUrl.searchParams.get('error')
  const returnedState = req.nextUrl.searchParams.get('state')
  const storedState   = req.cookies.get('xbox_oauth_state')?.value

  if (error || !code)                                 return NextResponse.redirect(`${settings}?error=access_denied`)
  if (!storedState || returnedState !== storedState)  return NextResponse.redirect(`${settings}?error=state_mismatch`)
  if (!session?.user?.id)                             return NextResponse.redirect(`${appUrl}/login`)

  const redirectUri = `${appUrl}/api/xbox/connect/callback`

  try {
    // MSA code → tokens → XBL/XSTS → xuid + gamertag
    const tokens = await exchangeCode(code, redirectUri)
    const xsts   = await authorize(tokens.accessToken)
    const gamertag = await fetchGamertag(xsts.xuid, xsts.authHeader)

    const encAccess  = encryptToken(tokens.accessToken)
    const encRefresh = encryptToken(tokens.refreshToken)

    await db.insert(xboxConnections).values({
      userId:       session.user.id,
      xuid:         xsts.xuid,
      gamertag,
      accessToken:  encAccess,
      refreshToken: encRefresh,
      expiresAt:    tokens.expiresAt,
    }).onConflictDoUpdate({
      target: xboxConnections.userId,
      set: {
        xuid:         xsts.xuid,
        gamertag,
        accessToken:  encAccess,
        refreshToken: encRefresh,
        expiresAt:    tokens.expiresAt,
        lastSyncedAt: null,
      },
    })

    const res = NextResponse.redirect(`${settings}?success=1`)
    res.cookies.delete('xbox_oauth_state')
    return res
  } catch (err) {
    console.error('[xbox/connect/callback] Error:', err)
    return NextResponse.redirect(`${settings}?error=server_error`)
  }
}
