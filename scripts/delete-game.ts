import { db } from '../src/lib/db'
import { games, gameScores, reviews, darkPatterns, complianceStatus, userGames } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'

const slug = process.argv[process.argv.indexOf('--slug') + 1]
if (!slug) { console.error('Usage: --slug <slug>'); process.exit(1) }

async function main() {
  const [game] = await db.select().from(games).where(eq(games.slug, slug)).limit(1)
  if (!game) { console.error('Game not found:', slug); process.exit(1) }

  console.log(`Found: [${game.id}] ${game.title} (${game.slug})`)

  // Show scores if any
  const [score] = await db.select({ curascore: gameScores.curascore })
    .from(gameScores).where(eq(gameScores.gameId, game.id)).limit(1)
  if (score) console.log(`  Curascore: ${score.curascore}`)

  if (!process.argv.includes('--confirm')) {
    console.log('\nDry run. Add --confirm to delete.')
    process.exit(0)
  }

  // Delete all references before the game row
  const reviewRows = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.gameId, game.id))
  for (const r of reviewRows) {
    await db.delete(darkPatterns).where(eq(darkPatterns.reviewId, r.id))
  }
  await db.delete(complianceStatus).where(eq(complianceStatus.gameId, game.id))
  await db.delete(userGames).where(eq(userGames.gameId, game.id))
  await db.delete(gameScores).where(eq(gameScores.gameId, game.id))
  await db.delete(reviews).where(eq(reviews.gameId, game.id))
  await db.delete(games).where(eq(games.id, game.id))
  console.log('Deleted.')
  process.exit(0)
}
main()
