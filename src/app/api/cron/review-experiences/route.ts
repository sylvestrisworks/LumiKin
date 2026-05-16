/**
 * GET /api/cron/review-experiences
 *
 * AI evaluation pipeline for UGC platform experiences (Roblox + Fortnite Creative).
 *   - Finds platform_experiences with no experience_scores entry, OR rows
 *     marked needs_rescore = true (e.g. after a structured-field rescrape).
 *   - Calls Gemini via Vertex AI with a platform-specific scoring rubric.
 *   - Saves scores to experience_scores table; also rescores old-formula rows.
 *
 * The actual prompt + evaluator + persistence live in
 * src/lib/scoring/experience-evaluator.ts so one-shot scripts can reuse them.
 *
 * Run via Vercel cron. Protection: Authorization: Bearer <CRON_SECRET>.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games } from '@/lib/db/schema'
import { eq, isNull, or } from 'drizzle-orm'
import { CURRENT_METHODOLOGY_VERSION } from '@/lib/methodology'
import { calculateExperienceRisk, calculateExperienceBenefits, applyScoreFloors } from '@/lib/scoring/experience-risk'
import { deriveTimeRecommendation } from '@/lib/scoring/time'
import { logCronRun } from '@/lib/cron-logger'
import { buildPrompt, callGemini, saveScore, type ExperienceRow } from '@/lib/scoring/experience-evaluator'

export const maxDuration = 300

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_PER_RUN = 40
const CONCURRENCY = 4
const BUDGET_MS   = 240_000

// ─── Rescore existing entries under new formula ───────────────────────────────
//
// Picks up experience_scores rows where dopamine_risk IS NULL — these were
// written under the old equal-weight formula before Fix 3. Recomputes all
// derived values from the already-stored 0–3 dimensional scores; no AI call.

const RESCORE_BATCH = 50

async function rescoreExisting(): Promise<number> {
  const stale = await db
    .select({
      score:        experienceScores,
      title:        platformExperiences.title,
      description:  platformExperiences.description,
      genre:        platformExperiences.genre,
      platformSlug: games.slug,
    })
    .from(experienceScores)
    .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
    .innerJoin(games, eq(games.id, platformExperiences.platformId))
    .where(isNull(experienceScores.dopamineRisk))
    .limit(RESCORE_BATCH)

  let count = 0
  for (const { score: row, title, description, genre, platformSlug } of stale) {
    const floored = applyScoreFloors(
      {
        dopamineTrapScore: row.dopamineTrapScore ?? 0,
        toxicityScore:     row.toxicityScore     ?? 0,
        ugcContentRisk:    row.ugcContentRisk    ?? 0,
        strangerRisk:      row.strangerRisk      ?? 0,
        monetizationScore: row.monetizationScore ?? 0,
        privacyRisk:       row.privacyRisk       ?? 0,
        creativityScore:   row.creativityScore   ?? 0,
        socialScore:       row.socialScore       ?? 0,
        learningScore:     row.learningScore     ?? 0,
      },
      { title, description, genre, platformSlug },
    )
    const s = floored.scores

    const risk    = calculateExperienceRisk(s)
    const benefit = calculateExperienceBenefits(s.creativityScore, s.socialScore, s.learningScore)
    const timeRec   = deriveTimeRecommendation(risk.ris, benefit.bds, risk.contentRisk, null)
    const safety    = 1 - risk.ris
    const denom     = benefit.bds + safety
    const curascore = denom > 0 ? Math.round((2 * benefit.bds * safety) / denom * 100) : 0

    await db.update(experienceScores).set({
      dopamineTrapScore:          s.dopamineTrapScore,
      toxicityScore:              s.toxicityScore,
      ugcContentRisk:             s.ugcContentRisk,
      strangerRisk:               s.strangerRisk,
      monetizationScore:          s.monetizationScore,
      privacyRisk:                s.privacyRisk,
      creativityScore:            s.creativityScore,
      socialScore:                s.socialScore,
      learningScore:              s.learningScore,
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
      scoringMethod:              'ugc_adapted' as const,
      updatedAt:                  new Date(),
    }).where(eq(experienceScores.id, row.id))

    count++
  }

  if (count > 0) {
    console.log(`[review-experiences] Rescored ${count} existing entries under Fix-3 formula`)
  }
  return count
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runStartedAt = new Date()

  try {
    // Phase 1: rescore old-formula rows (no AI, runs every time)
    const rescored = await rescoreExisting()

    if (!process.env.GOOGLE_CREDENTIALS_JSON) {
      return NextResponse.json({ rescored, message: 'GOOGLE_CREDENTIALS_JSON not set — skipping new evaluations' })
    }

    const pending = await db
      .select({ exp: platformExperiences, platformSlug: games.slug })
      .from(platformExperiences)
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
      .where(or(isNull(experienceScores.id), eq(platformExperiences.needsRescore, true)))
      .limit(MAX_PER_RUN)

    if (pending.length === 0) {
      await logCronRun('review-experiences', runStartedAt, { itemsProcessed: rescored, errors: 0, meta: { rescored } })
      return NextResponse.json({ rescored, message: 'No unscored experiences', evaluated: 0 })
    }

    console.log(`[review-experiences] Found ${pending.length} unscored experiences`)

    const evaluated: string[] = []
    const errors:    string[] = []
    const startedAt = Date.now()

    const evaluateOne = async (exp: ExperienceRow, platformSlug: string): Promise<string> => {
      console.log(`[review-experiences] Evaluating: ${exp.title} [${platformSlug}]`)
      const result = await callGemini(buildPrompt(exp, platformSlug))
      const saved  = await saveScore(exp, result, platformSlug)
      for (const f of saved.appliedFloors) {
        console.log(`[review-experiences] ${exp.slug} floor: ${f.dimension} ${f.from}→${f.to} (${f.reason})`)
      }
      if (exp.needsRescore) {
        await db.update(platformExperiences).set({ needsRescore: false }).where(eq(platformExperiences.id, exp.id))
      }
      console.log(`[review-experiences] ${exp.title} → curascore ${saved.curascore}${exp.needsRescore ? ' (rescore)' : ''}`)
      return exp.slug
    }

    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      if (Date.now() - startedAt > BUDGET_MS) {
        console.log('[review-experiences] Budget reached — stopping early')
        break
      }
      const chunk = pending.slice(i, i + CONCURRENCY)
      const results = await Promise.allSettled(chunk.map(({ exp, platformSlug }) => evaluateOne(exp, platformSlug)))
      results.forEach((r, j) => {
        const slug = chunk[j].exp.slug
        if (r.status === 'fulfilled') {
          evaluated.push(r.value)
        } else {
          console.error(`[review-experiences] Failed ${slug}:`, r.reason)
          errors.push(slug)
        }
      })
    }

    await logCronRun('review-experiences', runStartedAt, {
      itemsProcessed: evaluated.length + rescored,
      errors:         errors.length,
      meta:           { evaluated: evaluated.length, rescored, failed: errors },
    })
    return NextResponse.json({ rescored, evaluated: evaluated.length, errors: errors.length, slugs: evaluated })

  } catch (err) {
    console.error('[review-experiences] Fatal:', err)
    await logCronRun('review-experiences', runStartedAt, { itemsProcessed: 0, errors: 1, meta: { error: String(err) } })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
