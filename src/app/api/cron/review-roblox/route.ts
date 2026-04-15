/**
 * GET /api/cron/review-roblox
 *
 * Daily AI evaluation of unscored Roblox experiences via Bedrock.
 * For each unscored experience:
 *   1. Build a Roblox-specific prompt (UGC risks, stranger danger, Robux pressure)
 *   2. Call Bedrock with a structured tool schema
 *   3. Compute composite scores and upsert into experience_scores
 *
 * Protected by CRON_SECRET. Max 10 per run (Bedrock latency is higher for rich prompts).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores } from '@/lib/db/schema'
import { eq, isNull, or } from 'drizzle-orm'

export const maxDuration = 300

const MAX_PER_RUN  = 10
const DELAY_MS     = 300
const BUDGET_MS    = 240_000
const BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
const BEDROCK_URL   = `https://bedrock-runtime.us-east-1.amazonaws.com/model/${BEDROCK_MODEL}/invoke`

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Tool schema ──────────────────────────────────────────────────────────────

const REVIEW_TOOL = {
  name: 'submit_experience_review',
  description: 'Submit a completed PlaySmart safety evaluation for a Roblox experience.',
  input_schema: {
    type: 'object' as const,
    required: ['risks', 'benefits', 'details'],
    properties: {
      risks: {
        type: 'object' as const,
        required: ['strangerRisk','dopamineTrapScore','monetizationScore','toxicityScore','ugcContentRisk','privacyRisk'],
        description: 'UGC-specific risk scores — each 0 (none) to 3 (severe)',
        properties: {
          strangerRisk:       { type: 'integer' as const, minimum: 0, maximum: 3, description: 'Exposure to strangers: open voice/text chat, DMs, friend pressure, grooming vectors' },
          dopamineTrapScore:  { type: 'integer' as const, minimum: 0, maximum: 3, description: 'Variable rewards, streaks, near-miss, FOMO events, infinite-loop gameplay' },
          monetizationScore:  { type: 'integer' as const, minimum: 0, maximum: 3, description: 'Robux pressure: pay-to-win, social spending, limited items, trading manipulation' },
          toxicityScore:      { type: 'integer' as const, minimum: 0, maximum: 3, description: 'Chat toxicity, bullying, competitive shaming, hate speech in community' },
          ugcContentRisk:     { type: 'integer' as const, minimum: 0, maximum: 3, description: 'User-generated content risk: inappropriate builds, avatar items, scripted events' },
          privacyRisk:        { type: 'integer' as const, minimum: 0, maximum: 3, description: 'Data exposure, location sharing, real-name pressure, external platform links' },
        },
      },
      benefits: {
        type: 'object' as const,
        required: ['creativityScore','socialScore','learningScore'],
        description: 'Developmental benefit scores — each 0 (none) to 3 (strong)',
        properties: {
          creativityScore: { type: 'integer' as const, minimum: 0, maximum: 3, description: 'Building, designing, scripting, world creation, self-expression' },
          socialScore:     { type: 'integer' as const, minimum: 0, maximum: 3, description: 'Cooperative teamwork, friendship building, communication, empathy' },
          learningScore:   { type: 'integer' as const, minimum: 0, maximum: 3, description: 'Problem solving, skill development, persistence, literacy, numeracy' },
        },
      },
      details: {
        type: 'object' as const,
        required: ['recommendedMinAge','minSessionMinutes','summary','benefitsNarrative','risksNarrative','parentTip'],
        properties: {
          recommendedMinAge:  { type: 'integer' as const, minimum: 5,  maximum: 18, description: 'Minimum age you would recommend — be conservative for open-chat games' },
          minSessionMinutes:  { type: 'integer' as const, minimum: 1,  maximum: 120 },
          summary:            { type: 'string' as const, description: 'One sentence: what this experience is and who it is for (parent-friendly, no jargon)' },
          benefitsNarrative:  { type: 'string' as const, description: '2–3 sentences on what the child develops or enjoys' },
          risksNarrative:     { type: 'string' as const, description: '2–3 sentences on the main things parents should know or watch for' },
          parentTip:          { type: 'string' as const, description: 'One actionable tip a parent can use today (e.g. play together, set a timer, disable chat)' },
        },
      },
    },
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewInput = {
  risks: {
    strangerRisk: number; dopamineTrapScore: number; monetizationScore: number
    toxicityScore: number; ugcContentRisk: number; privacyRisk: number
  }
  benefits: { creativityScore: number; socialScore: number; learningScore: number }
  details: {
    recommendedMinAge: number; minSessionMinutes: number; summary: string
    benefitsNarrative: string; risksNarrative: string; parentTip: string
  }
}

type ExpRow = typeof platformExperiences.$inferSelect

// ─── Score computation ────────────────────────────────────────────────────────

function computeScores(r: ReviewInput) {
  const { strangerRisk, dopamineTrapScore, monetizationScore, toxicityScore, ugcContentRisk, privacyRisk } = r.risks
  const { creativityScore, socialScore, learningScore } = r.benefits

  // Normalize each 0-3 dimension to 0-1, then weighted average
  const riskScore = (
    (strangerRisk      / 3) * 0.30 +
    (dopamineTrapScore / 3) * 0.25 +
    (monetizationScore / 3) * 0.20 +
    (toxicityScore     / 3) * 0.15 +
    (ugcContentRisk    / 3) * 0.07 +
    (privacyRisk       / 3) * 0.03
  )

  const benefitScore = (
    (creativityScore / 3) * 0.50 +
    (socialScore     / 3) * 0.30 +
    (learningScore   / 3) * 0.20
  )

  const curascore = Math.round((1 - riskScore) * 60 + benefitScore * 40)

  // Time recommendation — more conservative than games (open platform)
  let timeRecommendationMinutes: number
  let timeRecommendationLabel: string
  let timeRecommendationColor: string

  if (curascore >= 71) {
    timeRecommendationMinutes = 90;  timeRecommendationLabel = '90 min/day';  timeRecommendationColor = 'green'
  } else if (curascore >= 51) {
    timeRecommendationMinutes = 60;  timeRecommendationLabel = '60 min/day';  timeRecommendationColor = 'green'
  } else if (curascore >= 31) {
    timeRecommendationMinutes = 30;  timeRecommendationLabel = '30 min/day';  timeRecommendationColor = 'amber'
  } else if (curascore >= 16) {
    timeRecommendationMinutes = 15;  timeRecommendationLabel = '15 min/day';  timeRecommendationColor = 'amber'
  } else {
    timeRecommendationMinutes = 15;  timeRecommendationLabel = 'Not recommended'; timeRecommendationColor = 'red'
  }

  return {
    ...r.risks,
    ...r.benefits,
    riskScore:    parseFloat(riskScore.toFixed(4)),
    benefitScore: parseFloat(benefitScore.toFixed(4)),
    curascore,
    timeRecommendationMinutes,
    timeRecommendationLabel,
    timeRecommendationColor,
    recommendedMinAge: r.details.recommendedMinAge,
    summary:           r.details.summary,
    benefitsNarrative: r.details.benefitsNarrative,
    risksNarrative:    r.details.risksNarrative,
    parentTip:         r.details.parentTip,
  }
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function formatCount(n: number | bigint | null): string {
  if (n == null) return 'unknown'
  const num = typeof n === 'bigint' ? Number(n) : n
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000)     return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000)         return `${(num / 1_000).toFixed(0)}K`
  return String(num)
}

function buildPrompt(exp: ExpRow): string {
  return `You are a child safety researcher evaluating a Roblox experience for parents.

## ROBLOX-SPECIFIC CONTEXT

Roblox is an open UGC platform where anyone can build and publish experiences.
Key risks differ from regular games:
- Stranger chat: most experiences have open text/voice chat with strangers by default
- UGC content: environments, avatars, and events are user-created and may bypass moderation
- Robux economy: persistent virtual currency creates real spending pressure
- Social manipulation: trading, limited items, and social status mechanics are common
- Creator intent: quality and child-suitability varies wildly by creator

## SCORING GUIDE

Risks (0=none, 1=mild, 2=moderate, 3=severe):
- strangerRisk: 0=no interaction, 1=filtered chat only, 2=open chat with strangers, 3=voice+DMs+meetup pressure
- dopamineTrapScore: 0=no loop, 1=light rewards, 2=daily streaks/FOMO, 3=strong variable reward loop with near-miss
- monetizationScore: 0=free content only, 1=cosmetics available, 2=social spending pressure, 3=pay-to-win or heavy FOMO monetization
- toxicityScore: 0=minimal community, 1=occasional toxicity, 2=moderately toxic community, 3=notorious toxicity
- ugcContentRisk: 0=tightly controlled, 1=mostly appropriate, 2=some inappropriate UGC slips through, 3=frequently inappropriate
- privacyRisk: 0=anonymous play, 1=username only, 2=encourages real info, 3=external links/location sharing

Benefits (0=none, 1=mild, 2=moderate, 3=strong):
- creativityScore: 0=no creation, 1=light customisation, 2=building/designing, 3=full world creation/scripting
- socialScore: 0=solo, 1=parallel play, 2=cooperative teamwork, 3=deep friendship/communication
- learningScore: 0=no skill development, 1=basic problem solving, 2=persistence/strategy, 3=literacy/numeracy/coding

## CALIBRATION EXAMPLES
Adopt Me!:      stranger=2, dopamine=3, monetization=3, toxicity=1, ugc=1, privacy=1 | creativity=2, social=2, learning=1 → curascore 32, 15 min/day, age 8+
Tower of Hell:  stranger=1, dopamine=1, monetization=1, toxicity=1, ugc=0, privacy=0 | creativity=0, social=1, learning=2 → curascore 64, 60 min/day, age 7+
Brookhaven RP:  stranger=3, dopamine=1, monetization=2, toxicity=2, ugc=2, privacy=1 | creativity=2, social=3, learning=0 → curascore 35, 30 min/day, age 11+
Murder Mystery: stranger=2, dopamine=1, monetization=2, toxicity=2, ugc=0, privacy=0 | creativity=0, social=2, learning=1 → curascore 46, 30 min/day, age 9+

## EXPERIENCE TO EVALUATE
Title:          ${exp.title}
Creator:        ${exp.creatorName ?? 'Unknown'}
Genre:          ${exp.genre ?? 'Unknown'}
Description:    ${exp.description?.slice(0, 500) ?? 'No description'}
Active players: ${formatCount(exp.activePlayers)} (right now)
Total visits:   ${formatCount(exp.visitCount)}
Max per server: ${exp.maxPlayers ?? 'Unknown'}
Public:         ${exp.isPublic ? 'Yes' : 'No'}

Score this experience accurately and call submit_experience_review.`
}

// ─── Bedrock caller ───────────────────────────────────────────────────────────

async function callBedrock(prompt: string, attempt = 0): Promise<ReviewInput> {
  try {
    const res = await fetch(BEDROCK_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AWS_BEARER_TOKEN_BEDROCK}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2048,
        tools: [REVIEW_TOOL],
        tool_choice: { type: 'tool', name: 'submit_experience_review' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      if ((res.status === 429 || res.status === 503) && attempt < 3) {
        await sleep(Math.pow(2, attempt) * 5000)
        return callBedrock(prompt, attempt + 1)
      }
      throw new Error(`Bedrock ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const toolUse = data.content?.find((c: { type: string }) => c.type === 'tool_use')
    if (!toolUse?.input) {
      if (attempt < 3) { await sleep(Math.pow(2, attempt) * 5000); return callBedrock(prompt, attempt + 1) }
      throw new Error('No tool_use block returned')
    }
    return toolUse.input as ReviewInput
  } catch (err) {
    const isTransient = String(err).includes('fetch failed') || String(err).includes('ECONNRESET')
    if (isTransient && attempt < 3) {
      await sleep(Math.pow(2, attempt) * 5000)
      return callBedrock(prompt, attempt + 1)
    }
    throw err
  }
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function saveScore(exp: ExpRow, r: ReviewInput): Promise<number> {
  const computed = computeScores(r)
  const now = new Date()

  const [existing] = await db
    .select({ id: experienceScores.id })
    .from(experienceScores)
    .where(eq(experienceScores.experienceId, exp.id))
    .limit(1)

  if (existing) {
    await db.update(experienceScores)
      .set({ ...computed, updatedAt: now })
      .where(eq(experienceScores.id, existing.id))
  } else {
    await db.insert(experienceScores).values({ experienceId: exp.id, ...computed, calculatedAt: now, updatedAt: now })
  }

  return computed.curascore
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.AWS_BEARER_TOKEN_BEDROCK)
    return NextResponse.json({ error: 'AWS_BEARER_TOKEN_BEDROCK not set' }, { status: 500 })

  // Pick unscored experiences OR those flagged for rescore (content change / stale)
  const pending = await db
    .select({ exp: platformExperiences })
    .from(platformExperiences)
    .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .where(or(isNull(experienceScores.id), eq(platformExperiences.needsRescore, true)))
    .limit(MAX_PER_RUN)

  if (pending.length === 0)
    return NextResponse.json({ message: 'All experiences scored', reviewed: 0 })

  console.log(`[review-roblox] ${pending.length} unscored experience(s)`)

  const reviewed: string[] = []
  const errors:   string[] = []
  const startedAt = Date.now()

  for (const { exp } of pending) {
    if (Date.now() - startedAt > BUDGET_MS) {
      console.log('[review-roblox] Budget reached — stopping early')
      break
    }
    try {
      await sleep(DELAY_MS)
      const prompt    = buildPrompt(exp)
      const input     = await callBedrock(prompt)
      const curascore = await saveScore(exp, input)
      if (exp.needsRescore) {
        await db.update(platformExperiences).set({ needsRescore: false }).where(eq(platformExperiences.id, exp.id))
      }
      reviewed.push(exp.slug)
      console.log(`[review-roblox] ${exp.title} → curascore ${curascore}${exp.needsRescore ? ' (rescore)' : ''}`)
    } catch (err) {
      console.error(`[review-roblox] Failed for ${exp.slug}:`, err)
      errors.push(exp.slug)
    }
  }

  return NextResponse.json({ reviewed: reviewed.length, errors: errors.length, slugs: reviewed })
}
