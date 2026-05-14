/**
 * Applies the UGC score floors and confidence caps (see experience-risk.ts
 * applyScoreFloors) to every already-scored platform_experiences row, then
 * recomputes the derived composites and curascore. No AI calls.
 *
 * Use after changing the floor rules. By default runs on fortnite-creative
 * only; pass --all to include Roblox too. Pass --dry-run to preview without
 * writing.
 *
 * Run:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/refloor-experiences.ts
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/refloor-experiences.ts --all
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/refloor-experiences.ts --dry-run
 */

import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games } from '@/lib/db/schema'
import { eq, and, inArray, isNotNull } from 'drizzle-orm'
import {
  applyScoreFloors,
  calculateExperienceRisk,
  calculateExperienceBenefits,
} from '@/lib/scoring/experience-risk'
import { deriveTimeRecommendation } from '@/lib/scoring/time'
import { CURRENT_METHODOLOGY_VERSION } from '@/lib/methodology'

async function main() {
  const all    = process.argv.includes('--all')
  const dryRun = process.argv.includes('--dry-run')
  const slugs  = all ? ['fortnite-creative', 'roblox'] : ['fortnite-creative']

  const platforms = await db
    .select({ id: games.id, slug: games.slug })
    .from(games)
    .where(inArray(games.slug, slugs))

  if (platforms.length === 0) { console.error('platform(s) not found:', slugs); process.exit(1) }

  const platformIds = platforms.map(p => p.id)
  const slugById = new Map(platforms.map(p => [p.id, p.slug]))

  const rows = await db
    .select({
      scoreId:      experienceScores.id,
      experienceId: platformExperiences.id,
      platformId:   platformExperiences.platformId,
      slug:         platformExperiences.slug,
      title:        platformExperiences.title,
      description:  platformExperiences.description,
      genre:        platformExperiences.genre,
      dopamine:     experienceScores.dopamineTrapScore,
      tox:          experienceScores.toxicityScore,
      ugc:          experienceScores.ugcContentRisk,
      stranger:     experienceScores.strangerRisk,
      monet:        experienceScores.monetizationScore,
      privacy:      experienceScores.privacyRisk,
      creativity:   experienceScores.creativityScore,
      social:       experienceScores.socialScore,
      learning:     experienceScores.learningScore,
      oldCura:      experienceScores.curascore,
    })
    .from(experienceScores)
    .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
    .where(and(inArray(platformExperiences.platformId, platformIds), isNotNull(experienceScores.curascore)))

  console.log(`Found ${rows.length} scored rows across [${slugs.join(', ')}]${dryRun ? ' (DRY RUN)' : ''}`)

  let changed   = 0
  let unchanged = 0
  const diffs: { slug: string; title: string; oldCura: number; newCura: number; floors: string[] }[] = []

  for (const r of rows) {
    const platformSlug = slugById.get(r.platformId) ?? ''
    const floored = applyScoreFloors(
      {
        dopamineTrapScore: r.dopamine    ?? 0,
        toxicityScore:     r.tox         ?? 0,
        ugcContentRisk:    r.ugc         ?? 0,
        strangerRisk:      r.stranger    ?? 0,
        monetizationScore: r.monet       ?? 0,
        privacyRisk:       r.privacy     ?? 0,
        creativityScore:   r.creativity  ?? 0,
        socialScore:       r.social      ?? 0,
        learningScore:     r.learning    ?? 0,
      },
      { title: r.title, description: r.description, genre: r.genre, platformSlug },
    )

    if (floored.applied.length === 0) { unchanged++; continue }

    const s         = floored.scores
    const risk      = calculateExperienceRisk(s)
    const benefit   = calculateExperienceBenefits(s.creativityScore, s.socialScore, s.learningScore)
    const timeRec   = deriveTimeRecommendation(risk.ris, benefit.bds, risk.contentRisk, null)
    const safety    = 1 - risk.ris
    const denom     = benefit.bds + safety
    const curascore = denom > 0 ? Math.round((2 * benefit.bds * safety) / denom * 100) : 0

    diffs.push({
      slug:    r.slug,
      title:   r.title,
      oldCura: r.oldCura ?? 0,
      newCura: curascore,
      floors:  floored.applied.map(f => `${f.dimension} ${f.from}→${f.to}`),
    })

    if (!dryRun) {
      await db.update(experienceScores).set({
        dopamineTrapScore:           s.dopamineTrapScore,
        toxicityScore:               s.toxicityScore,
        ugcContentRisk:              s.ugcContentRisk,
        strangerRisk:                s.strangerRisk,
        monetizationScore:           s.monetizationScore,
        privacyRisk:                 s.privacyRisk,
        creativityScore:             s.creativityScore,
        socialScore:                 s.socialScore,
        learningScore:               s.learningScore,
        dopamineRisk:                risk.dopamine,
        monetizationRisk:            risk.monetization,
        socialRisk:                  risk.social,
        contentRisk:                 risk.contentRisk,
        riskScore:                   risk.ris,
        benefitScore:                benefit.bds,
        curascore,
        timeRecommendationMinutes:   timeRec.minutes,
        timeRecommendationLabel:     timeRec.label,
        timeRecommendationColor:     timeRec.color,
        timeRecommendationReasoning: timeRec.reasoning,
        methodologyVersion:          CURRENT_METHODOLOGY_VERSION,
        updatedAt:                   new Date(),
      }).where(eq(experienceScores.id, r.scoreId))
    }
    changed++
  }

  console.log(`\nChanged: ${changed}  Unchanged: ${unchanged}`)

  diffs.sort((a, b) => (b.oldCura - b.newCura) - (a.oldCura - a.newCura))
  console.log('\nBiggest curascore drops:')
  for (const d of diffs.slice(0, 20)) {
    console.log(`  ${d.oldCura} → ${d.newCura}  ${d.title.slice(0, 60).padEnd(60)} [${d.floors.join(', ')}]`)
  }

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
