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
        required: ['recommendedMinAge','timeRecommendationMinutes','timeRecommendationLabel','timeRecommendationColor','curascore'],
        properties: {
          curascore: { type: 'integer', minimum: 0, maximum: 100,
            description: 'Overall LumiKin score (0–100). Treat benefits and risks as independent profiles — a game can score high on both. 70–100 = recommended, 40–69 = with guidance, 0–39 = limit or avoid.' },
          recommendedMinAge:         { type: 'integer', minimum: 3, maximum: 18 },
          timeRecommendationMinutes: { type: 'integer', enum: [15, 30, 60, 90, 120] },
          timeRecommendationLabel:   { type: 'string',
            description: 'e.g. "60 min/day" or "Not recommended for under 10"' },
          timeRecommendationColor:   { type: 'string', enum: ['green','amber','red'] },
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
  recommendation: {
    curascore: number; recommendedMinAge: number
    timeRecommendationMinutes: number; timeRecommendationLabel: string; timeRecommendationColor: string
  }
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

### Time recommendation formula
Base on risk intensity:
- Low risk (dopamine+stranger+monetization all ≤ 1): up to 90–120 min
- Moderate risk (some 2s): up to 60 min
- High risk (any 3, or multiple 2s): 15–30 min
Extend one tier if benefits are strong (creativityScore + learningScore + socialScore ≥ 6).

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
- **strangerRisk**: How much the map design exposes children to unknown adults — open proximity voice chat, designed team-up with randoms, DM invites.
  Note: Fortnite has proximity voice chat ON by default; maps cannot disable it, so base stranger risk starts at 1 unless the map is solo-only.
- **monetizationScore**: V-Buck pressure built into the map — cosmetic requirements, pay-to-win map items, social comparison of skins.
- **privacyRisk**: Map prompts players to share real info or join external Discord/social accounts.

### Time recommendation formula
- Low risk (dopamine+stranger+monetization all ≤ 1): up to 90–120 min
- Moderate risk (some 2s): up to 60 min
- High risk (any 3, or multiple 2s): 15–30 min
Extend one tier if benefits are strong (creativityScore + learningScore + socialScore ≥ 6).

## CALIBRATION EXAMPLES
| Map type | What it is | Key scores | Curascore |
|---|---|---|---|
| Zone Wars | Rotating storm, skill practice, competitive | creativity 0, social 1, learning 2 / dopamine 2, stranger 1, monetization 0 | ~58 |
| Box Fight 1v1 | Aim trainer, structured duels, no monetization | creativity 0, social 1, learning 2 / dopamine 1, stranger 1, monetization 0 | ~65 |
| Deathrun (hard) | Obstacle course, puzzle-solving, solo | creativity 0, social 0, learning 2 / dopamine 1, stranger 0, monetization 0 | ~70 |
| Creative Sandbox | Open building, world creation tools | creativity 3, social 2, learning 2 / dopamine 1, stranger 2, monetization 0 | ~72 |
| Prop Hunt | Social hide-and-seek, large lobbies, chat | creativity 1, social 3, learning 0 / dopamine 1, stranger 2, monetization 0 | ~55 |
| XP Farm | Infinite loop designed to grind XP/Battle Pass | creativity 0, social 0, learning 0 / dopamine 3, stranger 0, monetization 2 | ~18 |

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
      .select({ exp: platformExperiences, platformSlug: games.slug })
      .from(platformExperiences)
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
      .where(or(isNull(experienceScores.id), eq(platformExperiences.needsRescore, true)))
      .limit(MAX_PER_RUN)

    if (pending.length === 0) {
      return NextResponse.json({ message: 'No unscored experiences', evaluated: 0 })
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
        const result    = await callBedrock(buildPrompt(exp, platformSlug))
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

    return NextResponse.json({ evaluated: evaluated.length, errors: errors.length, slugs: evaluated })

  } catch (err) {
    console.error('[review-experiences] Fatal:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
