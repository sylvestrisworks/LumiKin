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
  for (const [key, w] of store) {
    if (w.windowEnd < now) store.delete(key)
    if (store.size < 2500) break
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

/** Extract best-effort client IP from a Next.js request */
export function getIp(req: Request): string {
  const headers = (req as { headers: Headers }).headers
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  )
}
