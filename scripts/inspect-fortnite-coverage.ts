import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games } from '@/lib/db/schema'
import { and, eq, isNotNull, sql } from 'drizzle-orm'

async function main() {
  const [p] = await db.select({ id: games.id }).from(games).where(eq(games.slug, 'fortnite-creative')).limit(1)
  if (!p) process.exit(1)

  const totals = await db
    .select({
      total:        sql<number>`count(*)::int`,
      withDesc:     sql<number>`count(*) filter (where ${platformExperiences.description} is not null and length(${platformExperiences.description}) > 10)::int`,
      withVisits:   sql<number>`count(*) filter (where ${platformExperiences.visitCount} is not null)::int`,
      withGenre:    sql<number>`count(*) filter (where ${platformExperiences.genre} is not null)::int`,
      withCreator:  sql<number>`count(*) filter (where ${platformExperiences.creatorName} is not null)::int`,
    })
    .from(platformExperiences)
    .where(eq(platformExperiences.platformId, p.id))

  console.log('Fortnite Creative metadata coverage:')
  console.log(totals[0])

  const scored = await db
    .select({
      strangerZero: sql<number>`count(*) filter (where ${experienceScores.strangerRisk} = 0)::int`,
      dopamineZero: sql<number>`count(*) filter (where ${experienceScores.dopamineTrapScore} = 0)::int`,
      monetZero:    sql<number>`count(*) filter (where ${experienceScores.monetizationScore} = 0)::int`,
      total:        sql<number>`count(*)::int`,
      avgCura:      sql<number>`avg(${experienceScores.curascore})::int`,
      medianCura:   sql<number>`percentile_cont(0.5) within group (order by ${experienceScores.curascore})::int`,
      over60:       sql<number>`count(*) filter (where ${experienceScores.curascore} >= 60)::int`,
      over70:       sql<number>`count(*) filter (where ${experienceScores.curascore} >= 70)::int`,
    })
    .from(experienceScores)
    .innerJoin(platformExperiences, eq(experienceScores.experienceId, platformExperiences.id))
    .where(and(eq(platformExperiences.platformId, p.id), isNotNull(experienceScores.curascore)))

  console.log('\nFortnite Creative score distribution:')
  console.log(scored[0])
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
