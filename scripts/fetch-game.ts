/**
 * Fetch a single game by name or slug from RAWG and upsert into the DB.
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/fetch-game.ts "Brawl Stars"
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/fetch-game.ts --slug brawl-stars
 */

import { rawgSearch, rawgGetDetail } from '../src/lib/rawg/client'
import { mapDetailToInsert } from '../src/lib/rawg/mapper'
import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'

const args = process.argv.slice(2)
const slugFlagIdx = args.indexOf('--slug')
const useSlug = slugFlagIdx !== -1
const slugOrQuery = useSlug ? args[slugFlagIdx + 1] : args[0]

if (!slugOrQuery) {
  console.error('Usage: fetch-game.ts "<game name>"  OR  fetch-game.ts --slug <rawg-slug>')
  process.exit(1)
}

async function main() {
  let detail

  if (useSlug) {
    console.log(`Fetching by slug: "${slugOrQuery}"…`)
    detail = await rawgGetDetail(slugOrQuery)
  } else {
    console.log(`Searching RAWG for: "${slugOrQuery}"…`)
    const list = await rawgSearch(slugOrQuery, 1, 5)

    if (list.results.length === 0) {
      console.error('No results found.')
      process.exit(1)
    }

    list.results.forEach((r, i) =>
      console.log(`  [${i}] ${r.name} (id:${r.id}, metacritic:${r.metacritic ?? '—'}, esrb:${r.esrb_rating?.name ?? 'unrated'})`)
    )

    const pick = list.results[0]
    console.log(`\nFetching details for: ${pick.name} (id:${pick.id})…`)
    detail = await rawgGetDetail(pick.id)
  }

  const data = mapDetailToInsert(detail)

  console.log(`  slug:      ${data.slug}`)
  console.log(`  title:     ${detail.name}`)
  console.log(`  genres:    ${JSON.stringify(data.genres)}`)
  console.log(`  platforms: ${JSON.stringify(data.platforms)}`)
  console.log(`  esrb:      ${data.esrbRating}`)
  console.log(`  metacritic:${data.metacriticScore}`)

  const [existing] = await db.select({ id: games.id }).from(games).where(eq(games.slug, data.slug!)).limit(1)

  if (existing) {
    await db.update(games).set({ ...data, updatedAt: new Date() }).where(eq(games.id, existing.id))
    console.log(`\nUpdated existing game (id:${existing.id})`)
  } else {
    const [inserted] = await db.insert(games).values(data).returning({ id: games.id })
    console.log(`\nInserted new game (id:${inserted.id})`)
  }

  console.log(`Done. Visit /game/${data.slug}`)
}

main().catch(e => { console.error(e); process.exit(1) })
