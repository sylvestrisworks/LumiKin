/**
 * Auto-review games using the Claude API.
 * Fetches game metadata, asks Claude to score against the PlaySmart rubric,
 * then inserts the review + computed scores into the DB.
 *
 * Usage:
 *   # Review one or more games by slug (fetches from RAWG if not in DB):
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/auto-review.ts minecraft fortnite
 *
 *   # Use Sonnet instead of Haiku for higher quality:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/auto-review.ts --model sonnet minecraft
 *
 *   # Dry run — print scores without writing to DB:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/auto-review.ts --dry-run minecraft
 *
 * Models:
 *   haiku  → claude-haiku-4-5-20251001   (default — fast, cheap, good for bulk)
 *   sonnet → claude-sonnet-4-6           (better quality, use for priority games)
 */

import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, reviews, gameScores } from '../src/lib/db/schema'
import { calculateGameScores } from '../src/lib/scoring/engine'
import { rawgGetDetail, rawgSearch } from '../src/lib/rawg/client'
import { mapDetailToInsert } from '../src/lib/rawg/mapper'

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const modelFlag = args.indexOf('--model')
const modelArg  = modelFlag !== -1 ? args[modelFlag + 1] : 'haiku'
const dryRun    = args.includes('--dry-run')
const slugs     = args.filter(a => !a.startsWith('--') && a !== modelArg)

const MODEL_MAP: Record<string, string> = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus:   'claude-opus-4-6',
}
const MODEL = MODEL_MAP[modelArg] ?? modelArg

if (slugs.length === 0) {
  console.error('Usage: auto-review.ts [--model haiku|sonnet] [--dry-run] <slug> [<slug2> ...]')
  process.exit(1)
}

// ─── Anthropic client ─────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Tool schema (structured output) ─────────────────────────────────────────

const REVIEW_TOOL: Anthropic.Tool = {
  name: 'submit_game_review',
  description: 'Submit a completed PlaySmart rubric review for a game.',
  input_schema: {
    type: 'object' as const,
    required: [
      'b1_cognitive', 'b2_social', 'b3_motor',
      'r1_dopamine', 'r2_monetization', 'r3_social', 'r4_content',
      'practical', 'narratives',
    ],
    properties: {
      b1_cognitive: {
        type: 'object',
        description: 'B1 cognitive scores, each 0–5',
        required: ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge'],
        properties: {
          problemSolving:    { type: 'integer', minimum: 0, maximum: 5 },
          spatialAwareness:  { type: 'integer', minimum: 0, maximum: 5 },
          strategicThinking: { type: 'integer', minimum: 0, maximum: 5 },
          criticalThinking:  { type: 'integer', minimum: 0, maximum: 5 },
          memoryAttention:   { type: 'integer', minimum: 0, maximum: 5 },
          creativity:        { type: 'integer', minimum: 0, maximum: 5 },
          readingLanguage:   { type: 'integer', minimum: 0, maximum: 5 },
          mathSystems:       { type: 'integer', minimum: 0, maximum: 5 },
          learningTransfer:  { type: 'integer', minimum: 0, maximum: 5 },
          adaptiveChallenge: { type: 'integer', minimum: 0, maximum: 5 },
        },
        additionalProperties: false,
      },
      b2_social: {
        type: 'object',
        description: 'B2 social-emotional scores, each 0–5',
        required: ['teamwork','communication','empathy','emotionalRegulation','ethicalReasoning','positiveSocial'],
        properties: {
          teamwork:            { type: 'integer', minimum: 0, maximum: 5 },
          communication:       { type: 'integer', minimum: 0, maximum: 5 },
          empathy:             { type: 'integer', minimum: 0, maximum: 5 },
          emotionalRegulation: { type: 'integer', minimum: 0, maximum: 5 },
          ethicalReasoning:    { type: 'integer', minimum: 0, maximum: 5 },
          positiveSocial:      { type: 'integer', minimum: 0, maximum: 5 },
        },
        additionalProperties: false,
      },
      b3_motor: {
        type: 'object',
        description: 'B3 motor scores, each 0–5',
        required: ['handEyeCoord','fineMotor','reactionTime','physicalActivity'],
        properties: {
          handEyeCoord:     { type: 'integer', minimum: 0, maximum: 5 },
          fineMotor:        { type: 'integer', minimum: 0, maximum: 5 },
          reactionTime:     { type: 'integer', minimum: 0, maximum: 5 },
          physicalActivity: { type: 'integer', minimum: 0, maximum: 5 },
        },
        additionalProperties: false,
      },
      r1_dopamine: {
        type: 'object',
        description: 'R1 dopamine manipulation scores, each 0–3',
        required: ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq'],
        properties: {
          variableRewards:      { type: 'integer', minimum: 0, maximum: 3 },
          streakMechanics:      { type: 'integer', minimum: 0, maximum: 3 },
          lossAversion:         { type: 'integer', minimum: 0, maximum: 3 },
          fomoEvents:           { type: 'integer', minimum: 0, maximum: 3 },
          stoppingBarriers:     { type: 'integer', minimum: 0, maximum: 3 },
          notifications:        { type: 'integer', minimum: 0, maximum: 3 },
          nearMiss:             { type: 'integer', minimum: 0, maximum: 3 },
          infinitePlay:         { type: 'integer', minimum: 0, maximum: 3 },
          escalatingCommitment: { type: 'integer', minimum: 0, maximum: 3 },
          variableRewardFreq:   { type: 'integer', minimum: 0, maximum: 3 },
        },
        additionalProperties: false,
      },
      r2_monetization: {
        type: 'object',
        description: 'R2 monetization pressure scores, each 0–3',
        required: ['spendingCeiling','payToWin','currencyObfuscation','spendingPrompts','childTargeting','adPressure','subscriptionPressure','socialSpending'],
        properties: {
          spendingCeiling:      { type: 'integer', minimum: 0, maximum: 3 },
          payToWin:             { type: 'integer', minimum: 0, maximum: 3 },
          currencyObfuscation:  { type: 'integer', minimum: 0, maximum: 3 },
          spendingPrompts:      { type: 'integer', minimum: 0, maximum: 3 },
          childTargeting:       { type: 'integer', minimum: 0, maximum: 3 },
          adPressure:           { type: 'integer', minimum: 0, maximum: 3 },
          subscriptionPressure: { type: 'integer', minimum: 0, maximum: 3 },
          socialSpending:       { type: 'integer', minimum: 0, maximum: 3 },
        },
        additionalProperties: false,
      },
      r3_social: {
        type: 'object',
        description: 'R3 social/emotional risk scores, each 0–3',
        required: ['socialObligation','competitiveToxicity','strangerRisk','socialComparison','identitySelfWorth','privacyRisk'],
        properties: {
          socialObligation:    { type: 'integer', minimum: 0, maximum: 3 },
          competitiveToxicity: { type: 'integer', minimum: 0, maximum: 3 },
          strangerRisk:        { type: 'integer', minimum: 0, maximum: 3 },
          socialComparison:    { type: 'integer', minimum: 0, maximum: 3 },
          identitySelfWorth:   { type: 'integer', minimum: 0, maximum: 3 },
          privacyRisk:         { type: 'integer', minimum: 0, maximum: 3 },
        },
        additionalProperties: false,
      },
      r4_content: {
        type: 'object',
        description: 'R4 content risk scores, each 0–3 (display only — not in RIS formula)',
        required: ['violenceLevel','sexualContent','language','substanceRef','fearHorror'],
        properties: {
          violenceLevel: { type: 'integer', minimum: 0, maximum: 3 },
          sexualContent: { type: 'integer', minimum: 0, maximum: 3 },
          language:      { type: 'integer', minimum: 0, maximum: 3 },
          substanceRef:  { type: 'integer', minimum: 0, maximum: 3 },
          fearHorror:    { type: 'integer', minimum: 0, maximum: 3 },
        },
        additionalProperties: false,
      },
      practical: {
        type: 'object',
        required: ['estimatedMonthlyCostLow','estimatedMonthlyCostHigh','minSessionMinutes','hasNaturalStoppingPoints','penalizesBreaks','stoppingPointsDescription'],
        properties: {
          estimatedMonthlyCostLow:  { type: 'number', minimum: 0 },
          estimatedMonthlyCostHigh: { type: 'number', minimum: 0 },
          minSessionMinutes:        { type: 'integer', minimum: 1 },
          hasNaturalStoppingPoints: { type: 'boolean' },
          penalizesBreaks:          { type: 'boolean' },
          stoppingPointsDescription: { type: 'string' },
        },
        additionalProperties: false,
      },
      narratives: {
        type: 'object',
        required: ['benefitsNarrative','risksNarrative','parentTip'],
        properties: {
          benefitsNarrative: { type: 'string', description: '2–4 sentences: what the child develops' },
          risksNarrative:    { type: 'string', description: '2–4 sentences: what to watch out for, specific to this game' },
          parentTip:         { type: 'string', description: '1–3 sentences: actionable advice for parents' },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(gameData: {
  title: string
  description: string | null
  developer: string | null
  publisher: string | null
  genres: string[]
  platforms: string[]
  esrbRating: string | null
  metacriticScore: number | null
  basePrice: number | null
  hasMicrotransactions: boolean
  hasLootBoxes: boolean
  hasSubscription: boolean
  hasBattlePass: boolean
  requiresInternet: string | null
  hasStrangerChat: boolean
  chatModeration: string | null
}): string {
  return `You are a child development researcher scoring a video game using the PlaySmart rubric.

## SCORING RUBRIC SUMMARY

### Benefits (B1–B3) — scale 0–5 per item
B1 Cognitive (max 50): problemSolving, spatialAwareness, strategicThinking, criticalThinking, memoryAttention, creativity, readingLanguage, mathSystems, learningTransfer, adaptiveChallenge
  0=not present, 1=minimal, 3=moderate, 5=core mechanic

B2 Social-emotional (max 30): teamwork, communication, empathy, emotionalRegulation, ethicalReasoning, positiveSocial
  Score genuine cooperative design highly; solo games with cosmetic multiplayer score low

B3 Motor (max 20): handEyeCoord, fineMotor, reactionTime, physicalActivity
  physicalActivity=5 only for VR/motion games (Ring Fit, Beat Saber, Pokémon GO)

### Risks (R1–R4) — scale 0–3 per item
R1 Dopamine manipulation (max 30): variableRewards, streakMechanics, lossAversion, fomoEvents, stoppingBarriers, notifications, nearMiss, infinitePlay, escalatingCommitment, variableRewardFreq
  3=core mechanic, 2=significant, 1=mild/optional, 0=not present

R2 Monetization (max 24): spendingCeiling, payToWin, currencyObfuscation, spendingPrompts, childTargeting, adPressure, subscriptionPressure, socialSpending
  Free-to-play games with aggressive IAP typically score 15–20+ here

R3 Social risk (max 18): socialObligation, competitiveToxicity, strangerRisk, socialComparison, identitySelfWorth, privacyRisk

R4 Content (max 15): violenceLevel, sexualContent, language, substanceRef, fearHorror
  These are display-only; they do NOT affect the time recommendation

## CALIBRATION EXAMPLES

Minecraft (vanilla, no marketplace): B1=38, B2=16, B3=6 | R1=4, R2=2, R3=4 → BDS=0.60, RIS=0.14, Curascore=75, 120 min/day
Fortnite: B1=19, B2=10, B3=13 | R1=18, R2=13, R3=11 → BDS=0.42, RIS=0.585, Curascore=42, 30 min/day
Brawl Stars: B1=14, B2=9, B3=11 | R1=23, R2=18, R3=12 → BDS=0.34, RIS=0.737, Curascore=30, 15 min/day

## GAME TO REVIEW

Title: ${gameData.title}
Developer: ${gameData.developer ?? 'Unknown'}
Publisher: ${gameData.publisher ?? 'Unknown'}
Description: ${gameData.description ?? 'Not available'}
Genres: ${gameData.genres.join(', ') || 'Unknown'}
Platforms: ${gameData.platforms.join(', ') || 'Unknown'}
ESRB Rating: ${gameData.esrbRating ?? 'Not rated'}
Metacritic: ${gameData.metacriticScore ?? 'N/A'}
Base price: ${gameData.basePrice === 0 ? 'Free-to-play' : gameData.basePrice != null ? `$${gameData.basePrice}` : 'Unknown'}
Microtransactions: ${gameData.hasMicrotransactions ? 'Yes' : 'No'}
Loot boxes: ${gameData.hasLootBoxes ? 'Yes' : 'No'}
Battle pass: ${gameData.hasBattlePass ? 'Yes' : 'No'}
Subscription: ${gameData.hasSubscription ? 'Yes' : 'No'}
Requires internet: ${gameData.requiresInternet ?? 'Unknown'}
Stranger chat: ${gameData.hasStrangerChat ? `Yes (${gameData.chatModeration ?? 'unknown moderation'})` : 'No'}

Use your knowledge of this game to fill in the rubric scores accurately. Be calibrated against the examples above — don't inflate benefits or deflate risks. Call submit_game_review with your scores.`
}

// ─── Ensure game is in DB ─────────────────────────────────────────────────────

async function ensureGame(slug: string) {
  const [existing] = await db.select().from(games).where(eq(games.slug, slug)).limit(1)
  if (existing) return existing

  console.log(`  Game not in DB — fetching from RAWG by slug "${slug}"…`)
  try {
    const detail = await rawgGetDetail(slug)
    const data   = mapDetailToInsert(detail)
    const [inserted] = await db.insert(games).values(data).returning()
    console.log(`  Inserted from RAWG (id:${inserted.id})`)
    return inserted
  } catch {
    // Slug didn't work — try search
    console.log(`  Slug fetch failed, trying search…`)
    const list = await rawgSearch(slug.replace(/-/g, ' '), 1, 3)
    if (list.results.length === 0) throw new Error(`Game "${slug}" not found on RAWG`)
    const detail = await rawgGetDetail(list.results[0].id)
    const data   = mapDetailToInsert(detail)
    const [inserted] = await db.insert(games).values(data).returning()
    console.log(`  Inserted "${detail.name}" from RAWG (id:${inserted.id})`)
    return inserted
  }
}

// ─── Main review loop ─────────────────────────────────────────────────────────

async function reviewGame(slug: string) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Reviewing: ${slug}`)

  const game = await ensureGame(slug)

  // Build prompt
  const prompt = buildPrompt({
    title:               game.title,
    description:         game.description,
    developer:           game.developer,
    publisher:           game.publisher,
    genres:              (game.genres as string[]) ?? [],
    platforms:           (game.platforms as string[]) ?? [],
    esrbRating:          game.esrbRating,
    metacriticScore:     game.metacriticScore,
    basePrice:           game.basePrice,
    hasMicrotransactions: game.hasMicrotransactions ?? false,
    hasLootBoxes:        game.hasLootBoxes ?? false,
    hasSubscription:     game.hasSubscription ?? false,
    hasBattlePass:       game.hasBattlePass ?? false,
    requiresInternet:    game.requiresInternet,
    hasStrangerChat:     game.hasStrangerChat ?? false,
    chatModeration:      game.chatModeration,
  })

  console.log(`  Calling ${MODEL}…`)
  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 2048,
    tools:      [REVIEW_TOOL],
    tool_choice: { type: 'any' },
    messages:   [{ role: 'user', content: prompt }],
  })

  // Extract tool use block
  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not call submit_game_review')
  }

  const r = toolUse.input as {
    b1_cognitive:    Record<string, number>
    b2_social:       Record<string, number>
    b3_motor:        Record<string, number>
    r1_dopamine:     Record<string, number>
    r2_monetization: Record<string, number>
    r3_social:       Record<string, number>
    r4_content:      Record<string, number>
    practical: {
      estimatedMonthlyCostLow:   number
      estimatedMonthlyCostHigh:  number
      minSessionMinutes:         number
      hasNaturalStoppingPoints:  boolean
      penalizesBreaks:           boolean
      stoppingPointsDescription: string
    }
    narratives: {
      benefitsNarrative: string
      risksNarrative:    string
      parentTip:         string
    }
  }

  // Flatten for scoring engine
  const scoreInput = {
    ...r.b1_cognitive,
    ...r.b2_social,
    ...r.b3_motor,
    ...r.r1_dopamine,
    ...r.r2_monetization,
    ...r.r3_social,
    ...r.r4_content,
  }

  const computed = calculateGameScores(scoreInput)

  const b1sum = Object.values(r.b1_cognitive).reduce((a, b) => a + b, 0)
  const b2sum = Object.values(r.b2_social).reduce((a, b) => a + b, 0)
  const b3sum = Object.values(r.b3_motor).reduce((a, b) => a + b, 0)
  const r1sum = Object.values(r.r1_dopamine).reduce((a, b) => a + b, 0)
  const r2sum = Object.values(r.r2_monetization).reduce((a, b) => a + b, 0)
  const r3sum = Object.values(r.r3_social).reduce((a, b) => a + b, 0)

  console.log(`  B1=${b1sum}  B2=${b2sum}  B3=${b3sum}  |  R1=${r1sum}  R2=${r2sum}  R3=${r3sum}`)
  console.log(`  BDS=${computed.bds.toFixed(3)}  RIS=${computed.ris.toFixed(3)}  Curascore=${computed.curascore}  Time=${computed.timeRecommendation.minutes}min (${computed.timeRecommendation.color})`)
  console.log(`  Benefits: "${r.narratives.benefitsNarrative.slice(0, 80)}…"`)

  if (dryRun) {
    console.log(`  [DRY RUN] Skipping DB write.`)
    return
  }

  // Upsert review
  const reviewData = {
    gameId:    game.id,
    reviewTier: 'automated' as const,
    status:    'approved' as const,
    ...r.b1_cognitive,
    ...r.b2_social,
    ...r.b3_motor,
    ...r.r1_dopamine,
    ...r.r2_monetization,
    ...r.r3_social,
    ...r.r4_content,
    estimatedMonthlyCostLow:   r.practical.estimatedMonthlyCostLow,
    estimatedMonthlyCostHigh:  r.practical.estimatedMonthlyCostHigh,
    minSessionMinutes:         r.practical.minSessionMinutes,
    hasNaturalStoppingPoints:  r.practical.hasNaturalStoppingPoints,
    penalizesBreaks:           r.practical.penalizesBreaks,
    stoppingPointsDescription: r.practical.stoppingPointsDescription,
    benefitsNarrative:         r.narratives.benefitsNarrative,
    risksNarrative:            r.narratives.risksNarrative,
    parentTip:                 r.narratives.parentTip,
    approvedAt:                new Date(),
  }

  const [existingReview] = await db.select({ id: reviews.id })
    .from(reviews).where(eq(reviews.gameId, game.id)).limit(1)

  let reviewId: number
  if (existingReview) {
    await db.update(reviews).set({ ...reviewData, updatedAt: new Date() })
      .where(eq(reviews.id, existingReview.id))
    reviewId = existingReview.id
    console.log(`  Updated review (id:${reviewId})`)
  } else {
    const [ins] = await db.insert(reviews).values(reviewData).returning({ id: reviews.id })
    reviewId = ins.id
    console.log(`  Inserted review (id:${reviewId})`)
  }

  // Upsert scores
  const scoreData = {
    gameId:                    game.id,
    reviewId,
    cognitiveScore:            computed.cognitiveScore,
    socialEmotionalScore:      computed.socialEmotionalScore,
    motorScore:                computed.motorScore,
    bds:                       computed.bds,
    dopamineRisk:              computed.dopamineRisk,
    monetizationRisk:          computed.monetizationRisk,
    socialRisk:                computed.socialRisk,
    contentRisk:               computed.contentRisk,
    ris:                       computed.ris,
    curascore:                 computed.curascore,
    timeRecommendationMinutes: computed.timeRecommendation.minutes,
    timeRecommendationLabel:   computed.timeRecommendation.label,
    timeRecommendationReasoning: computed.timeRecommendation.reasoning,
    timeRecommendationColor:   computed.timeRecommendation.color,
    topBenefits:               computed.topBenefits,
    calculatedAt:              new Date(),
  }

  const [existingScore] = await db.select({ id: gameScores.id })
    .from(gameScores).where(eq(gameScores.gameId, game.id)).limit(1)

  if (existingScore) {
    await db.update(gameScores).set(scoreData).where(eq(gameScores.id, existingScore.id))
    console.log(`  Updated scores (id:${existingScore.id})`)
  } else {
    const [ins] = await db.insert(gameScores).values(scoreData).returning({ id: gameScores.id })
    console.log(`  Inserted scores (id:${ins.id})`)
  }

  console.log(`  Done → /game/${game.slug}`)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`Model: ${MODEL}${dryRun ? '  [DRY RUN]' : ''}`)
  console.log(`Games: ${slugs.join(', ')}`)

  const errors: string[] = []

  for (const slug of slugs) {
    try {
      await reviewGame(slug)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ERROR on ${slug}: ${msg}`)
      errors.push(slug)
    }
  }

  if (errors.length > 0) {
    console.error(`\nFailed: ${errors.join(', ')}`)
    process.exit(1)
  }

  console.log(`\nAll done.`)
}

main().catch(e => { console.error(e); process.exit(1) })
