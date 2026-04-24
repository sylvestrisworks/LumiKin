/**
 * Sets mode-specific backgroundImage for LEGO Fortnite, Fortnite Festival,
 * and Rocket Racing using Epic's own CDN key art sourced from the Epic Store
 * content API (store-content.ak.epicgames.com).
 *
 * Run with:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/set-mode-backgrounds.ts
 */
import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const IMAGES: Record<string, string> = {
  'lego-fortnite':
    'https://cdn2.unrealengine.com/fnjn-40-20-ninjago-egs-launcher-blade-1200x1600-1200x1600-222acf933565.jpg',
  'fortnite-festival':
    'https://cdn2.unrealengine.com/fnsp-40-20-indoorlace-keyart-egs-launcher-blade-1200x1600-1200x1600-db42e9a6948e.jpg',
  'fortnite-rocket-racing':
    'https://cdn2.unrealengine.com/fnrr-30-1200x1600-58e247f3fc84d4e2d89044b95889e80a-1200x1600-a72d32d9ec79.jpg',
}

async function main() {
  for (const [slug, url] of Object.entries(IMAGES)) {
    await db.update(games).set({ backgroundImage: url }).where(eq(games.slug, slug))
    console.log(`✓ ${slug}`)
  }
  console.log('\nDone.')
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
