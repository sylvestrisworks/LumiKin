/**
 * Recomputes BDS, curascore, and time recommendation for all experience_scores rows
 * using the current formula in experience-risk.ts (no AI call needed).
 *
 * Use this after any change to the scoring formula to immediately update existing scores.
 * Separately, run rescore-fortnite-experiences.ts to queue AI re-evaluation when Gemini
 * is back online (this updates the 0–3 dimensional inputs; this script only updates the
 * derived composites from already-stored inputs).
 *
 * Run with:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/recompute-experience-formulas.ts
 */

import { db } from '@/lib/db'
import { experienceScores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { calculateExperienceRisk, calculateExperienceBenefits } from '@/lib/scoring/experience-risk'
import { deriveTimeRecommendation } from '@/lib/scoring/time'
import { CURRENT_METHODOLOGY_VERSION } from '@/lib/methodology'

async function main() {
  const all = await db.select().from(experienceScores)
  console.log(`Recomputing ${all.length} experience_scores rows...`)

  let updated = 0
  for (const row of all) {
    const risk = calculateExperienceRisk({
      dopamineTrapScore: row.dopamineTrapScore ?? 0,
      toxicityScore:     row.toxicityScore     ?? 0,
      ugcContentRisk:    row.ugcContentRisk     ?? 0,
      strangerRisk:      row.strangerRisk       ?? 0,
      monetizationScore: row.monetizationScore  ?? 0,
      privacyRisk:       row.privacyRisk        ?? 0,
    })
    const benefit = calculateExperienceBenefits(
      row.creativityScore ?? 0,
      row.socialScore     ?? 0,
      row.learningScore   ?? 0,
    )
    const timeRec   = deriveTimeRecommendation(risk.ris, benefit.bds, risk.contentRisk, null)
    const safety    = 1 - risk.ris
    const denom     = benefit.bds + safety
    const curascore = denom > 0 ? Math.round((2 * benefit.bds * safety) / denom * 100) : 0

    const oldCurascore = row.curascore ?? 0
    const delta = curascore - oldCurascore

    await db.update(experienceScores).set({
      dopamineRisk:               risk.dopamine,
      monetizationRisk:           risk.monetization,
      socialRisk:                 risk.social,
      contentRisk:                risk.contentRisk,
      riskScore:                  risk.ris,
      benefitScore:               benefit.bds,
      curascore,
      timeRecommendationMinutes:  timeRec.minutes,
      timeRecommendationLabel:    timeRec.label,
      timeRecommendationColor:    timeRec.color,
      timeRecommendationReasoning: timeRec.reasoning,
      methodologyVersion:         CURRENT_METHODOLOGY_VERSION,
      updatedAt:                  new Date(),
    }).where(eq(experienceScores.id, row.id))

    const sign = delta > 0 ? '+' : ''
    console.log(`  ${row.id} → curascore ${oldCurascore} → ${curascore} (${sign}${delta})`)
    updated++
  }

  console.log(`\nDone — updated ${updated} rows.`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
