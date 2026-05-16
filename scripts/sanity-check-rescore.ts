/**
 * Picks N representative alive Fortnite-Creative rows, re-runs the AI scoring
 * pipeline against them with the new structured-field prompt, and prints
 * old-vs-new scores side-by-side so we can sanity-check before flushing the
 * full needs_rescore queue.
 *
 * No special filter on tag mix — just sample across an ID range to get a
 * cross-section of map types.
 *
 *   node node_modules/tsx/dist/cli.cjs scripts/sanity-check-rescore.ts          # 10 rows
 *   node node_modules/tsx/dist/cli.cjs scripts/sanity-check-rescore.ts --n 20
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games } from '@/lib/db/schema'
import { and, eq, sql, isNotNull } from 'drizzle-orm'
import { buildPrompt, callGemini, saveScore } from '@/lib/scoring/experience-evaluator'

async function main() {
  const nIdx = process.argv.indexOf('--n')
  const n = nIdx >= 0 ? parseInt(process.argv[nIdx + 1] ?? '10', 10) : 10

  const rows = await db
    .select({
      exp:           platformExperiences,
      oldCurascore:  experienceScores.curascore,
      oldRis:        experienceScores.riskScore,
      oldBds:        experienceScores.benefitScore,
      platformSlug:  games.slug,
    })
    .from(platformExperiences)
    .innerJoin(games, eq(games.id, platformExperiences.platformId))
    .innerJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .where(and(
      eq(games.slug, 'fortnite-creative'),
      eq(platformExperiences.isPublic, true),
      eq(platformExperiences.needsRescore, true),
      isNotNull(platformExperiences.tagline),
    ))
    .orderBy(sql`RANDOM()`)
    .limit(n)

  console.log(`Sanity-check rescore on ${rows.length} alive Fortnite rows\n`)

  for (const { exp, oldCurascore, oldRis, oldBds, platformSlug } of rows) {
    console.log(`──────────────────────────────────────────────────────────────`)
    console.log(`${exp.title}  [${exp.placeId}]  by ${exp.creatorName ?? '—'}`)
    console.log(`tags=${JSON.stringify(exp.tags ?? [])}`)
    console.log(`descr=${JSON.stringify(exp.contentDescriptors ?? [])}  age=${exp.ageRating ?? '—'}  active=${exp.activePlayers ?? '—'}`)
    console.log(`tagline (${(exp.tagline ?? '').length}c): ${(exp.tagline ?? '').slice(0, 200).replace(/\n/g, ' / ')}`)
    console.log(`old: curascore=${oldCurascore}  ris=${oldRis?.toFixed(3)}  bds=${oldBds?.toFixed(3)}`)

    try {
      const result = await callGemini(buildPrompt(exp, platformSlug))
      const saved  = await saveScore(exp, result, platformSlug)
      console.log(`new: curascore=${saved.curascore}  ris=${saved.riskScore.toFixed(3)}  bds=${saved.benefitScore.toFixed(3)}  conf=${saved.inputConfidence}`)
      if (saved.appliedFloors.length > 0) {
        console.log(`floors: ${saved.appliedFloors.map(f => `${f.dimension} ${f.from}→${f.to}`).join(', ')}`)
      }
      console.log(`Δ curascore: ${(saved.curascore - (oldCurascore ?? 0)) > 0 ? '+' : ''}${saved.curascore - (oldCurascore ?? 0)}`)
      console.log(`summary: ${result.narratives.summary}`)
      console.log(`benefits: ${result.narratives.benefitsNarrative}`)
      console.log(`risks:    ${result.narratives.risksNarrative}`)
      console.log(`age min:  ${result.recommendation.recommendedMinAge}`)

      // Clear needs_rescore so the cron doesn't re-pick the same rows
      await db.update(platformExperiences).set({ needsRescore: false }).where(eq(platformExperiences.id, exp.id))
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`)
    }
  }

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
