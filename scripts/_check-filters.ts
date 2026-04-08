import { sql, eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, gameScores } from '../src/lib/db/schema'

async function main() {
  // Show raw genres/platforms for a few scored games
  const rows = await db
    .select({ slug: games.slug, title: games.title, genres: games.genres, platforms: games.platforms, esrb: games.esrbRating })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .limit(5)

  console.log('=== Sample scored games ===')
  rows.forEach(r => {
    console.log(`\n  ${r.title} (${r.slug})`)
    console.log(`  ESRB: ${r.esrb}`)
    console.log(`  genres: ${JSON.stringify(r.genres)}`)
    console.log(`  platforms: ${JSON.stringify(r.platforms)}`)
  })
}

main().catch((err) => { console.error(err); process.exit(1) })
