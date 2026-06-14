// Image host allowlist guard.
//
// `next/image` THROWS (and 500s the whole page) when given a `src` whose host
// is not configured in next.config.js `images.remotePatterns`. A single bad
// ingested image URL — e.g. an `upload.wikimedia.org` link that slipped into a
// game's background image — therefore takes down any page that lists that game.
//
// This guard mirrors the next.config allowlist. Pass game/experience artwork
// through `safeImageUrl()` before handing it to `next/image`; an un-allowlisted
// host returns null so the component falls back to its placeholder instead of
// crashing.
//
// Keep this list in sync with `images.remotePatterns` in next.config.js.

const EXACT_HOSTS = new Set([
  'media.rawg.io',
  'images.igdb.com',
  'cdn.sanity.io',
  'img2.fortnitemaps.com',
  'cdn2.unrealengine.com',
  'tr.rbxcdn.com',
])

const SUFFIX_HOSTS = [
  '.qstv.on.epicgames.com',
  '.public.blob.vercel-storage.com',
  '.rbxcdn.com',
]

export function isAllowedImageHost(url: string | null | undefined): boolean {
  if (!url) return false
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return false
  }
  if (EXACT_HOSTS.has(host)) return true
  return SUFFIX_HOSTS.some((suffix) => host.endsWith(suffix))
}

/**
 * Returns the URL only if its host is allowlisted for `next/image`; otherwise
 * null, so callers can render their placeholder instead of crashing.
 */
export function safeImageUrl(url: string | null | undefined): string | null {
  return isAllowedImageHost(url) ? (url as string) : null
}
