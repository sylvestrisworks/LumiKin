/**
 * Marks all scored Fortnite Creative experiences for rescoring.
 * Run this after adjusting the Fortnite calibration in review-experiences/route.ts.
 * The review-experiences cron will pick them up and apply the updated calibration.
 *
 * Run with:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/rescore-fortnite-experiences.ts
 */

import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  const [platform] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, 'fortnite-creative'))
    .limit(1)

  if (!platform) {
    console.error('fortnite-creative platform not found')
    process.exit(1)
  }

  const experiences = await db
    .select({ id: platformExperiences.id, title: platformExperiences.title, scoreId: experienceScores.id })
    .from(platformExperiences)
    .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .where(eq(platformExperiences.platformId, platform.id))

  const scored = experiences.filter(e => e.scoreId != null)
  console.log(`Found ${experiences.length} Fortnite Creative experiences (${scored.length} scored)`)

  let updated = 0
  for (const exp of scored) {
    await db
      .update(platformExperiences)
      .set({ needsRescore: true })
      .where(eq(platformExperiences.id, exp.id))
    console.log(`  ↻  ${exp.title}`)
    updated++
  }

  console.log(`\nDone — ${updated} experiences marked for rescore.`)
  console.log('The review-experiences cron will reprocess them on next run.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
