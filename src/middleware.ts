import createIntlMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'

// Auth protection is handled at the page/layout level via server-side auth() checks.
// This middleware does three things, in order:
//   1. Block disallowed bots at the edge with 403 (robots.txt is voluntary).
//   2. Rate-limit per-IP so no single client can blow up the request bill.
//   3. Hand off to next-intl for locale routing.
//
// The allow list (Googlebot, GPTBot, ClaudeBot, etc.) is handled passively —
// they don't match BLOCKED_UA_RE so they pass through unchanged. Keep the
// blocked list in sync with DISALLOW_BOTS in src/app/robots.ts.
const intlMiddleware = createIntlMiddleware(routing)

const BLOCKED_UA_RE =
  /(AhrefsBot|SemrushBot|DotBot|MJ12bot|DataForSeoBot|Bytespider|PetalBot|SeznamBot)/i

// Trusted search bots skip rate-limiting. UA strings are spoofable; proper
// verification needs reverse DNS (e.g. crawl-66-249-66-1.googlebot.com →
// resolves back to the same IP). Fine to trust UA until we see abuse.
const TRUSTED_BOT_RE = /(Googlebot|Bingbot)/i

const RATE_LIMIT = 120
const WINDOW_MS = 60_000
const MAX_BUCKETS = 10_000

// In-memory bucket per Lambda instance. Vercel can spin up many instances,
// so the effective ceiling is (instances × RATE_LIMIT). For a real cap,
// move to Vercel KV or use the Vercel WAF rate-limit rule (see notes).
const buckets = new Map<string, { count: number; resetAt: number }>()

function compactIfNeeded(now: number) {
  if (buckets.size <= MAX_BUCKETS) return
  // forEach instead of for..of — tsconfig has no `target` so TS defaults to ES3
  // and rejects direct Map iteration. forEach works under any target.
  buckets.forEach((b, ip) => {
    if (b.resetAt < now) buckets.delete(ip)
  })
}

function allowRequest(ip: string): boolean {
  const now = Date.now()
  compactIfNeeded(now)
  const bucket = buckets.get(ip)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  bucket.count += 1
  return bucket.count <= RATE_LIMIT
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export default function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? ''

  if (BLOCKED_UA_RE.test(ua)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!TRUSTED_BOT_RE.test(ua) && !allowRequest(clientIp(req))) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': '60' },
    })
  }

  const response = intlMiddleware(req)

  // Promote next-intl's 307 locale-prefix redirects to 308 so Google fully
  // consolidates ranking signal across /game/X (no locale) and /en/game/X
  // (canonical). 307 is temporary and leaves Google indexing both variants;
  // 308 is permanent and preserves the method (unlike 301). next-intl has
  // no built-in option to change the status, so we rewrite at the boundary.
  // Note: this does NOT touch the www→apex redirect, which is owned by
  // Vercel platform config and must be fixed in the Vercel dashboard.
  if (
    response.status >= 300 && response.status < 400 &&
    response.headers.get('location')
  ) {
    return new NextResponse(null, {
      status: 308,
      headers: response.headers,
    })
  }

  return response
}

// Matcher already excludes /api, /_next, /_vercel, /admin, /studio, and any
// path with a file extension (so /robots.txt, /sitemap.xml, /favicon.ico
// pass through untouched). API routes are excluded because next-intl would
// rewrite them; if you need rate-limiting on /api, layer the Vercel WAF.
export const config = {
  matcher: ['/((?!api|_next|_vercel|admin(?:/.*)?|studio(?:/.*)?|design-preview(?:/.*)?|.*\\..*).*)'],
}
