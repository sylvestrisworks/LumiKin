/**
 * _replace-cover-asset.ts — upload a local PNG as a Sanity image asset and
 * repoint every locale doc of a given slug at it (preserving coverImage.alt).
 *
 *   npx tsx scripts/_replace-cover-asset.ts <slug> <localPngPath> [--dry]
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { readFileSync } from 'fs'
import { createClient } from '@sanity/client'

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

async function main() {
  const [slug, pngPath, ...rest] = process.argv.slice(2)
  const dry = rest.includes('--dry')
  if (!slug || !pngPath) throw new Error('usage: <slug> <localPngPath> [--dry]')

  const docs: { _id: string; locale: string; alt?: string; oldRef?: string }[] =
    await client.fetch(
      `*[_type in ["guide","post"] && slug.current == $slug]{ _id, locale, "alt": coverImage.alt, "oldRef": coverImage.asset._ref }`,
      { slug },
    )
  console.log(`${docs.length} docs for slug "${slug}":`)
  for (const d of docs) console.log(`  ${d._id} (${d.locale}) old=${d.oldRef}`)
  if (docs.length === 0) return

  if (dry) { console.log('\n[dry] would upload + repoint.'); return }

  const buf = readFileSync(resolve(process.cwd(), pngPath))
  const asset = await client.assets.upload('image', buf, {
    filename: `${slug}-cover.png`,
  })
  console.log(`\nuploaded asset ${asset._id} (${asset.metadata?.dimensions?.width}x${asset.metadata?.dimensions?.height})`)

  for (const d of docs) {
    await client
      .patch(d._id)
      .set({
        'coverImage.asset': { _type: 'reference', _ref: asset._id },
        // keep existing alt; only fill if missing
        ...(d.alt ? {} : { 'coverImage.alt': 'Editorial illustration' }),
      })
      .commit()
    console.log(`  repointed ${d._id} (${d.locale})`)
  }
  console.log('\ndone.')
}

main().catch((e) => { console.error(e); process.exit(1) })
