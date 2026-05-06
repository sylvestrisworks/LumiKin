/**
 * Simple in-memory sliding-window rate limiter.
 * Per-instance (not distributed), but effective against basic abuse on Vercel.
 * Cold starts reset counts — acceptable for this use case.
 */

interface Window {
  count:     number
  windowEnd: number
}

const store = new Map<string, Window>()

// Prevent unbounded memory growth — evict oldest entries when map gets large
function evict() {
  if (store.size < 5000) return
  const now = Date.now()
  store.forEach((w, key) => {
    if (w.windowEnd < now) store.delete(key)
  })
  // Trim to half if still over threshold
  if (store.size >= 2500) {
    const keys = Array.from(store.keys()).slice(0, store.size - 2500)
    keys.forEach(k => store.delete(k))
  }
}

/**
 * Returns true if the request is allowed, false if rate limited.
 * @param key      Unique key (e.g. `search:1.2.3.4`)
 * @param limit    Max requests per window
 * @param windowMs Window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  evict()
  const now = Date.now()
  const w   = store.get(key)

  if (!w || w.windowEnd < now) {
    store.set(key, { count: 1, windowEnd: now + windowMs })
    return true
  }

  if (w.count >= limit) return false
  w.count++
  return true
}

/**
 * Extract best-effort client IP from a Next.js request.
 *
 * On Vercel the actual client IP is in `x-real-ip`, and the platform appends
 * the real IP to `x-forwarded-for` (so the rightmost entry is trusted, not the
 * leftmost). Reading XFF[0] would let an attacker rotate spoofed values via a
 * forged `X-Forwarded-For` header to bypass per-IP rate limits.
 *
 * Order of preference: x-real-ip > rightmost x-forwarded-for > 'unknown'.
 */
export function getIp(req: Request): string {
  const headers = (req as { headers: Headers }).headers
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean)
    const last = parts[parts.length - 1]
    if (last) return last
  }
  return 'unknown'
}
