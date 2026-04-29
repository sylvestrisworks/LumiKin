import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// Auth protection is handled at the page/layout level via server-side auth() checks.
// Middleware only runs i18n routing — next-auth cannot run in Edge Runtime.
const intlMiddleware = createIntlMiddleware(routing)

export default intlMiddleware

export const config = {
  matcher: ['/((?!api|_next|_vercel|admin(?:/.*)?|studio(?:/.*)?|.*\\..*).*)'],
}
