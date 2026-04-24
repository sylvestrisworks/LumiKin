import { db } from '@/lib/db'
import { games, gameScores, gameTranslations } from '@/lib/db/schema'
import { eq, isNotNull, sql } from 'drizzle-orm'

async function main() {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNotNull(gameScores.curascore))

  const localeCounts = await db
    .select({ locale: gameTranslations.locale, count: sql<number>`count(*)` })
    .from(gameTranslations)
    .groupBy(gameTranslations.locale)
    .orderBy(gameTranslations.locale)

  console.log(`Total scored games: ${total}`)
  console.log('\nTranslation coverage:')
  for (const { locale, count } of localeCounts) {
    const pct = Math.round((Number(count) / Number(total)) * 100)
    console.log(`  ${locale}: ${count}/${total} (${pct}%)`)
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
