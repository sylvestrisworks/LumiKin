/**
 * Auto-review all games that have no scores yet.
 * Supports both Anthropic (Claude) and Google (Gemini via Vertex AI) as providers.
 *
 * Usage:
 *   # Default: Anthropic Haiku, batch of 20
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/auto-review-pending.ts
 *
 *   # Use Google Gemini Flash (cheaper, good for bulk):
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/auto-review-pending.ts --provider google
 *
 *   # Custom batch size and model:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/auto-review-pending.ts --provider google --limit 50
 *
 *   # Dry run:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/auto-review-pending.ts --provider google --dry-run
 *
 * Required env vars:
 *   Anthropic: ANTHROPIC_API_KEY
 *   Google:    GOOGLE_PROJECT_ID  (+ gcloud ADC locally, GOOGLE_CREDENTIALS JSON in CI)
 */

import Anthropic from '@anthropic-ai/sdk'
import { VertexAI } from '@google-cloud/vertexai'
import { isNull, eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, gameScores, reviews } from '../src/lib/db/schema'
import { calculateGameScores } from '../src/lib/scoring/engine'
import { rawgGetDetail, rawgSearch } from '../src/lib/rawg/client'
import { mapDetailToInsert } from '../src/lib/rawg/mapper'

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

const providerFlag = args.indexOf('--provider')
const provider     = (providerFlag !== -1 ? args[providerFlag + 1] : 'anthropic') as 'anthropic' | 'google'

const modelFlag = args.indexOf('--model')
const modelArg  = modelFlag !== -1 ? args[modelFlag + 1]
  : provider === 'google' ? 'flash' : 'haiku'

const dryRun    = args.includes('--dry-run')
const limitFlag = args.indexOf('--limit')
const limit     = limitFlag !== -1 ? parseInt(args[limitFlag + 1], 10) : 20

// Model name resolution
const ANTHROPIC_MODELS: Record<string, string> = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus:   'claude-opus-4-6',
}
const GOOGLE_MODELS: Record<string, string> = {
  flash:  'gemini-2.0-flash-001',
  pro:    'gemini-1.5-pro-002',
  flash15: 'gemini-1.5-flash-002',
}

const MODEL = provider === 'google'
  ? (GOOGLE_MODELS[modelArg] ?? modelArg)
  : (ANTHROPIC_MODELS[modelArg] ?? modelArg)

// ─── Anthropic client ─────────────────────────────────────────────────────────

const anthropic = provider === 'anthropic'
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

// ─── Vertex AI client ─────────────────────────────────────────────────────────

const vertex = provider === 'google'
  ? new VertexAI({
      project:  process.env.GOOGLE_PROJECT_ID!,
      location: process.env.GOOGLE_LOCATION ?? 'us-central1',
    })
  : null

// ─── Rubric field definitions (shared between providers) ─────────────────────

const B1_FIELDS = ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge']
const B2_FIELDS = ['teamwork','communication','empathy','emotionalRegulation','ethicalReasoning','positiveSocial']
const B3_FIELDS = ['handEyeCoord','fineMotor','reactionTime','physicalActivity']
const R1_FIELDS = ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq']
const R2_FIELDS = ['spendingCeiling','payToWin','currencyObfuscation','spendingPrompts','childTargeting','adPressure','subscriptionPressure','socialSpending']
const R3_FIELDS = ['socialObligation','competitiveToxicity','strangerRisk','socialComparison','identitySelfWorth','privacyRisk']
const R4_FIELDS = ['violenceLevel','sexualContent','language','substanceRef','fearHorror']

function scoreGroup(fields: string[], max: number, desc: string) {
  return {
    type: 'object' as const,
    description: desc,
    required: fields,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer' as const, minimum: 0, maximum: max }])),
    additionalProperties: false as const,
  }
}

// ─── Anthropic tool schema ────────────────────────────────────────────────────

const ANTHROPIC_TOOL: Anthropic.Tool = {
  name: 'submit_game_review',
  description: 'Submit a completed PlaySmart rubric review for a game.',
  input_schema: {
    type: 'object',
    required: ['b1_cognitive','b2_social','b3_motor','r1_dopamine','r2_monetization','r3_social','r4_content','practical','narratives'],
    additionalProperties: false,
    properties: {
      b1_cognitive:    scoreGroup(B1_FIELDS, 5, 'B1 cognitive scores, each 0–5'),
      b2_social:       scoreGroup(B2_FIELDS, 5, 'B2 social-emotional scores, each 0–5'),
      b3_motor:        scoreGroup(B3_FIELDS, 5, 'B3 motor scores, each 0–5'),
      r1_dopamine:     scoreGroup(R1_FIELDS, 3, 'R1 dopamine manipulation scores, each 0–3'),
      r2_monetization: scoreGroup(R2_FIELDS, 3, 'R2 monetization pressure scores, each 0–3'),
      r3_social:       scoreGroup(R3_FIELDS, 3, 'R3 social/emotional risk scores, each 0–3'),
      r4_content:      scoreGroup(R4_FIELDS, 3, 'R4 content risk scores, each 0–3 (display only)'),
      practical: {
        type: 'object',
        required: ['estimatedMonthlyCostLow','estimatedMonthlyCostHigh','minSessionMinutes','hasNaturalStoppingPoints','penalizesBreaks','stoppingPointsDescription'],
        additionalProperties: false,
        properties: {
          estimatedMonthlyCostLow:   { type: 'number',  minimum: 0 },
          estimatedMonthlyCostHigh:  { type: 'number',  minimum: 0 },
          minSessionMinutes:         { type: 'integer', minimum: 1 },
          hasNaturalStoppingPoints:  { type: 'boolean' },
          penalizesBreaks:           { type: 'boolean' },
          stoppingPointsDescription: { type: 'string'  },
        },
      },
      narratives: {
        type: 'object',
        required: ['benefitsNarrative','risksNarrative','parentTip'],
        additionalProperties: false,
        properties: {
          benefitsNarrative: { type: 'string', description: '2–4 sentences: what the child develops' },
          risksNarrative:    { type: 'string', description: '2–4 sentences: what to watch out for' },
          parentTip:         { type: 'string', description: '1–3 sentences: actionable advice for parents' },
        },
      },
    },
  },
}

// ─── Gemini function declaration (uppercase types, no additionalProperties) ───

// Gemini uses uppercase type names in its schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'additionalProperties') continue // not supported in Gemini
    if (k === 'type' && typeof v === 'string') {
      out[k] = v.toUpperCase()
    } else if (typeof v === 'object' && v !== null) {
      out[k] = toGeminiSchema(v)
    } else {
      out[k] = v
    }
  }
  return out
}

const GEMINI_FUNCTION = {
  name: 'submit_game_review',
  description: 'Submit a completed PlaySmart rubric review for a game.',
  parameters: toGeminiSchema(ANTHROPIC_TOOL.input_schema),
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

type GameInfo = {
  title: string; description: string | null; developer: string | null
  publisher: string | null; genres: string[]; platforms: string[]
  esrbRating: string | null; metacriticScore: number | null; basePrice: number | null
  hasMicrotransactions: boolean; hasLootBoxes: boolean; hasSubscription: boolean
  hasBattlePass: boolean; requiresInternet: string | null
  hasStrangerChat: boolean; chatModeration: string | null
}

function buildPrompt(g: GameInfo): string {
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
R2 Monetization (max 24): spendingCeiling, payToWin, currencyObfuscation, spendingPrompts, childTargeting, adPressure, subscriptionPressure, socialSpending
R3 Social risk (max 18): socialObligation, competitiveToxicity, strangerRisk, socialComparison, identitySelfWorth, privacyRisk
R4 Content (max 15): violenceLevel, sexualContent, language, substanceRef, fearHorror — display only, NOT in time formula

## CALIBRATION EXAMPLES

Minecraft (vanilla): B1=38, B2=16, B3=6 | R1=4, R2=2, R3=4 → BDS=0.60, RIS=0.14, Curascore=75, 120 min/day
Fortnite: B1=19, B2=10, B3=13 | R1=18, R2=13, R3=11 → BDS=0.42, RIS=0.585, Curascore=42, 30 min/day
Brawl Stars: B1=14, B2=9, B3=11 | R1=23, R2=18, R3=12 → BDS=0.34, RIS=0.737, Curascore=30, 15 min/day

## GAME TO REVIEW

Title: ${g.title}
Developer: ${g.developer ?? 'Unknown'}
Publisher: ${g.publisher ?? 'Unknown'}
Description: ${g.description ?? 'Not available'}
Genres: ${g.genres.join(', ') || 'Unknown'}
Platforms: ${g.platforms.join(', ') || 'Unknown'}
ESRB Rating: ${g.esrbRating ?? 'Not rated'}
Metacritic: ${g.metacriticScore ?? 'N/A'}
Base price: ${g.basePrice === 0 ? 'Free-to-play' : g.basePrice != null ? `$${g.basePrice}` : 'Unknown'}
Microtransactions: ${g.hasMicrotransactions ? 'Yes' : 'No'}
Loot boxes: ${g.hasLootBoxes ? 'Yes' : 'No'}
Battle pass: ${g.hasBattlePass ? 'Yes' : 'No'}
Subscription: ${g.hasSubscription ? 'Yes' : 'No'}
Requires internet: ${g.requiresInternet ?? 'Unknown'}
Stranger chat: ${g.hasStrangerChat ? `Yes (${g.chatModeration ?? 'unknown moderation'})` : 'No'}

Score this game accurately. Calibrate against the examples above. Call submit_game_review with your scores.`
}

// ─── Typed review input ───────────────────────────────────────────────────────

type ReviewInput = {
  b1_cognitive:    Record<string, number>
  b2_social:       Record<string, number>
  b3_motor:        Record<string, number>
  r1_dopamine:     Record<string, number>
  r2_monetization: Record<string, number>
  r3_social:       Record<string, number>
  r4_content:      Record<string, number>
  practical: {
    estimatedMonthlyCostLow: number; estimatedMonthlyCostHigh: number
    minSessionMinutes: number; hasNaturalStoppingPoints: boolean
    penalizesBreaks: boolean; stoppingPointsDescription: string
  }
  narratives: { benefitsNarrative: string; risksNarrative: string; parentTip: string }
}

// ─── Provider: Anthropic ──────────────────────────────────────────────────────

async function callAnthropic(prompt: string): Promise<ReviewInput> {
  const response = await anthropic!.messages.create({
    model:       MODEL,
    max_tokens:  2048,
    tools:       [ANTHROPIC_TOOL],
    tool_choice: { type: 'any' },
    messages:    [{ role: 'user', content: prompt }],
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not call submit_game_review')
  }

  return toolUse.input as ReviewInput
}

// ─── Provider: Google Gemini via Vertex AI ────────────────────────────────────

async function callGemini(prompt: string): Promise<ReviewInput> {
  const model = vertex!.getGenerativeModel({ model: MODEL })

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ functionDeclarations: [GEMINI_FUNCTION] }],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY' as const,
        allowedFunctionNames: ['submit_game_review'],
      },
    },
  })

  const part = result.response.candidates?.[0]?.content?.parts?.[0]
  if (!part?.functionCall?.args) {
    throw new Error('Gemini did not return a function call')
  }

  return part.functionCall.args as ReviewInput
}

// ─── Unified call ─────────────────────────────────────────────────────────────

async function getReview(prompt: string): Promise<ReviewInput> {
  return provider === 'google' ? callGemini(prompt) : callAnthropic(prompt)
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

// ─── Review one game ──────────────────────────────────────────────────────────

async function reviewGame(slug: string) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Reviewing: ${slug}`)

  const game = await ensureGame(slug)
  const prompt = buildPrompt({
    title: game.title, description: game.description,
    developer: game.developer, publisher: game.publisher,
    genres: (game.genres as string[]) ?? [], platforms: (game.platforms as string[]) ?? [],
    esrbRating: game.esrbRating, metacriticScore: game.metacriticScore,
    basePrice: game.basePrice,
    hasMicrotransactions: game.hasMicrotransactions ?? false,
    hasLootBoxes: game.hasLootBoxes ?? false,
    hasSubscription: game.hasSubscription ?? false,
    hasBattlePass: game.hasBattlePass ?? false,
    requiresInternet: game.requiresInternet,
    hasStrangerChat: game.hasStrangerChat ?? false,
    chatModeration: game.chatModeration,
  })

  console.log(`  Calling ${MODEL} (${provider})…`)
  const r = await getReview(prompt)

  const computed = calculateGameScores({
    ...r.b1_cognitive, ...r.b2_social, ...r.b3_motor,
    ...r.r1_dopamine,  ...r.r2_monetization, ...r.r3_social, ...r.r4_content,
  })

  const sums = {
    b1: Object.values(r.b1_cognitive).reduce((a, b) => a + b, 0),
    b2: Object.values(r.b2_social).reduce((a, b) => a + b, 0),
    b3: Object.values(r.b3_motor).reduce((a, b) => a + b, 0),
    r1: Object.values(r.r1_dopamine).reduce((a, b) => a + b, 0),
    r2: Object.values(r.r2_monetization).reduce((a, b) => a + b, 0),
    r3: Object.values(r.r3_social).reduce((a, b) => a + b, 0),
  }

  console.log(`  B1=${sums.b1}  B2=${sums.b2}  B3=${sums.b3}  |  R1=${sums.r1}  R2=${sums.r2}  R3=${sums.r3}`)
  console.log(`  BDS=${computed.bds.toFixed(3)}  RIS=${computed.ris.toFixed(3)}  Curascore=${computed.curascore}  Time=${computed.timeRecommendation.minutes}min (${computed.timeRecommendation.color})`)

  if (dryRun) {
    console.log(`  [DRY RUN] Skipping DB write.`)
    return
  }

  const reviewData = {
    gameId: game.id, reviewTier: 'automated' as const, status: 'approved' as const,
    ...r.b1_cognitive, ...r.b2_social, ...r.b3_motor,
    ...r.r1_dopamine,  ...r.r2_monetization, ...r.r3_social, ...r.r4_content,
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

  const scoreData = {
    gameId: game.id, reviewId,
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
    calculatedAt:                new Date(),
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

// ─── Find unreviewed games ────────────────────────────────────────────────────

async function getPendingGames(): Promise<{ slug: string; title: string }[]> {
  return db
    .select({ slug: games.slug, title: games.title })
    .from(games)
    .leftJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNull(gameScores.id))
    .limit(limit)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`Provider: ${provider}  Model: ${MODEL}  Limit: ${limit}${dryRun ? '  [DRY RUN]' : ''}`)

  if (provider === 'google' && !process.env.GOOGLE_PROJECT_ID) {
    console.error('ERROR: GOOGLE_PROJECT_ID is not set in environment.')
    process.exit(1)
  }
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set in environment.')
    process.exit(1)
  }

  const pending = await getPendingGames()

  if (pending.length === 0) {
    console.log('\nNo unreviewed games found. Database is fully scored!')
    process.exit(0)
  }

  console.log(`\nFound ${pending.length} game(s) to review:`)
  pending.forEach((g, i) => console.log(`  ${i + 1}. ${g.title} (${g.slug})`))

  const errors: string[] = []

  for (const game of pending) {
    try {
      await reviewGame(game.slug)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ERROR on ${game.slug}: ${msg}`)
      errors.push(game.slug)
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Done. ${pending.length - errors.length}/${pending.length} succeeded.`)

  if (errors.length > 0) {
    console.error(`Failed: ${errors.join(', ')}`)
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
