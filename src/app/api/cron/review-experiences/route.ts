/**
 * GET /api/cron/review-experiences
 *
 * AI evaluation pipeline for UGC platform experiences (Roblox + Fortnite Creative).
 *   - Finds platform_experiences with no experience_scores entry
 *   - Calls Claude via Bedrock with a platform-specific scoring rubric
 *   - Saves scores to experience_scores table
 *
 * Run via GitHub Actions on a schedule.
 * Protection: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games } from '@/lib/db/schema'
import { eq, isNull, or } from 'drizzle-orm'
import { CURRENT_METHODOLOGY_VERSION } from '@/lib/methodology'
import { calculateExperienceRisk, calculateExperienceBenefits } from '@/lib/scoring/experience-risk'
import { deriveTimeRecommendation } from '@/lib/scoring/time'
import { callGeminiTool } from '@/lib/vertex-ai'

export const maxDuration = 300

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_PER_RUN = 10
const DELAY_MS    = 200
const BUDGET_MS   = 240_000

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Tool schema ──────────────────────────────────────────────────────────────

const EVAL_TOOL = {
  name: 'submit_experience_evaluation',
  description: 'Submit a LumiKin safety evaluation for a Roblox UGC experience.',
  input_schema: {
    type: 'object',
    required: ['risks', 'benefits', 'recommendation', 'narratives'],
    properties: {
      benefits: {
        type: 'object',
        description: 'Benefit scores, each 0–3 (0=absent, 1=mild, 2=moderate, 3=strong). Score what the experience genuinely offers — do not underrate.',
        required: ['creativityScore','socialScore','learningScore'],
        properties: {
          creativityScore: { type: 'integer', minimum: 0, maximum: 3,
            description: 'Building, designing, scripting, storytelling, or open-ended creative expression. A full sandbox builder = 3; a linear obstacle course = 0.' },
          socialScore:     { type: 'integer', minimum: 0, maximum: 3,
            description: 'Genuine cooperative play, communication, friendship, or positive community. Requires actual collaboration, not just proximity.' },
          learningScore:   { type: 'integer', minimum: 0, maximum: 3,
            description: 'Real skill development: problem solving, strategy, spatial reasoning, literacy, numeracy. Score what transfers outside the game.' },
        },
      },
      risks: {
        type: 'object',
        description: 'Risk scores, each 0–3 (0=not present, 1=mild/optional, 2=significant, 3=core mechanic). Score what the designers built — not incidental community behaviour.',
        required: ['dopamineTrapScore','toxicityScore','ugcContentRisk','strangerRisk','monetizationScore','privacyRisk'],
        properties: {
          dopamineTrapScore:  { type: 'integer', minimum: 0, maximum: 3,
            description: 'Variable reward loops, loot, streaks with penalties, near-miss feedback, infinite-play design with no natural stopping points.' },
          toxicityScore:      { type: 'integer', minimum: 0, maximum: 3,
            description: 'Design that incentivises bullying, rank-shaming, or competitive toxicity. General chat rudeness alone is not a 3.' },
          ugcContentRisk:     { type: 'integer', minimum: 0, maximum: 3,
            description: 'Structural risk of inappropriate UGC appearing in-experience (custom builds, avatar items, images). Platform-wide moderation is already assumed.' },
          strangerRisk:       { type: 'integer', minimum: 0, maximum: 3,
            description: 'How much the experience design exposes children to unknown adults: open voice/text chat, DMs, friend-request prompts from strangers.' },
          monetizationScore:  { type: 'integer', minimum: 0, maximum: 3,
            description: 'Robux pressure inside the experience: pay-to-win mechanics, exclusive items gated behind purchases, social spending comparison.' },
          privacyRisk:        { type: 'integer', minimum: 0, maximum: 3,
            description: 'Experience actively encourages sharing real name, age, location, or links to external platforms.' },
        },
      },
      recommendation: {
        type: 'object',
        required: ['recommendedMinAge'],
        properties: {
          recommendedMinAge: { type: 'integer', minimum: 3, maximum: 18,
            description: 'Minimum age you recommend for this experience.' },
        },
      },
      narratives: {
        type: 'object',
        required: ['summary','benefitsNarrative','risksNarrative','parentTip'],
        properties: {
          summary:           { type: 'string', description: 'One sentence for a parent who has never heard of this game. Neutral, factual.' },
          benefitsNarrative: { type: 'string', description: 'What your child develops or enjoys. Lead with the good. 2–3 sentences, gaming-positive tone — this is LumiKin, not a warning label.' },
          risksNarrative:    { type: 'string', description: 'What to watch out for. Factual and specific, not fear-based. 2–3 sentences.' },
          parentTip:         { type: 'string', description: 'One concrete, empowering action a parent can take. Frame as a positive action, not a restriction.' },
        },
      },
    },
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

type EvalInput = {
  risks: {
    dopamineTrapScore: number; toxicityScore: number; ugcContentRisk: number
    strangerRisk: number; monetizationScore: number; privacyRisk: number
  }
  benefits: { creativityScore: number; socialScore: number; learningScore: number }
  recommendation: { recommendedMinAge: number }
  narratives: { summary: string; benefitsNarrative: string; risksNarrative: string; parentTip: string }
}

type ExperienceRow = typeof platformExperiences.$inferSelect

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildRobloxPrompt(e: ExperienceRow): string {
  const visits = e.visitCount ? e.visitCount.toLocaleString() : 'unknown'
  const active = e.activePlayers ? e.activePlayers.toLocaleString() : 'unknown'

  return `You are a child development researcher evaluating a Roblox experience for LumiKin — a game rating service for parents that is pro-informed-gaming, not anti-gaming.

## RATING PHILOSOPHY
Every experience gets two independent profiles: a Benefits Profile (what the child develops) and a Risk Profile (what to watch out for). These do not cancel each other out — an experience can score high on both. Lead with the good.

The time recommendation is derived from risk intensity, then modulated upward by genuine developmental value. Your job is to rate what the designers built, not to assume the worst.

## SCORING DIMENSIONS

### Benefits (0–3 each)
- **creativityScore**: Open-ended building, designing, scripting, storytelling. 3 = core mechanic (full sandbox). 0 = none.
- **socialScore**: Genuine cooperative play, communication, positive community design. 3 = cooperation required. 0 = no real social dimension.
- **learningScore**: Transferable skills — problem solving, strategy, spatial reasoning, numeracy. 3 = strong. 0 = none.

### Risks (0–3 each — score what designers built, not incidental community behaviour)
- **dopamineTrapScore**: Variable reward loops, streaks with penalties, near-miss feedback, no natural stopping points.
- **toxicityScore**: Design that incentivises rank-shaming or bullying. General chat rudeness alone is not a 3.
- **ugcContentRisk**: Structural exposure to inappropriate user-generated content (builds, avatars, images) — platform-level moderation is baseline.
- **strangerRisk**: How much the experience design opens children to unknown adults: voice/text chat, DMs, unsolicited friend requests.
- **monetizationScore**: Robux pressure built into the experience: pay-to-win, exclusive gated items, social spending comparison.
- **privacyRisk**: Experience actively prompts children to share real name, age, location, or external links.

**Do not output a time recommendation or curascore — the engine derives both from your dimensional scores.**

## CALIBRATION EXAMPLES
| Experience | What it is | Key scores | Curascore |
|---|---|---|---|
| Tower of Hell | Pure skill obstacle course, no chat, no monetization | creativity 0, social 1, learning 1 / dopamine 1, stranger 0, monetization 0 | ~72 |
| Adopt Me | Pet simulator, trading, large open world | creativity 1, social 2, learning 0 / dopamine 2, stranger 2, monetization 2 | ~42 |
| Natural Disaster Survival | Survival mini-game, skill-based, minimal monetization | creativity 0, social 2, learning 1 / dopamine 1, stranger 1, monetization 0 | ~65 |
| Brookhaven RP | Social roleplay, open chat, avatar dress-up | creativity 2, social 2, learning 0 / dopamine 1, stranger 3, ugcContentRisk 2 | ~38 |
| Blox Fruits | Grinding RPG, heavy pay-to-win, streak mechanics | creativity 0, social 1, learning 1 / dopamine 3, stranger 1, monetization 3 | ~28 |

## EXPERIENCE TO EVALUATE
Title: ${e.title}
Creator: ${e.creatorName ?? 'Unknown'}
Description: ${e.description ?? 'No description provided'}
Genre: ${e.genre ?? 'Unknown'}
Total visits: ${visits}
Active players now: ${active}
Max players per server: ${e.maxPlayers ?? 'Unknown'}

Score accurately. If the description suggests a creative builder or skill-based experience, reflect that in the benefits. Do not default to worst-case assumptions. Call submit_experience_evaluation with your scores.`
}

function buildFortnitePrompt(e: ExperienceRow): string {
  return `You are a child development researcher evaluating a Fortnite Creative map for LumiKin — a game rating service for parents that is pro-informed-gaming, not anti-gaming.

## CONTEXT
Fortnite Creative is Epic Games' user-generated map platform. Players select a map by its island code. Maps range from competitive box fights and zone wars to puzzle maps, deathrun obstacle courses, and open sandboxes.

## RATING PHILOSOPHY
Every map gets two independent profiles: a Benefits Profile (what the child develops) and a Risk Profile (what to watch out for). These do not cancel each other out. Lead with the good.

## SCORING DIMENSIONS

### Benefits (0–3 each)
- **creativityScore**: Open-ended building, designing, puzzles, or self-expression. 3 = core sandbox builder. 0 = pure combat with no creative element.
- **socialScore**: Genuine cooperative play, team communication, or positive community design. 3 = requires real teamwork. 0 = solo or adversarial only.
- **learningScore**: Transferable skills — spatial reasoning, strategy, hand-eye coordination, problem-solving. 3 = strong skill development. 0 = repetitive clicking only.

### Risks (0–3 each — score what the map designers built)
- **dopamineTrapScore**: Infinite play loops, no natural stopping points, score-chasing without progression, near-miss mechanics.
- **toxicityScore**: Rank systems that shame low-skill players, designs that reward griefing, or elimination mechanics that humiliate.
- **ugcContentRisk**: Exposure to inappropriate player-built structures, textures, or custom images within the map experience.
- **strangerRisk** calibration:
  - 0: Solo-instance maps where no other live players are possible (single-player deathrun, aim trainer with no lobby, solo parkour)
  - 1: Multiplayer-lobby maps with proximity voice but no chat focus (zone wars, box fights — voice exists but gameplay is fast/ambient)
  - 2: Multiplayer maps with social/hangout structure (hub maps, roleplay maps, lobby-heavy experiences)
  - 3: Maps designed around stranger interaction (open chat, friend-add prompts, "make new friends" framing)
- **monetizationScore**: V-Buck pressure built into the map — cosmetic requirements, pay-to-win map items, social comparison of skins.
- **privacyRisk**: Map prompts players to share real info or join external Discord/social accounts.

**Do not output a time recommendation or curascore — the engine derives both from your dimensional scores.**

## CALIBRATION EXAMPLES
Reference: Fortnite Battle Royale itself scores 42 on LumiKin. Most Creative maps should sit in the 35–60 range. Only exceptional experiences with strong creative, cooperative, AND learning dimensions should approach 70+.

| Map type | What it is | Key scores | Curascore |
|---|---|---|---|
| Zone Wars | Rotating storm, skill practice, competitive | creativity 0, social 1, learning 2 / dopamine 2, stranger 1, monetization 0 | ~44 |
| Box Fight / Aim Trainer | Aim trainer, structured duels, no real creativity | creativity 0, social 1, learning 2 / dopamine 1, stranger 1, monetization 0 | ~48 |
| Deathrun | Obstacle course, memorisation, solo | creativity 0, social 0, learning 2 / dopamine 1, stranger 0, monetization 0 | ~52 |
| Puzzle / Escape Room | Spatial reasoning, story, problem-solving | creativity 1, social 1, learning 3 / dopamine 1, stranger 1, monetization 0 | ~58 |
| Creative Sandbox | Open building, world creation tools, full editor | creativity 3, social 2, learning 2 / dopamine 1, stranger 2, monetization 0 | ~68 |
| Prop Hunt | Social hide-and-seek, large lobbies, text chat | creativity 1, social 3, learning 0 / dopamine 1, stranger 2, monetization 0 | ~48 |
| XP Farm | Infinite loop designed purely to grind Battle Pass | creativity 0, social 0, learning 0 / dopamine 3, stranger 0, monetization 2 | ~15 |

IMPORTANT: Aim training courses and combat maps (box fights, zone wars, deathrun) should score 40–55 unless they have a strong cooperative or creative element. Do not inflate learningScore for maps that only develop hand-eye coordination in an aim-trainer context — that is a 1, not a 3.

## MAP TO EVALUATE
Title: ${e.title}
Creator: ${e.creatorName ?? 'Unknown'}
Description: ${e.description ?? 'No description provided'}
Genre / mode: ${e.genre ?? 'Unknown'}
Island code: ${e.placeId}

Score accurately based on what the map title, description, and genre suggest. Do not default to worst-case. Call submit_experience_evaluation with your scores.`
}

function buildPrompt(e: ExperienceRow, platformSlug: string): string {
  if (platformSlug === 'fortnite-creative') return buildFortnitePrompt(e)
  return buildRobloxPrompt(e)
}

// ─── Gemini caller ────────────────────────────────────────────────────────────

function callGemini(prompt: string): Promise<EvalInput> {
  return callGeminiTool<EvalInput>(prompt, EVAL_TOOL)
}

// ─── Save to DB ───────────────────────────────────────────────────────────────

async function saveScore(experience: ExperienceRow, eval_: EvalInput): Promise<number> {
  // Fix 3: rubric-weighted risk and benefit composites
  const risk    = calculateExperienceRisk(eval_.risks)
  const benefit = calculateExperienceBenefits(
    eval_.benefits.creativityScore,
    eval_.benefits.socialScore,
    eval_.benefits.learningScore,
  )

  // Fix 4: engine-derived time recommendation (same function as standalone games)
  const timeRec = deriveTimeRecommendation(risk.ris, benefit.bds, risk.contentRisk, null)

  // Fix 5: formula-derived curascore (harmonic mean of BDS and Safety, identical to engine.ts)
  const safety   = 1 - risk.ris
  const denom    = benefit.bds + safety
  const curascore = denom > 0 ? Math.round((2 * benefit.bds * safety) / denom * 100) : 0

  if (Math.abs(curascore - 50) > 10) {
    // Log divergence between formula and a naive midpoint for monitoring
    console.log(`[review-experiences] ${experience.slug} curascore=${curascore} ris=${risk.ris.toFixed(3)} bds=${benefit.bds.toFixed(3)}`)
  }

  const row = {
    experienceId:              experience.id,
    curascore,
    dopamineTrapScore:         eval_.risks.dopamineTrapScore,
    toxicityScore:             eval_.risks.toxicityScore,
    ugcContentRisk:            eval_.risks.ugcContentRisk,
    strangerRisk:              eval_.risks.strangerRisk,
    monetizationScore:         eval_.risks.monetizationScore,
    privacyRisk:               eval_.risks.privacyRisk,
    creativityScore:           eval_.benefits.creativityScore,
    socialScore:               eval_.benefits.socialScore,
    learningScore:             eval_.benefits.learningScore,
    // Fix 3: rubric-mapped normalized sub-components
    dopamineRisk:              risk.dopamine,
    monetizationRisk:          risk.monetization,
    socialRisk:                risk.social,
    contentRisk:               risk.contentRisk,
    riskScore:                 risk.ris,
    benefitScore:              benefit.bds,
    // Fix 4: engine-derived time recommendation
    timeRecommendationMinutes: timeRec.minutes,
    timeRecommendationLabel:   timeRec.label,
    timeRecommendationReasoning: timeRec.reasoning,
    timeRecommendationColor:   timeRec.color,
    summary:                   eval_.narratives.summary,
    benefitsNarrative:         eval_.narratives.benefitsNarrative,
    risksNarrative:            eval_.narratives.risksNarrative,
    parentTip:                 eval_.narratives.parentTip,
    recommendedMinAge:         eval_.recommendation.recommendedMinAge,
    scoringMethod:             'ugc_adapted' as const,   // Fix 6
    methodologyVersion:        CURRENT_METHODOLOGY_VERSION,
    calculatedAt:              new Date(),
    updatedAt:                 new Date(),
  }

  const [existing] = await db
    .select({ id: experienceScores.id })
    .from(experienceScores)
    .where(eq(experienceScores.experienceId, experience.id))
    .limit(1)

  if (existing) {
    await db.update(experienceScores).set(row).where(eq(experienceScores.id, existing.id))
  } else {
    await db.insert(experienceScores).values(row)
  }

  return row.curascore
}

// ─── Rescore existing entries under new formula ───────────────────────────────
//
// Picks up experience_scores rows where dopamine_risk IS NULL — these were
// written under the old equal-weight formula before Fix 3. Recomputes all
// derived values from the already-stored 0–3 dimensional scores; no AI call.
// 50 rows per cron run; 227 rows clears in ~5 runs at the normal schedule.

const RESCORE_BATCH = 50

async function rescoreExisting(): Promise<number> {
  const stale = await db
    .select()
    .from(experienceScores)
    .where(isNull(experienceScores.dopamineRisk))
    .limit(RESCORE_BATCH)

  let count = 0
  for (const row of stale) {
    const risk = calculateExperienceRisk({
      dopamineTrapScore: row.dopamineTrapScore,
      toxicityScore:     row.toxicityScore,
      ugcContentRisk:    row.ugcContentRisk,
      strangerRisk:      row.strangerRisk,
      monetizationScore: row.monetizationScore,
      privacyRisk:       row.privacyRisk,
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
      return NextResponse.json({ rescored, message: 'No unscored experiences', evaluated: 0 })
    }

    console.log(`[review-experiences] Found ${pending.length} unscored experiences`)

    const evaluated: string[] = []
    const errors:    string[] = []
    const startedAt = Date.now()

    for (const { exp, platformSlug } of pending) {
      if (Date.now() - startedAt > BUDGET_MS) {
        console.log('[review-experiences] Budget reached — stopping early')
        break
      }
      await sleep(DELAY_MS)

      try {
        console.log(`[review-experiences] Evaluating: ${exp.title} [${platformSlug}]`)
        const result    = await callGemini(buildPrompt(exp, platformSlug))
        const curascore = await saveScore(exp, result)

        // Clear rescore flag if it was set
        if (exp.needsRescore) {
          await db.update(platformExperiences).set({ needsRescore: false }).where(eq(platformExperiences.id, exp.id))
        }

        evaluated.push(exp.slug)
        console.log(`[review-experiences] ${exp.title} → curascore ${curascore}${exp.needsRescore ? ' (rescore)' : ''}`)
      } catch (err) {
        console.error(`[review-experiences] Failed ${exp.slug}:`, err)
        errors.push(exp.slug)
      }
    }

    return NextResponse.json({ rescored, evaluated: evaluated.length, errors: errors.length, slugs: evaluated })

  } catch (err) {
    console.error('[review-experiences] Fatal:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
