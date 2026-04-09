import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { isNull, eq } from 'drizzle-orm'
import { rawgGetDetail } from '../src/lib/rawg/client'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const missing = await db
    .select({ id: games.id, slug: games.slug, title: games.title })
    .from(games)
    .where(isNull(games.backgroundImage))

  console.log(`Fixing ${missing.length} games with no image…\n`)

  let fixed = 0
  let failed = 0

  for (const game of missing) {
    process.stdout.write(`  ${game.title} (${game.slug})… `)
    try {
      const detail = await rawgGetDetail(game.slug)
      const img = detail.background_image ?? null
      if (img) {
        await db.update(games).set({ backgroundImage: img }).where(eq(games.id, game.id))
        console.log('✓')
        fixed++
      } else {
        console.log('no image on RAWG')
        failed++
      }
      await sleep(300)
    } catch (err) {
      // Slug might differ — try by ID via search
      try {
        const { rawgSearch } = await import('../src/lib/rawg/client')
        const results = await rawgSearch(game.title, 1, 1)
        await sleep(300)
        if (results.results[0]?.background_image) {
          await db.update(games)
            .set({ backgroundImage: results.results[0].background_image })
            .where(eq(games.id, game.id))
          console.log('✓ (via search)')
          fixed++
        } else {
          console.log('not found')
          failed++
        }
      } catch {
        console.log(`error: ${err instanceof Error ? err.message : String(err)}`)
        failed++
      }
    }
  }

  console.log(`\nFixed: ${fixed}  |  Failed: ${failed}`)
}

main().catch(console.error)
