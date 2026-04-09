import { db } from '../src/lib/db'
import { games, gameScores } from '../src/lib/db/schema'
import { count, sql } from 'drizzle-orm'

async function main() {
  const [total] = await db.select({ n: count() }).from(games)
  const [scored] = await db.select({ n: count() }).from(gameScores)
  const unscored = await db.execute(
    sql`SELECT COUNT(*) FROM games g WHERE NOT EXISTS (SELECT 1 FROM game_scores gs WHERE gs.game_id = g.id)`
  )
  // db.execute returns rows directly in drizzle-orm postgres driver
  const unscoredRows = unscored as unknown as Array<{ count: string }>
  console.log('Total games:  ', total.n)
  console.log('Scored:       ', scored.n)
  console.log('Unscored:     ', unscoredRows[0]?.count)
  console.log('Need to reach 1000:', Math.max(0, 1000 - total.n), 'more games')
}

main().catch(console.error)
