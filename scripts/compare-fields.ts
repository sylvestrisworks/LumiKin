/**
 * Field-level comparison: Gemini Flash 2.5 vs stored Sonnet 4.6 scores.
 * Shows which specific rubric items Gemini consistently rates higher/lower.
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/compare-fields.ts
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/compare-fields.ts --limit 10
 */

import { GoogleGenAI, FunctionCallingConfigMode, Type } from '@google/genai'
import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, gameScores, reviews } from '../src/lib/db/schema'

const args      = process.argv.slice(2)
const limitFlag = args.indexOf('--limit')
const limit     = limitFlag !== -1 ? parseInt(args[limitFlag + 1], 10) : 10
const MODEL     = 'gemini-2.5-flash'

if (!process.env.GOOGLE_PROJECT_ID) {
  console.error('ERROR: GOOGLE_PROJECT_ID is not set.'); process.exit(1)
}

const googleAI = new GoogleGenAI({
  vertexai: true,
  project:  process.env.GOOGLE_PROJECT_ID!,
  location: process.env.GOOGLE_LOCATION ?? 'us-central1',
})

// ─── Field definitions ────────────────────────────────────────────────────────

const B1_FIELDS = ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge']
const B2_FIELDS = ['teamwork','communication','empathy','emotionalRegulation','ethicalReasoning','positiveSocial']
const B3_FIELDS = ['handEyeCoord','fineMotor','reactionTime','physicalActivity']
const R1_FIELDS = ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq']
const R2_FIELDS = ['spendingCeiling','payToWin','currencyObfuscation','spendingPrompts','childTargeting','adPressure','subscriptionPressure','socialSpending']
const R3_FIELDS = ['socialObligation','competitiveToxicity','strangerRisk','socialComparison','identitySelfWorth','privacyRisk']
const R4_FIELDS = ['violenceLevel','sexualContent','language','substanceRef','fearHorror']

const ALL_FIELDS = [
  ...B1_FIELDS.map(f => ({ f, group: 'B1', max: 5 })),
  ...B2_FIELDS.map(f => ({ f, group: 'B2', max: 5 })),
  ...B3_FIELDS.map(f => ({ f, group: 'B3', max: 5 })),
  ...R1_FIELDS.map(f => ({ f, group: 'R1', max: 3 })),
  ...R2_FIELDS.map(f => ({ f, group: 'R2', max: 3 })),
  ...R3_FIELDS.map(f => ({ f, group: 'R3', max: 3 })),
  ...R4_FIELDS.map(f => ({ f, group: 'R4', max: 3 })),
]

// ─── Gemini schema ────────────────────────────────────────────────────────────

function scoreGroup(fields: string[], max: number, desc: string) {
  return {
    type: 'object' as const, description: desc, required: fields,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer' as const, minimum: 0, maximum: max }])),
    additionalProperties: false as const,
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

const INPUT_SCHEMA = {
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
        estimatedMonthlyCostLow:   { type: 'number', minimum: 0 },
        estimatedMonthlyCostHigh:  { type: 'number', minimum: 0 },
        minSessionMinutes:         { type: 'integer', minimum: 1 },
        hasNaturalStoppingPoints:  { type: 'boolean' },
        penalizesBreaks:           { type: 'boolean' },
        stoppingPointsDescription: { type: 'string' },
      },
    },
    narratives: {
      type: 'object',
      required: ['benefitsNarrative','risksNarrative','parentTip'],
      additionalProperties: false,
      properties: {
        benefitsNarrative: { type: 'string' },
        risksNarrative:    { type: 'string' },
        parentTip:         { type: 'string' },
      },
    },
  },
}

const GEMINI_FUNCTION = {
  name: 'submit_game_review',
  description: 'Submit a completed PlaySmart rubric review for a game.',
  parameters: toGeminiSchema(INPUT_SCHEMA),
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

type GameRow = typeof games.$inferSelect

function buildPrompt(g: GameRow): string {
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
Genres: ${(g.genres as string[])?.join(', ') || 'Unknown'}
Platforms: ${(g.platforms as string[])?.join(', ') || 'Unknown'}
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

// ─── Call Gemini ──────────────────────────────────────────────────────────────

type ReviewInput = {
  b1_cognitive: Record<string, number>; b2_social: Record<string, number>
  b3_motor: Record<string, number>; r1_dopamine: Record<string, number>
  r2_monetization: Record<string, number>; r3_social: Record<string, number>
  r4_content: Record<string, number>
  practical: Record<string, unknown>; narratives: Record<string, string>
}

async function callGemini(prompt: string): Promise<ReviewInput> {
  const result = await googleAI.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      tools: [{ functionDeclarations: [GEMINI_FUNCTION] }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ['submit_game_review'],
        },
      },
    },
  })
  const fc = result.candidates?.[0]?.content?.parts?.[0]?.functionCall
  if (!fc?.args) throw new Error('Gemini did not return a function call')
  return fc.args as ReviewInput
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nPlaySmart — Field-Level Provider Comparison`)
  console.log(`Gemini ${MODEL}  vs  Sonnet 4.6 (stored)\n`)

  const rows = await db
    .select({ game: games, score: gameScores, review: reviews })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .innerJoin(reviews,    eq(reviews.gameId,    games.id))
    .orderBy(games.title)
    .limit(limit)

  if (rows.length === 0) { console.log('No scored games found.'); process.exit(0) }

  console.log(`Sampling ${rows.length} games...\n`)

  // Accumulate per-field deltas across all games: field -> list of (gemini - sonnet)
  const fieldDeltas: Record<string, number[]> = {}
  for (const { f } of ALL_FIELDS) fieldDeltas[f] = []

  for (const { game, review } of rows) {
    process.stdout.write(`  ${game.title.slice(0, 50).padEnd(52)}`)
    try {
      const r = await callGemini(buildPrompt(game))
      const geminiFlat: Record<string, number> = {
        ...r.b1_cognitive, ...r.b2_social, ...r.b3_motor,
        ...r.r1_dopamine,  ...r.r2_monetization, ...r.r3_social, ...r.r4_content,
      }
      const sonnetFlat = review as unknown as Record<string, number | null>

      for (const { f } of ALL_FIELDS) {
        const sonnetVal = sonnetFlat[f]
        const geminiVal = geminiFlat[f]
        if (sonnetVal != null && geminiVal != null) {
          fieldDeltas[f].push(geminiVal - sonnetVal)
        }
      }
      console.log('ok')
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : err}`)
    }
  }

  // ─── Per-field summary ──────────────────────────────────────────────────────

  console.log(`\n${'═'.repeat(72)}`)
  console.log('Field-level average deltas (Gemini − Sonnet)\n')

  let prevGroup = ''
  for (const { f, group, max } of ALL_FIELDS) {
    const deltas = fieldDeltas[f]
    if (deltas.length === 0) continue
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length
    if (avg === 0) continue  // skip fields with no net difference

    if (group !== prevGroup) {
      console.log(`  ── ${group} (0–${max}) ──`)
      prevGroup = group
    }

    const bar  = avg > 0 ? '▲'.repeat(Math.min(Math.round(avg * 4), 8)) : '▼'.repeat(Math.min(Math.round(-avg * 4), 8))
    const sign = avg > 0 ? '+' : ''
    const flag = Math.abs(avg) >= 0.5 ? ' ◀ notable' : ''
    console.log(`    ${f.padEnd(28)} ${sign}${avg.toFixed(2)}  ${bar}${flag}`)
  }

  // ─── Group-level summary ────────────────────────────────────────────────────

  console.log(`\n${'─'.repeat(72)}`)
  console.log('Group totals (avg sum delta per game)\n')

  const groups = [
    { label: 'B1 Cognitive    (0–50)', fields: B1_FIELDS },
    { label: 'B2 Social-emo.  (0–30)', fields: B2_FIELDS },
    { label: 'B3 Motor        (0–20)', fields: B3_FIELDS },
    { label: 'R1 Dopamine     (0–30)', fields: R1_FIELDS },
    { label: 'R2 Monetization (0–24)', fields: R2_FIELDS },
    { label: 'R3 Social risk  (0–18)', fields: R3_FIELDS },
    { label: 'R4 Content      (0–15)', fields: R4_FIELDS },
  ]

  for (const { label, fields } of groups) {
    const avg = fields.reduce((sum, f) => {
      const d = fieldDeltas[f]
      return sum + (d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0)
    }, 0)
    const sign = avg > 0 ? '+' : ''
    const bar  = avg > 0 ? '▲'.repeat(Math.min(Math.round(avg), 10)) : '▼'.repeat(Math.min(Math.round(-avg), 10))
    console.log(`  ${label}   ${sign}${avg.toFixed(2)} pts  ${bar}`)
  }

  console.log(`\n${'═'.repeat(72)}`)
  console.log('Interpretation:')
  console.log('  ▲ = Gemini scores higher than Sonnet on this field/group')
  console.log('  ▼ = Gemini scores lower than Sonnet on this field/group')
  console.log('  ◀ notable = avg delta ≥ 0.5 per game (meaningful systematic difference)')
}

main().catch(e => { console.error(e); process.exit(1) })
