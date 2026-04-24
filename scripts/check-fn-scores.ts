import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games } from '@/lib/db/schema'
import { eq, isNotNull, isNull } from 'drizzle-orm'

async function main() {
  const [fn] = await db.select({ id: games.id }).from(games).where(eq(games.slug, 'fortnite-creative')).limit(1)

  const rows = await db
    .select({ exp: platformExperiences, score: experienceScores })
    .from(platformExperiences)
    .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .where(eq(platformExperiences.platformId, fn.id))

  const scored   = rows.filter(r => r.score?.curascore != null)
  const unscored = rows.filter(r => r.score?.curascore == null)

  console.log(`Fortnite Creative: ${rows.length} total`)
  console.log(`  Scored:   ${scored.length}`)
  console.log(`  Unscored: ${unscored.length}`)

  if (unscored.length > 0) {
    console.log('\nUnscored maps:')
    for (const { exp } of unscored) {
      console.log(`  - ${exp.title} (thumbnail: ${exp.thumbnailUrl ? '✓' : '✗'})`)
    }
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
