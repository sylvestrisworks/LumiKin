/**
 * Sets backgroundImage for classic/legacy games (Solitaire, Minesweeper).
 *
 * Run with:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/set-legacy-backgrounds.ts
 */
import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { or, like } from 'drizzle-orm'
import { eq } from 'drizzle-orm'

async function main() {
  // First, find the slugs
  const rows = await db
    .select({ slug: games.slug, title: games.title, backgroundImage: games.backgroundImage })
    .from(games)
    .where(or(like(games.slug, '%solitaire%'), like(games.slug, '%minesweeper%')))

  console.log('Found games:', JSON.stringify(rows, null, 2))

  const IMAGES: Record<string, string> = {
    // Solitaire (Classic) — Microsoft Solitaire Collection header art via Steam CDN
    'solitaire-classic':
      'https://cdn.akamai.steamstatic.com/steam/apps/1108770/capsule_616x353.jpg',
    // Minesweeper (Classic) — Windows Vista era screenshot via Wikimedia Commons (CC BY 2.5)
    'minesweeper-classic':
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Minesweeper_on_Vista.png/1280px-Minesweeper_on_Vista.png',
    // Microsoft Minesweeper — same Wikimedia image fallback
    'microsoft-minesweeper':
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Minesweeper_on_Vista.png/1280px-Minesweeper_on_Vista.png',
    // Microsoft Solitaire Collection — Steam CDN header
    'microsoft-solitaire-collection':
      'https://cdn.akamai.steamstatic.com/steam/apps/1108770/capsule_616x353.jpg',
  }

  for (const [slug, url] of Object.entries(IMAGES)) {
    const result = await db.update(games).set({ backgroundImage: url }).where(eq(games.slug, slug))
    console.log(`✓ ${slug} — updated`)
  }

  // Also show current state after update
  const after = await db
    .select({ slug: games.slug, title: games.title, backgroundImage: games.backgroundImage })
    .from(games)
    .where(or(like(games.slug, '%solitaire%'), like(games.slug, '%minesweeper%')))
  console.log('\nAfter update:', JSON.stringify(after, null, 2))

  console.log('\nDone.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
