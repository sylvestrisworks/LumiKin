/**
 * Debate run: re-score the top N games by Curascore using a devil's advocate prompt.
 *
 * The model is shown the existing scores and asked to challenge them — looking for
 * inflated benefits, underweighted risks, or miscalibrated items — then submit a
 * final verdict. Games where the Curascore changes by more than a threshold are
 * flagged as "significant disagreements".
 *
 * Usage:
 *   # Dry run — show diffs, no DB writes (default)
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/debate-top-games.ts
 *
 *   # Score 50 top games, dry run
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/debate-top-games.ts --limit 50
 *
 *   # Apply score changes to DB
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/debate-top-games.ts --apply
 *
 *   # Single game by slug
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/debate-top-games.ts --slug minecraft --apply
 */

import { GoogleGenAI, FunctionCallingConfigMode, Type } from '@google/genai'
import { eq, desc, isNotNull } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, gameScores, reviews } from '../src/lib/db/schema'
import { calculateGameScores } from '../src/lib/scoring/engine'

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args  = process.argv.slice(2)
const apply = args.includes('--apply')
const limitFlag = args.indexOf('--limit')
const limit = limitFlag !== -1 ? parseInt(args[limitFlag + 1], 10) : 100
const slugFlag   = args.indexOf('--slug')
const targetSlug = slugFlag !== -1 ? args[slugFlag + 1] : null

// Flag games where debated curascore differs by at least this many points
const FLAG_THRESHOLD = 8

// ─── Google Gen AI client ─────────────────────────────────────────────────────

const googleAI = new GoogleGenAI({
  vertexai: true,
  project:  process.env.GOOGLE_PROJECT_ID!,
  location: process.env.GOOGLE_LOCATION ?? 'us-central1',
})

const MODEL          = 'gemini-2.5-flash'
const FALLBACK_MODEL = 'gemini-1.5-flash-002'

// ─── Rubric fields (mirrors auto-review-pending.ts) ───────────────────────────

const B1_FIELDS = ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge']
const B2_FIELDS = ['teamwork','communication','empathy','emotionalRegulation','ethicalReasoning','positiveSocial']
const B3_FIELDS = ['handEyeCoord','fineMotor','reactionTime','physicalActivity']
const R1_FIELDS = ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq']
const R2_FIELDS = ['spendingCeiling','payToWin','currencyObfuscation','spendingPrompts','childTargeting','adPressure','subscriptionPressure','socialSpending']
const R3_FIELDS = ['socialObligation','competitiveToxicity','strangerRisk','socialComparison','identitySelfWorth','privacyRisk']
const R4_FIELDS = ['violenceLevel','sexualContent','language','substanceRef','fearHorror']
const REP_FIELDS = ['repGenderBalance','repEthnicDiversity']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoreGroup(fields: string[], max: number, desc: string): any {
  return {
    type: 'object',
    description: desc,
    required: fields,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer', minimum: 0, maximum: max }])),
    additionalProperties: false,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema
  const TYPE_MAP: Record<string, Type> = {
    object: Type.OBJECT, string: Type.STRING, integer: Type.INTEGER,
    number: Type.NUMBER, boolean: Type.BOOLEAN, array: Type.ARRAY,
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'additionalProperties') continue
    if (k === 'type' && typeof v === 'string') out[k] = TYPE_MAP[v] ?? v
    else if (k === 'properties' && typeof v === 'object' && v !== null)
      out[k] = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, toGeminiSchema(pv)]))
    else if (typeof v === 'object' && v !== null && !Array.isArray(v)) out[k] = toGeminiSchema(v)
    else out[k] = v
  }
  return out
}

const GEMINI_FUNCTION = {
  name: 'submit_game_review',
  description: 'Submit the final debated LumiKin rubric scores for a game.',
  parameters: toGeminiSchema({
    type: 'object',
    required: ['b1_cognitive','b2_social','b3_motor','r1_dopamine','r2_monetization','r3_social','r4_content','representation','propaganda','bechdel','practical','narratives'],
    additionalProperties: false,
    properties: {
      b1_cognitive:    scoreGroup(B1_FIELDS, 5, 'B1 cognitive scores, each 0–5'),
      b2_social:       scoreGroup(B2_FIELDS, 5, 'B2 social-emotional scores, each 0–5'),
      b3_motor:        scoreGroup(B3_FIELDS, 5, 'B3 motor scores, each 0–5'),
      r1_dopamine:     scoreGroup(R1_FIELDS, 3, 'R1 dopamine manipulation scores, each 0–3'),
      r2_monetization: scoreGroup(R2_FIELDS, 3, 'R2 monetization pressure scores, each 0–3'),
      r3_social:       scoreGroup(R3_FIELDS, 3, 'R3 social/emotional risk scores, each 0–3'),
      r4_content:      scoreGroup(R4_FIELDS, 3, 'R4 content risk scores, each 0–3'),
      representation:  scoreGroup(REP_FIELDS, 3, 'REP representation scores, each 0–3'),
      propaganda: {
        type: 'object', required: ['propagandaLevel','propagandaNotes'], additionalProperties: false,
        properties: {
          propagandaLevel: { type: 'integer', minimum: 0, maximum: 3 },
          propagandaNotes: { type: 'string' },
        },
      },
      bechdel: {
        type: 'object', required: ['result','notes'], additionalProperties: false,
        properties: {
          result: { type: 'string', enum: ['pass','fail','na'] },
          notes:  { type: 'string' },
        },
      },
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
        required: ['benefitsNarrative','risksNarrative','parentTip','parentTipBenefits'],
        additionalProperties: false,
        properties: {
          benefitsNarrative: { type: 'string' },
          risksNarrative:    { type: 'string' },
          parentTip:         { type: 'string' },
          parentTipBenefits: { type: 'string' },
        },
      },
    },
  }),
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fmtGroup(label: string, fields: string[], data: Record<string, any>) {
  return `${label}: ${fields.map(f => `${f}=${data[f] ?? '?'}`).join(', ')}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDebatePrompt(game: any, review: any, currentScore: any): string {
  const b1 = fmtGroup('B1', B1_FIELDS, review)
  const b2 = fmtGroup('B2', B2_FIELDS, review)
  const b3 = fmtGroup('B3', B3_FIELDS, review)
  const r1 = fmtGroup('R1', R1_FIELDS, review)
  const r2 = fmtGroup('R2', R2_FIELDS, review)
  const r3 = fmtGroup('R3', R3_FIELDS, review)

  return `You are a senior child safety researcher auditing a LumiKin rubric review. Your job is to CHALLENGE the existing scores — look for anything too generous or too lenient — and then submit what you believe are the correct final scores.

## SCORING RUBRIC SUMMARY

Benefits (0–5 each):
  B1 Cognitive: problemSolving, spatialAwareness, strategicThinking, criticalThinking, memoryAttention, creativity, readingLanguage, mathSystems, learningTransfer, adaptiveChallenge
  B2 Social-emotional: teamwork, communication, empathy, emotionalRegulation, ethicalReasoning, positiveSocial
  B3 Motor: handEyeCoord, fineMotor, reactionTime, physicalActivity
  (5=core mechanic, 3=moderate, 1=minimal, 0=not present — be strict on 5s)

Risks (0–3 each):
  R1 Dopamine: variableRewards, streakMechanics, lossAversion, fomoEvents, stoppingBarriers, notifications, nearMiss, infinitePlay, escalatingCommitment, variableRewardFreq
  R2 Monetization: spendingCeiling, payToWin, currencyObfuscation, spendingPrompts, childTargeting, adPressure, subscriptionPressure, socialSpending
  R3 Social risk: socialObligation, competitiveToxicity, strangerRisk, socialComparison, identitySelfWorth, privacyRisk
  R4 Content: violenceLevel, sexualContent, language, substanceRef, fearHorror
  (3=core mechanic, 2=significant, 1=mild, 0=not present — be strict on 0s for risky items)

## CALIBRATION ANCHORS
Minecraft (vanilla): B1=38, B2=16, B3=6 | R1=4, R2=2, R3=4 → LumiScore 75, 120 min/day
Fortnite: B1=19, B2=10, B3=13 | R1=18, R2=13, R3=11 → LumiScore 42, 30 min/day
Brawl Stars: B1=14, B2=9, B3=11 | R1=23, R2=18, R3=12 → LumiScore 30, 15 min/day

## GAME BEING AUDITED

Title: ${game.title}
Developer: ${game.developer ?? 'Unknown'}
Description: ${game.description ?? 'Not available'}
Genres: ${(game.genres as string[])?.join(', ') || 'Unknown'}
Platforms: ${(game.platforms as string[])?.join(', ') || 'Unknown'}
ESRB: ${game.esrbRating ?? 'Not rated'} | Metacritic: ${game.metacriticScore ?? 'N/A'}
Base price: ${game.basePrice === 0 ? 'Free-to-play' : game.basePrice != null ? `$${game.basePrice}` : 'Unknown'}
Microtransactions: ${game.hasMicrotransactions ? 'Yes' : 'No'} | Loot boxes: ${game.hasLootBoxes ? 'Yes' : 'No'} | Battle pass: ${game.hasBattlePass ? 'Yes' : 'No'}
Stranger chat: ${game.hasStrangerChat ? `Yes (${game.chatModeration ?? 'unknown moderation'})` : 'No'}

## EXISTING SCORES TO DEBATE (current LumiScore: ${currentScore.curascore}, ${currentScore.timeRecommendationMinutes} min/day)

${b1}
${b2}
${b3}
${r1}
${r2}
${r3}

BDS=${currentScore.bds?.toFixed(3)}  RIS=${currentScore.ris?.toFixed(3)}

## YOUR TASK

Challenge these scores from a skeptical, safety-first perspective:
- Are any benefit scores inflated? (A mechanic that's "present" is not necessarily a 5 — reserve 5 for CORE mechanics that define the game)
- Are any risk scores too low? (Free-to-play games with IAP rarely score 0 on monetization items)
- Are social risk items correctly weighted for the actual online environment?
- Does the resulting time recommendation feel right for a 10-year-old?

Hold scores you agree with. Adjust any you find unjustified. Submit your final verdict.`
}

// ─── Call Gemini ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGemini(prompt: string, modelId = MODEL, attempt = 0): Promise<any> {
  let result
  try {
    result = await googleAI.models.generateContent({
      model:    modelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ functionDeclarations: [GEMINI_FUNCTION] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ['submit_game_review'],
          },
        },
        ...(modelId.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    })
  } catch (err: unknown) {
    const isTransient = String(err).includes('Unexpected end of JSON')
      || String(err).includes('fetch failed')
      || String(err).includes('ECONNRESET')
      || (err as { status?: number })?.status === 429
      || (err as { status?: number })?.status === 503
    if (isTransient && attempt < 3) {
      const delay = Math.pow(2, attempt) * 5_000
      console.log(`  [transient error — retry in ${delay / 1000}s]`)
      await new Promise(r => setTimeout(r, delay))
      return callGemini(prompt, modelId, attempt + 1)
    }
    if (modelId !== FALLBACK_MODEL) {
      console.log(`  [primary failed — falling back to ${FALLBACK_MODEL}]`)
      return callGemini(prompt, FALLBACK_MODEL, 0)
    }
    throw err
  }

  const candidate    = result.candidates?.[0]
  const finishReason = candidate?.finishReason
  const fc = candidate?.content?.parts?.find((p: { functionCall?: unknown }) => p.functionCall)?.functionCall
  if (!fc?.args) {
    const retryable = finishReason === 'MAX_TOKENS' || finishReason === 'OTHER' || finishReason == null
    if (retryable && attempt < 3) {
      const delay = Math.pow(2, attempt) * 5_000
      console.log(`  [no function call (${finishReason}) — retry ${attempt + 1}/3 in ${delay / 1000}s]`)
      await new Promise(r => setTimeout(r, delay))
      return callGemini(prompt, modelId, attempt + 1)
    }
    if (modelId !== FALLBACK_MODEL) {
      console.log(`  [no function call on primary — falling back]`)
      return callGemini(prompt, FALLBACK_MODEL, 0)
    }
    throw new Error(`Gemini returned no function call (finishReason=${finishReason})`)
  }

  return fc.args
}

// ─── Debate one game ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function debateGame(game: any, existingReview: any, currentScore: any): Promise<{
  agreed: boolean
  scoreDelta: number
  debatedCurascore: number
  debatedMinutes: number
}> {
  const prompt = buildDebatePrompt(game, existingReview, currentScore)
  const r = await callGemini(prompt)

  const computed = calculateGameScores({
    ...r.b1_cognitive, ...r.b2_social, ...r.b3_motor,
    ...r.r1_dopamine,  ...r.r2_monetization, ...r.r3_social, ...r.r4_content,
  })

  const delta     = computed.curascore - currentScore.curascore
  const agreed    = Math.abs(delta) < FLAG_THRESHOLD
  const direction = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${Math.abs(delta)}` : '='

  console.log(`  Debated → Curascore ${computed.curascore} (${direction}) | BDS=${computed.bds.toFixed(3)} RIS=${computed.ris.toFixed(3)} | ${computed.timeRecommendation.minutes} min/day`)

  if (!apply) return { agreed, scoreDelta: delta, debatedCurascore: computed.curascore, debatedMinutes: computed.timeRecommendation.minutes }

  // Write debated scores back to DB
  const reviewData = {
    ...r.b1_cognitive, ...r.b2_social, ...r.b3_motor,
    ...r.r1_dopamine,  ...r.r2_monetization, ...r.r3_social, ...r.r4_content,
    ...r.representation,
    propagandaLevel: r.propaganda.propagandaLevel,
    propagandaNotes: r.propaganda.propagandaNotes || null,
    bechdelResult:   r.bechdel.result,
    bechdelNotes:    r.bechdel.notes || null,
    estimatedMonthlyCostLow:   r.practical.estimatedMonthlyCostLow,
    estimatedMonthlyCostHigh:  r.practical.estimatedMonthlyCostHigh,
    minSessionMinutes:         r.practical.minSessionMinutes,
    hasNaturalStoppingPoints:  r.practical.hasNaturalStoppingPoints,
    penalizesBreaks:           r.practical.penalizesBreaks,
    stoppingPointsDescription: r.practical.stoppingPointsDescription,
    benefitsNarrative:         r.narratives.benefitsNarrative,
    risksNarrative:            r.narratives.risksNarrative,
    parentTip:                 r.narratives.parentTip,
    parentTipBenefits:         r.narratives.parentTipBenefits,
    updatedAt:                 new Date(),
  }

  await db.update(reviews).set(reviewData).where(eq(reviews.id, existingReview.id))

  const scoreData = {
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
    representationScore:         (r.representation.repGenderBalance + r.representation.repEthnicDiversity) / 6,
    propagandaLevel:             r.propaganda.propagandaLevel,
    bechdelResult:               r.bechdel.result,
    calculatedAt:                new Date(),
  }

  await db.update(gameScores).set(scoreData).where(eq(gameScores.id, currentScore.id))
  console.log(`  Applied to DB.`)

  return { agreed, scoreDelta: delta, debatedCurascore: computed.curascore, debatedMinutes: computed.timeRecommendation.minutes }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.GOOGLE_PROJECT_ID) {
    console.error('ERROR: GOOGLE_PROJECT_ID not set'); process.exit(1)
  }

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║           Debate Run — Top Games Audit           ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Model: ${MODEL}  |  Limit: ${targetSlug ? 1 : limit}  |  Mode: ${apply ? 'APPLY CHANGES' : 'DRY RUN'}`)
  if (!apply) console.log('  (pass --apply to write debated scores to DB)\n')

  // Fetch top N games by curascore with their existing review
  const rows = await db
    .select({
      game:   games,
      score:  gameScores,
      review: reviews,
    })
    .from(gameScores)
    .innerJoin(games,   eq(games.id,   gameScores.gameId))
    .innerJoin(reviews, eq(reviews.gameId, games.id))
    .where(
      targetSlug
        ? eq(games.slug, targetSlug)
        : isNotNull(gameScores.curascore)
    )
    .orderBy(desc(gameScores.curascore))
    .limit(targetSlug ? 1 : limit)

  if (rows.length === 0) {
    console.log('No scored games found.'); process.exit(0)
  }

  console.log(`  Running debate on ${rows.length} game(s)…\n`)

  const summary: { title: string; before: number; after: number; delta: number; minutes: number }[] = []
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const { game, score, review } = rows[i]
    const progress = `[${String(i + 1).padStart(3)}/${rows.length}]`
    console.log(`${progress} ${game.title} (current Curascore: ${score.curascore})`)

    try {
      const result = await debateGame(game, review, score)
      summary.push({
        title:   game.title,
        before:  score.curascore ?? 0,
        after:   result.debatedCurascore,
        delta:   result.scoreDelta,
        minutes: result.debatedMinutes,
      })
    } catch (err) {
      console.error(`  ERROR: ${err instanceof Error ? err.message : String(err)}`)
      errors.push(game.title)
    }

    // Brief pause between API calls
    if (i < rows.length - 1) await new Promise(r => setTimeout(r, 300))
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  const agreed    = summary.filter(s => Math.abs(s.delta) < FLAG_THRESHOLD)
  const flagged   = summary.filter(s => Math.abs(s.delta) >= FLAG_THRESHOLD).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const avgDelta  = summary.length ? summary.reduce((s, r) => s + r.delta, 0) / summary.length : 0
  const inflated  = flagged.filter(s => s.delta < 0)  // debate scored LOWER → original was too generous
  const deflated  = flagged.filter(s => s.delta > 0)  // debate scored HIGHER → original was too harsh

  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║                 Debate Summary                   ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Games debated   : ${summary.length}`)
  console.log(`  Agreed (Δ<${FLAG_THRESHOLD})  : ${agreed.length}`)
  console.log(`  Flagged (Δ≥${FLAG_THRESHOLD}) : ${flagged.length}`)
  console.log(`  Avg Curascore Δ : ${avgDelta > 0 ? '+' : ''}${avgDelta.toFixed(1)}`)
  console.log(`  Errors          : ${errors.length}`)

  if (inflated.length) {
    console.log(`\n  ⚠  Scores likely too GENEROUS (debate scored lower):`)
    inflated.forEach(s => console.log(`     ${s.title.padEnd(40)} ${s.before} → ${s.after}  (Δ${s.delta})`))
  }
  if (deflated.length) {
    console.log(`\n  ℹ  Scores likely too HARSH (debate scored higher):`)
    deflated.forEach(s => console.log(`     ${s.title.padEnd(40)} ${s.before} → ${s.after}  (+${s.delta})`))
  }
  if (errors.length) {
    console.log(`\n  Errors: ${errors.join(', ')}`)
  }
  if (!apply && flagged.length) {
    console.log(`\n  Re-run with --apply to write the debated scores to DB.`)
  }

  process.exit(errors.length > 0 ? 1 : 0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
