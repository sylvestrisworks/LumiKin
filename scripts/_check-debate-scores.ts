import { db } from '../src/lib/db'
import { games, gameScores } from '../src/lib/db/schema'
import { eq, isNotNull, desc } from 'drizzle-orm'

async function main() {
  // Show all debate-reviewed games
  const rows = await db
    .select({ title: games.title, slug: games.slug, curascore: gameScores.curascore, debateRounds: gameScores.debateRounds })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNotNull(gameScores.debateRounds))
    .orderBy(desc(gameScores.curascore))

  console.log('Debate-reviewed games:')
  rows.forEach(r => console.log(`  ${r.title.padEnd(40)} curascore=${r.curascore}  rounds=${r.debateRounds}`))
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
