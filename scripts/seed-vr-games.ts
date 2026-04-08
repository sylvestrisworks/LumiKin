// Seed known VR titles directly from RAWG by slug
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

import { rawgGetDetail } from '../src/lib/rawg/client'
import { mapDetailToInsert } from '../src/lib/rawg/mapper'
import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'

// RAWG slugs for well-known VR titles
const VR_SLUGS = [
  'beat-saber',
  'superhot-vr',
  'pistol-whip',
  'half-life-alyx',
  'moss',
  'boneworks',
  'the-walking-dead-saints-sinners',
  'lone-echo',
  'resident-evil-7-biohazard',  // has VR mode
]

async function main() {
  console.log(`Seeding ${VR_SLUGS.length} VR games…\n`)
  let ok = 0, fail = 0

  for (const slug of VR_SLUGS) {
    process.stdout.write(`  ${slug}… `)
    try {
      const detail = await rawgGetDetail(slug)
      const data = mapDetailToInsert(detail)

      const [existing] = await db.select({ id: games.id }).from(games).where(eq(games.slug, data.slug)).limit(1)
      if (existing) {
        await db.update(games).set(data).where(eq(games.id, existing.id))
        console.log('updated')
      } else {
        await db.insert(games).values(data)
        console.log('inserted')
      }
      ok++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`FAILED — ${msg}`)
      fail++
    }
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
