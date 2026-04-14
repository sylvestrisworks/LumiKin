/**
 * GET /api/cron/review-experiences
 *
 * AI evaluation pipeline for Roblox (and future UGC platform) experiences.
 *   - Finds platform_experiences with no experience_scores entry
 *   - Calls Claude via Bedrock with a UGC-specific scoring rubric
 *   - Saves scores to experience_scores table
 *
 * Run via GitHub Actions on a schedule.
 * Protection: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores } from '@/lib/db/schema'
import { eq, isNull } from 'drizzle-orm'

export const maxDuration = 300

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_PER_RUN  = 10
const DELAY_MS     = 200
const BUDGET_MS    = 240_000
const BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
const BEDROCK_URL   = `https://bedrock-runtime.us-east-1.amazonaws.com/model/${BEDROCK_MODEL}/invoke`

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Tool schema ──────────────────────────────────────────────────────────────

const EVAL_TOOL = {
  name: 'submit_experience_evaluation',
  description: 'Submit a PlaySmart safety evaluation for a Roblox UGC experience.',
  input_schema: {
    type: 'object',
    required: ['risks', 'benefits', 'recommendation', 'narratives'],
    properties: {
      risks: {
        type: 'object',
        description: 'UGC-specific risk scores, each 0–3 (0=absent, 1=mild, 2=notable, 3=severe)',
        required: ['dopamineTrapScore','toxicityScore','ugcContentRisk','strangerRisk','monetizationScore','privacyRisk'],
        properties: {
          dopamineTrapScore:  { type: 'integer', minimum: 0, maximum: 3,
            description: 'Variable rewards, loot, streaks, near-miss mechanics, infinite loop design' },
          toxicityScore:      { type: 'integer', minimum: 0, maximum: 3,
            description: 'Chat toxicity, bullying, competitive pressure, hostile community reputation' },
          ugcContentRisk:     { type: 'integer', minimum: 0, maximum: 3,
            description: 'Risk of inappropriate UGC: builds, avatar items, images, or chat bypassing filters' },
          strangerRisk:       { type: 'integer', minimum: 0, maximum: 3,
            description: 'Exposure to unknown adults, DM features, grooming vectors, friend requests from strangers' },
          monetizationScore:  { type: 'integer', minimum: 0, maximum: 3,
            description: 'Robux pressure, pay-to-win, exclusive items, social spending comparison' },
          privacyRisk:        { type: 'integer', minimum: 0, maximum: 3,
            description: 'Encourages sharing real name, age, location, or links to external platforms' },
        },
      },
      benefits: {
        type: 'object',
        description: 'Benefit scores, each 0–3 (0=absent, 1=mild, 2=moderate, 3=strong)',
        required: ['creativityScore','socialScore','learningScore'],
        properties: {
          creativityScore: { type: 'integer', minimum: 0, maximum: 3,
            description: 'Does the experience reward building, designing, scripting, or creative expression?' },
          socialScore:     { type: 'integer', minimum: 0, maximum: 3,
            description: 'Does it foster genuine cooperative play, positive friendships, or community belonging?' },
          learningScore:   { type: 'integer', minimum: 0, maximum: 3,
            description: 'Does it develop real skills: problem solving, strategy, literacy, numeracy?' },
        },
      },
      recommendation: {
        type: 'object',
        required: ['recommendedMinAge','timeRecommendationMinutes','timeRecommendationLabel','timeRecommendationColor','curascore'],
        properties: {
          curascore: { type: 'integer', minimum: 0, maximum: 100,
            description: 'Overall PlaySmart score: 0=avoid, 50=neutral, 100=excellent. Weight risks more heavily than benefits for UGC.' },
          recommendedMinAge:         { type: 'integer', minimum: 3, maximum: 18 },
          timeRecommendationMinutes: { type: 'integer', enum: [15, 30, 60, 90, 120] },
          timeRecommendationLabel:   { type: 'string',
            description: 'e.g. "30 min/day" or "Not recommended"' },
          timeRecommendationColor:   { type: 'string', enum: ['green','amber','red'] },
        },
      },
      narratives: {
        type: 'object',
        required: ['summary','benefitsNarrative','risksNarrative','parentTip'],
        properties: {
          summary:           { type: 'string', description: 'One sentence for a parent who has never heard of this game.' },
          benefitsNarrative: { type: 'string', description: 'What your child develops or enjoys. 2–3 sentences, gaming-positive tone.' },
          risksNarrative:    { type: 'string', description: 'What to watch out for. 2–3 sentences, factual not fear-based.' },
          parentTip:         { type: 'string', description: 'One practical action a parent can take right now.' },
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
  recommendation: {
    curascore: number; recommendedMinAge: number
    timeRecommendationMinutes: number; timeRecommendationLabel: string; timeRecommendationColor: string
  }
  narratives: { summary: string; benefitsNarrative: string; risksNarrative: string; parentTip: string }
}

type ExperienceRow = typeof platformExperiences.$inferSelect

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(e: ExperienceRow): string {
  const visits = e.visitCount ? e.visitCount.toLocaleString() : 'unknown'
  const active = e.activePlayers ? e.activePlayers.toLocaleString() : 'unknown'

  return `You are a child safety researcher evaluating a Roblox experience for PlaySmart, a game rating service for parents.

## CONTEXT: ROBLOX UGC
Roblox experiences are user-generated. Unlike commercial games, they:
- Can contain player-built content that bypasses Roblox moderation
- Have unmoderated chat by default unless filtered
- Often have real-money Robux purchases inside the experience
- Attract a very young audience (avg age 13, many under 10)
- Vary wildly in quality — same genre, very different safety profiles

## CALIBRATION EXAMPLES
- Adopt Me (pet simulator, huge UGC, active trading) → high stranger risk, moderate dopamine, low creativity
- Tower of Hell (pure skill obstacle course, minimal social) → low risk overall, curascore ~70
- Brookhaven RP (social roleplay, open chat, avatar dress-up) → high stranger risk, moderate ugcContentRisk, curascore ~35
- Blox Fruits (grinding RPG, heavy pay-to-win) → high monetization + dopamine, curascore ~30

## EXPERIENCE TO EVALUATE
Title: ${e.title}
Creator: ${e.creatorName ?? 'Unknown'}
Description: ${e.description ?? 'No description provided'}
Genre: ${e.genre ?? 'Unknown'}
Total visits: ${visits}
Current active players: ${active}
Max players per server: ${e.maxPlayers ?? 'Unknown'}

Score this experience accurately. Calibrate against the examples. Call submit_experience_evaluation with your scores.`
}

// ─── Bedrock caller ───────────────────────────────────────────────────────────

async function callBedrock(prompt: string, attempt = 0): Promise<EvalInput> {
  const res = await fetch(BEDROCK_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.AWS_BEARER_TOKEN_BEDROCK}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      tools: [EVAL_TOOL],
      tool_choice: { type: 'tool', name: 'submit_experience_evaluation' },
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      await sleep(Math.pow(2, attempt) * 5000)
      return callBedrock(prompt, attempt + 1)
    }
    throw new Error(`Bedrock ${res.status}: ${err}`)
  }

  const data = await res.json()
  const toolUse = data.content?.find((c: { type: string }) => c.type === 'tool_use')
  if (!toolUse?.input) {
    if (attempt < 3) {
      await sleep(Math.pow(2, attempt) * 5000)
      return callBedrock(prompt, attempt + 1)
    }
    throw new Error('Bedrock did not return tool_use block')
  }
  return toolUse.input as EvalInput
}

// ─── Compute normalized scores ────────────────────────────────────────────────

function computeScores(e: EvalInput) {
  const { risks, benefits } = e
  // Normalize risks to 0–1 (each dimension max 3, 6 dimensions = max 18)
  const riskRaw = risks.dopamineTrapScore + risks.toxicityScore + risks.ugcContentRisk
    + risks.strangerRisk + risks.monetizationScore + risks.privacyRisk
  const riskScore = riskRaw / 18

  // Normalize benefits to 0–1 (each max 3, 3 dimensions = max 9)
  const benefitRaw = benefits.creativityScore + benefits.socialScore + benefits.learningScore
  const benefitScore = benefitRaw / 9

  return { riskScore, benefitScore }
}

// ─── Save to DB ───────────────────────────────────────────────────────────────

async function saveScore(experience: ExperienceRow, eval_: EvalInput): Promise<number> {
  const { riskScore, benefitScore } = computeScores(eval_)

  const row = {
    experienceId:              experience.id,
    curascore:                 eval_.recommendation.curascore,
    dopamineTrapScore:         eval_.risks.dopamineTrapScore,
    toxicityScore:             eval_.risks.toxicityScore,
    ugcContentRisk:            eval_.risks.ugcContentRisk,
    strangerRisk:              eval_.risks.strangerRisk,
    monetizationScore:         eval_.risks.monetizationScore,
    privacyRisk:               eval_.risks.privacyRisk,
    creativityScore:           eval_.benefits.creativityScore,
    socialScore:               eval_.benefits.socialScore,
    learningScore:             eval_.benefits.learningScore,
    riskScore,
    benefitScore,
    timeRecommendationMinutes: eval_.recommendation.timeRecommendationMinutes,
    timeRecommendationLabel:   eval_.recommendation.timeRecommendationLabel,
    timeRecommendationColor:   eval_.recommendation.timeRecommendationColor,
    summary:                   eval_.narratives.summary,
    benefitsNarrative:         eval_.narratives.benefitsNarrative,
    risksNarrative:            eval_.narratives.risksNarrative,
    parentTip:                 eval_.narratives.parentTip,
    recommendedMinAge:         eval_.recommendation.recommendedMinAge,
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

  return eval_.recommendation.curascore
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
  if (!process.env.AWS_BEARER_TOKEN_BEDROCK) {
    return NextResponse.json({ error: 'AWS_BEARER_TOKEN_BEDROCK not set' }, { status: 500 })
  }

  try {
    const pending = await db
      .select({ exp: platformExperiences })
      .from(platformExperiences)
      .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
      .where(isNull(experienceScores.id))
      .limit(MAX_PER_RUN)

    if (pending.length === 0) {
      return NextResponse.json({ message: 'No unscored experiences', evaluated: 0 })
    }

    console.log(`[review-experiences] Found ${pending.length} unscored experiences`)

    const evaluated: string[] = []
    const errors:    string[] = []
    const startedAt = Date.now()

    for (const { exp } of pending) {
      if (Date.now() - startedAt > BUDGET_MS) {
        console.log('[review-experiences] Budget reached — stopping early')
        break
      }
      await sleep(DELAY_MS)

      try {
        console.log(`[review-experiences] Evaluating: ${exp.title}`)
        const result   = await callBedrock(buildPrompt(exp))
        const curascore = await saveScore(exp, result)
        evaluated.push(exp.slug)
        console.log(`[review-experiences] ${exp.title} → curascore ${curascore}`)
      } catch (err) {
        console.error(`[review-experiences] Failed ${exp.slug}:`, err)
        errors.push(exp.slug)
      }
    }

    return NextResponse.json({ evaluated: evaluated.length, errors: errors.length, slugs: evaluated })

  } catch (err) {
    console.error('[review-experiences] Fatal:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
