import { put } from '@vercel/blob'

/**
 * Downloads an image from a URL and uploads it to Vercel Blob.
 * Returns the Blob URL, or null if anything fails.
 *
 * Usage:
 *   const url = await uploadImageFromUrl(rawgUrl, `games/${slug}`)
 */
export async function uploadImageFromUrl(
  sourceUrl: string,
  pathname: string, // e.g. "games/the-witcher-3"
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('[blob] BLOB_READ_WRITE_TOKEN not set — skipping image upload')
    return null
  }

  try {
    const res = await fetch(sourceUrl)
    if (!res.ok) return null

    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const buffer = await res.arrayBuffer()

    const blob = await put(`${pathname}.${ext}`, buffer, {
      access: 'public',
      contentType,
      // Overwrite if a file already exists at this path
      addRandomSuffix: false,
    })

    return blob.url
  } catch (err) {
    console.error('[blob] upload failed:', err)
    return null
  }
}
