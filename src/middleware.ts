import createIntlMiddleware from 'next-intl/middleware'
import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

const LOCALES_PATTERN = routing.locales.join('|')
const REVIEW_RE = new RegExp(`^/(?:(?:${LOCALES_PATTERN})/)?review`)

export async function middleware(req: NextRequest) {
  // Run i18n routing first (adds locale prefix, sets cookie)
  const intlResponse = intlMiddleware(req)

  // Protect review routes — redirect to login if no session token
  if (REVIEW_RE.test(req.nextUrl.pathname)) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      const locale = req.cookies.get('NEXT_LOCALE')?.value ?? routing.defaultLocale
      const loginUrl = new URL(`/${locale}/login`, req.url)
      loginUrl.searchParams.set('callbackUrl', req.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return intlResponse
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
