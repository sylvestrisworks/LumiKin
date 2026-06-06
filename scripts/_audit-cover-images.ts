/**
 * _audit-cover-images.ts — inspect aspect ratios of editorial cover images.
 *
 * Lists every guide/post that has a coverImage, resolves the underlying asset's
 * stored dimensions, and flags anything that isn't close to the 4:3 the UI
 * renders (DeskRow / detail pages crop to aspect-[4/3] with object-cover).
 *
 *   npx tsx scripts/_audit-cover-images.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createClient } from '@sanity/client'

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

type Row = {
  _id: string
  _type: string
  title: string
  locale: string
  slug: string
  alt?: string
  assetId?: string
  width?: number
  height?: number
  aspectRatio?: number
}

async function main() {
  const rows: Row[] = await client.fetch(`
    *[_type in ["guide","post"] && defined(coverImage.asset)]{
      _id, _type, title, locale,
      "slug": slug.current,
      "alt": coverImage.alt,
      "assetId": coverImage.asset._ref,
      "width": coverImage.asset->metadata.dimensions.width,
      "height": coverImage.asset->metadata.dimensions.height,
      "aspectRatio": coverImage.asset->metadata.dimensions.aspectRatio
    } | order(_type, slug, locale)
  `)

  const TARGET = 4 / 3
  console.log(`\n${rows.length} documents with a cover image.\n`)

  // De-dupe by asset — many locale docs share one image asset.
  const byAsset = new Map<string, Row[]>()
  for (const r of rows) {
    if (!r.assetId) continue
    const list = byAsset.get(r.assetId) ?? []
    list.push(r)
    byAsset.set(r.assetId, list)
  }

  console.log(`${byAsset.size} unique image assets.\n`)
  const flagged: { asset: string; ar: number; dims: string; users: string }[] = []

  for (const [assetId, users] of byAsset) {
    const r = users[0]
    const ar = r.aspectRatio ?? (r.width && r.height ? r.width / r.height : 0)
    const dims = `${r.width}x${r.height}`
    const drift = Math.abs(ar - TARGET)
    const tag =
      ar < 1.05 ? '⚠ SQUARE/PORTRAIT' :
      drift > 0.15 ? '~ off-4:3' : 'ok'
    const slugs = [...new Set(users.map((u) => u.slug))].join(', ')
    console.log(`${tag.padEnd(18)} ar=${ar.toFixed(3)} ${dims.padEnd(11)} ${r._type} ${slugs}`)
    if (tag !== 'ok') flagged.push({ asset: assetId, ar, dims, users: slugs })
  }

  console.log(`\n── ${flagged.length} assets need reformatting ──`)
  for (const f of flagged) console.log(`  ${f.dims} (ar ${f.ar.toFixed(3)})  ${f.users}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
