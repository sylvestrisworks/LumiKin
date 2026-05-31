import { buildAllEntries, renderIndex, CHUNK_SIZE } from '@/lib/sitemap/build'

// 1h cache: Google crawls each chunk + the index in quick succession, so we
// avoid hitting the DB 14× per crawl. Sitemap freshness within an hour is fine.
export const revalidate = 3600

export async function GET(): Promise<Response> {
  const all = await buildAllEntries()
  const chunkCount = Math.max(1, Math.ceil(all.length / CHUNK_SIZE))
  const xml = renderIndex(chunkCount, new Date().toISOString())
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
