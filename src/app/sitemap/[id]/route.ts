import { buildAllEntries, renderUrlset, CHUNK_SIZE } from '@/lib/sitemap/build'

export const revalidate = 3600

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const m = /^(\d+)\.xml$/.exec(params.id)
  if (!m) return new Response('Not Found', { status: 404 })

  const id = Number(m[1])
  const all = await buildAllEntries()
  const total = Math.max(1, Math.ceil(all.length / CHUNK_SIZE))
  if (id >= total) return new Response('Not Found', { status: 404 })

  const slice = all.slice(id * CHUNK_SIZE, (id + 1) * CHUNK_SIZE)
  return new Response(renderUrlset(slice), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
