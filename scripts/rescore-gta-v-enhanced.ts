/**
 * Re-score "Grand Theft Auto V Enhanced" as base-game-only, consistent with the
 * canonical "Grand Theft Auto V" record.
 *
 * Why: GTA V Enhanced was ingested as a fresh game row (2026-05-24) AFTER the
 * rescore-base-game.ts pass, with bundledOnlineNote=NULL, so the standard
 * auto-review pipeline folded GTA Online (Shark Cards, stranger chat, lobby
 * toxicity) into its score — directly contradicting our published "we rate the
 * base game, online is a separate warning" policy.
 *
 * The Enhanced edition is the same single-player campaign as the base game, just
 * a current-gen port. Rather than spend a fresh AI review, we clone the canonical
 * base-game review (grand-theft-auto-v) and recompute. This guarantees the two
 * pages tell the same story.
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/rescore-gta-v-enhanced.ts
 */
import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env') })

import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, gameScores, reviews, gameTranslations } from '../src/lib/db/schema'
import { calculateGameScores } from '../src/lib/scoring/engine'
import { CURRENT_METHODOLOGY_VERSION } from '../src/lib/methodology'

const SOURCE_SLUG = 'grand-theft-auto-v'
const TARGET_SLUG = 'grand-theft-auto-v-enhanced'

async function main() {
  const [source] = await db.select().from(games).where(eq(games.slug, SOURCE_SLUG))
  const [target] = await db.select().from(games).where(eq(games.slug, TARGET_SLUG))
  if (!source || !target) throw new Error('source or target game not found')

  const [srcReview] = await db.select().from(reviews).where(eq(reviews.gameId, source.id)).limit(1)
  if (!srcReview) throw new Error('source review not found')

  // Clone the canonical review's scoring + narrative fields onto the target.
  // Strip identity/timestamp columns so we don't clobber the target's own row identity.
  const { id: _id, gameId: _g, createdAt: _c, updatedAt: _u, approvedAt: _a, reviewedAt: _r, ...cloned } = srcReview

  const reviewData = {
    ...cloned,
    gameId: target.id,
    reviewTier: 'automated' as const,
    status: 'approved' as const,
    approvedAt: new Date(),
    reviewedAt: new Date(),
    aiModel: 'cloned:grand-theft-auto-v',
    updatedAt: new Date(),
  }

  // A review row is a superset of ReviewInput — pass directly to the engine.
  const computed = calculateGameScores({ ...reviewData, esrbRating: target.esrbRating })

  const [existingReview] = await db.select({ id: reviews.id })
    .from(reviews).where(eq(reviews.gameId, target.id)).limit(1)
  let reviewId: number
  if (existingReview) {
    await db.update(reviews).set(reviewData).where(eq(reviews.id, existingReview.id))
    reviewId = existingReview.id
  } else {
    const [ins] = await db.insert(reviews).values(reviewData).returning({ id: reviews.id })
    reviewId = ins.id
  }

  const scoreData = {
    gameId: target.id, reviewId,
    cognitiveScore:              computed.cognitiveScore,
    socialEmotionalScore:        computed.socialEmotionalScore,
    motorScore:                  computed.motorScore,
    bds:                         computed.bds,
    dopamineRisk:                computed.dopamineRisk,
    monetizationRisk:            computed.monetizationRisk,
    socialRisk:                  computed.socialRisk,
    contentRisk:                 computed.contentRisk,
    ris:                         computed.ris,
    curascore:                   computed.curascore,
    timeRecommendationMinutes:   computed.timeRecommendation.minutes,
    timeRecommendationLabel:     computed.timeRecommendation.label,
    timeRecommendationReasoning: computed.timeRecommendation.reasoning,
    timeRecommendationColor:     computed.timeRecommendation.color,
    topBenefits:                 computed.topBenefits,
    representationScore:         ((srcReview.repGenderBalance ?? 0) + (srcReview.repEthnicDiversity ?? 0)) / 6,
    propagandaLevel:             srcReview.propagandaLevel,
    bechdelResult:               srcReview.bechdelResult,
    recommendedMinAge:           computed.recommendedMinAge > 0 ? computed.recommendedMinAge : null,
    ageFloorReason:              computed.recommendedMinAge > 0 ? computed.ageFloorReason : null,
    scoringMethod:               'full_rubric' as const,
    methodologyVersion:          CURRENT_METHODOLOGY_VERSION,
    calculatedAt:                new Date(),
  }

  const [existingScore] = await db.select({ id: gameScores.id })
    .from(gameScores).where(eq(gameScores.gameId, target.id)).limit(1)
  if (existingScore) {
    await db.update(gameScores).set(scoreData).where(eq(gameScores.id, existingScore.id))
  } else {
    await db.insert(gameScores).values(scoreData)
  }

  // Surface GTA Online as the separate warning (the policy), and clear rescore flag.
  await db.update(games)
    .set({ bundledOnlineNote: source.bundledOnlineNote, needsRescore: false, updatedAt: new Date() })
    .where(eq(games.id, target.id))

  // English narratives/time-rec reasoning just changed → localized overlays are now stale.
  await db.update(gameTranslations)
    .set({ needsRetranslate: true })
    .where(eq(gameTranslations.gameId, target.id))

  console.log('GTA V Enhanced rescored (base-game only):')
  console.log(`  curascore ${scoreData.curascore}  time ${scoreData.timeRecommendationMinutes}min  ` +
    `dopa ${computed.dopamineRisk.toFixed(2)} monet ${computed.monetizationRisk.toFixed(2)} social ${computed.socialRisk.toFixed(2)} ris ${computed.ris.toFixed(3)}`)
  console.log(`  recommendedMinAge ${computed.recommendedMinAge}  bundledOnlineNote set  translations flagged for retranslate`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
