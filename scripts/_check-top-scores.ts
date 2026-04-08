import { db } from '../src/lib/db'
import { games, gameScores } from '../src/lib/db/schema'
import { eq, isNotNull, desc, sql } from 'drizzle-orm'

async function main() {
  const rows = await db
    .select({ title: games.title, curascore: gameScores.curascore, bds: gameScores.bds, ris: gameScores.ris, debateRounds: gameScores.debateRounds })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNotNull(gameScores.curascore))
    .orderBy(desc(gameScores.curascore))
    .limit(30)

  console.log('Top 30 by curascore:')
  rows.forEach((r, i) => {
    const debate = r.debateRounds ? ` [debate]` : ''
    console.log(`  ${String(i+1).padStart(2)}. ${r.title.padEnd(42)} ${String(r.curascore).padStart(3)}  BDS=${r.bds?.toFixed(2)} RIS=${r.ris?.toFixed(2)}${debate}`)
  })
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
