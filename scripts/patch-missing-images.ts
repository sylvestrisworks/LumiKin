/**
 * Fetch background images from RAWG for games that have none.
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/patch-missing-images.ts
 */

import { isNull, eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { rawgGetDetail, rawgSearch } from '../src/lib/rawg/client'

async function main() {
  const missing = await db
    .select({ id: games.id, slug: games.slug, title: games.title, rawgId: games.rawgId })
    .from(games)
    .where(isNull(games.backgroundImage))

  console.log(`Found ${missing.length} games without images\n`)

  let updated = 0
  for (const game of missing) {
    try {
      // Try rawgId first, then slug, then search
      let detail
      if (game.rawgId) {
        detail = await rawgGetDetail(game.rawgId)
      } else {
        try {
          detail = await rawgGetDetail(game.slug)
        } catch {
          const results = await rawgSearch(game.title, 1, 1)
          if (results.results.length === 0) throw new Error('not found on RAWG')
          detail = await rawgGetDetail(results.results[0].id)
        }
      }

      if (!detail.background_image) {
        console.log(`  [no image on RAWG] ${game.title}`)
        continue
      }

      const rawUrl = detail.background_image
      await db.update(games)
        .set({ backgroundImage: rawUrl })
        .where(eq(games.id, game.id))

      console.log(`  ✓ ${game.title}`)
      updated++

      // Be nice to RAWG rate limits
      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.log(`  ✗ ${game.title}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nDone. Updated ${updated}/${missing.length} images.`)
}

main().catch(e => { console.error(e); process.exit(1) })
