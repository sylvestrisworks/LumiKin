/**
 * Retry rescore for FIFA titles that failed the bundled-online rescore pass.
 * The bundledOnlineNote is already set on these games.
 */
import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, gameScores, reviews } from '../src/lib/db/schema'
import { calculateGameScores } from '../src/lib/scoring/engine'
import { callGeminiTool, GEMINI_FLASH } from '../src/lib/vertex-ai'
import { CURRENT_METHODOLOGY_VERSION } from '../src/lib/methodology'

const SLUGS = ['fifa-12', 'fifa-14', 'ea-sports-fifa-17', 'fifa-18', 'fifa-19']

const B1 = ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge']
const B2 = ['teamwork','communication','empathy','emotionalRegulation','ethicalReasoning','positiveSocial']
const B3 = ['handEyeCoord','fineMotor','reactionTime','physicalActivity']
const R1 = ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq']
const R2 = ['spendingCeiling','payToWin','currencyObfuscation','spendingPrompts','childTargeting','adPressure','subscriptionPressure','socialSpending']
const R3 = ['socialObligation','competitiveToxicity','strangerRisk','socialComparison','identitySelfWorth','privacyRisk']
const R4 = ['violenceLevel','sexualContent','language','substanceRef','fearHorror']
const REP = ['repGenderBalance','repEthnicDiversity']

function scoreGroup(fields: string[], max: number, desc: string) {
  return {
    type: 'object' as const, description: desc, required: fields,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer' as const, minimum: 0, maximum: max }])),
  }
}

const REVIEW_TOOL = {
  name: 'submit_game_review',
  description: 'Submit a completed LumiKin rubric review for a game.',
  input_schema: {
    type: 'object',
    required: ['b1_cognitive','b2_social','b3_motor','r1_dopamine','r2_monetization','r3_social','r4_content','r4_modifiers','representation','propaganda','bechdel','practical','narratives'],
    properties: {
      b1_cognitive: scoreGroup(B1, 5, 'B1 cognitive scores 0–5'),
      b2_social:    scoreGroup(B2, 5, 'B2 social-emotional scores 0–5'),
      b3_motor:     scoreGroup(B3, 5, 'B3 motor scores 0–5'),
      r1_dopamine:  scoreGroup(R1, 3, 'R1 dopamine manipulation 0–3'),
      r2_monetization: scoreGroup(R2, 3, 'R2 monetization pressure 0–3'),
      r3_social:    scoreGroup(R3, 3, 'R3 social/emotional risk 0–3'),
      r4_content:   scoreGroup(R4, 3, 'R4 content risk 0–3'),
      r4_modifiers: {
        type: 'object' as const,
        required: ['trivialized','defencelessTarget','mixedSexualViolent'],
        properties: {
          trivialized:        { type: 'boolean' as const },
          defencelessTarget:  { type: 'boolean' as const },
          mixedSexualViolent: { type: 'boolean' as const },
        },
      },
      representation: scoreGroup(REP, 3, 'Representation scores 0–3'),
      propaganda: {
        type: 'object', required: ['propagandaLevel','propagandaNotes'],
        properties: { propagandaLevel: { type: 'integer', minimum: 0, maximum: 3 }, propagandaNotes: { type: 'string' } },
      },
      bechdel: {
        type: 'object', required: ['result','notes'],
        properties: { result: { type: 'string', enum: ['pass','fail','na'] }, notes: { type: 'string' } },
      },
      practical: {
        type: 'object',
        required: ['estimatedMonthlyCostLow','estimatedMonthlyCostHigh','minSessionMinutes','hasNaturalStoppingPoints','penalizesBreaks','stoppingPointsDescription'],
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
        required: ['benefitsNarrative','risksNarrative','parentTip','parentTipBenefits'],
        properties: {
          benefitsNarrative: { type: 'string' },
          risksNarrative:    { type: 'string' },
          parentTip:         { type: 'string' },
          parentTipBenefits: { type: 'string' },
        },
      },
    },
  },
}

function buildPrompt(g: typeof games.$inferSelect): string {
  const price = g.basePrice === 0 ? 'Free-to-play'
    : g.basePrice != null ? `$${g.basePrice}` : 'Unknown'

  return [
    'You are a child development researcher scoring a video game using the LumiKin rubric.',
    '',
    '## SCORING RUBRIC SUMMARY',
    'Benefits (B1–B3) — scale 0–5 per item',
    'B1 Cognitive (max 50): problemSolving, spatialAwareness, strategicThinking, criticalThinking, memoryAttention, creativity, readingLanguage, mathSystems, learningTransfer, adaptiveChallenge',
    'B2 Social-emotional (max 30): teamwork, communication, empathy, emotionalRegulation, ethicalReasoning, positiveSocial',
    'B3 Motor (max 20): handEyeCoord, fineMotor, reactionTime, physicalActivity',
    '',
    'Risks (R1–R4) — scale 0–3 per item',
    'R1 Dopamine (max 30): variableRewards, streakMechanics, lossAversion, fomoEvents, stoppingBarriers, notifications, nearMiss, infinitePlay, escalatingCommitment, variableRewardFreq',
    'R2 Monetization (max 24): spendingCeiling, payToWin, currencyObfuscation, spendingPrompts, childTargeting, adPressure, subscriptionPressure, socialSpending',
    'R3 Social (max 18): socialObligation, competitiveToxicity, strangerRisk, socialComparison, identitySelfWorth, privacyRisk',
    'R4 Content (max 15): violenceLevel, sexualContent, language, substanceRef, fearHorror',
    '',
    '## CALIBRATION',
    'FIFA/EA FC Career Mode (baseline): B1~22, B2~14, B3~10 | R1~5, R2~0, R3~4 → curascore ~67, 90–120 min/day',
    '',
    '## GAME TO REVIEW',
    `Title: ${g.title}`,
    `Developer: ${g.developer ?? 'Unknown'}`,
    `Description: ${g.description ?? 'Not available'}`,
    `Genres: ${(g.genres as string[])?.join(', ') || 'Unknown'}`,
    `ESRB Rating: ${g.esrbRating ?? 'Not rated'}`,
    `Metacritic: ${g.metacriticScore ?? 'N/A'}`,
    `Base price: ${price}`,
    '',
    '⚠ BUNDLED ONLINE MODE — SCORE BASE GAME (CAREER MODE) ONLY:',
    'This title ships with Ultimate Team (FUT), a live-service card-collecting mode that uses real-money FIFA/FC Points and has aggressive FOMO mechanics. That mode is covered by a separate caution notice shown to parents.',
    'Score ONLY the Career Mode / Player Career offline experience. Set ALL R1/R2/R3 flags for FUT mechanics to 0:',
    '  - No pack openings, no FUT Points, no seasonal FOMO, no spending prompts',
    '  - Career Mode has no real-money purchases, no loot boxes, no live-service loops',
    'Narratives must describe Career Mode only.',
    '',
    'Call submit_game_review with your scores.',
  ].join('\n')
}

type ReviewInput = {
  b1_cognitive: Record<string, number>; b2_social: Record<string, number>
  b3_motor: Record<string, number>; r1_dopamine: Record<string, number>
  r2_monetization: Record<string, number>; r3_social: Record<string, number>
  r4_content: Record<string, number>
  r4_modifiers: { trivialized: boolean; defencelessTarget: boolean; mixedSexualViolent: boolean }
  representation: Record<string, number>
  propaganda: { propagandaLevel: number; propagandaNotes: string }
  bechdel: { result: 'pass' | 'fail' | 'na'; notes: string }
  practical: { estimatedMonthlyCostLow: number; estimatedMonthlyCostHigh: number; minSessionMinutes: number; hasNaturalStoppingPoints: boolean; penalizesBreaks: boolean; stoppingPointsDescription: string }
  narratives: { benefitsNarrative: string; risksNarrative: string; parentTip: string; parentTipBenefits: string }
}

async function saveReview(game: typeof games.$inferSelect, r: ReviewInput): Promise<number> {
  const computed = calculateGameScores({
    ...r.b1_cognitive, ...r.b2_social, ...r.b3_motor,
    ...r.r1_dopamine, ...r.r2_monetization, ...r.r3_social, ...r.r4_content,
    trivialized: r.r4_modifiers.trivialized,
    defencelessTarget: r.r4_modifiers.defencelessTarget,
    mixedSexualViolent: r.r4_modifiers.mixedSexualViolent,
  })

  const reviewData = {
    gameId: game.id, reviewTier: 'automated' as const, status: 'approved' as const,
    ...r.b1_cognitive, ...r.b2_social, ...r.b3_motor,
    ...r.r1_dopamine, ...r.r2_monetization, ...r.r3_social, ...r.r4_content,
    trivialized: r.r4_modifiers.trivialized,
    defencelessTarget: r.r4_modifiers.defencelessTarget,
    mixedSexualViolent: r.r4_modifiers.mixedSexualViolent,
    ...r.representation,
    propagandaLevel: r.propaganda.propagandaLevel,
    propagandaNotes: r.propaganda.propagandaNotes || null,
    bechdelResult: r.bechdel.result,
    bechdelNotes: r.bechdel.notes || null,
    estimatedMonthlyCostLow: r.practical.estimatedMonthlyCostLow,
    estimatedMonthlyCostHigh: r.practical.estimatedMonthlyCostHigh,
    minSessionMinutes: r.practical.minSessionMinutes,
    hasNaturalStoppingPoints: r.practical.hasNaturalStoppingPoints,
    penalizesBreaks: r.practical.penalizesBreaks,
    stoppingPointsDescription: r.practical.stoppingPointsDescription,
    benefitsNarrative: r.narratives.benefitsNarrative,
    risksNarrative: r.narratives.risksNarrative,
    parentTip: r.narratives.parentTip,
    parentTipBenefits: r.narratives.parentTipBenefits,
    approvedAt: new Date(),
    aiModel: GEMINI_FLASH,
    reviewedAt: new Date(),
  }

  const [existing] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.gameId, game.id)).limit(1)
  let reviewId: number
  if (existing) {
    await db.update(reviews).set({ ...reviewData, updatedAt: new Date() }).where(eq(reviews.id, existing.id))
    reviewId = existing.id
  } else {
    const [ins] = await db.insert(reviews).values(reviewData).returning({ id: reviews.id })
    reviewId = ins.id
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
    representationScore:         (r.representation.repGenderBalance + r.representation.repEthnicDiversity) / 6,
    propagandaLevel:             r.propaganda.propagandaLevel,
    bechdelResult:               r.bechdel.result,
    recommendedMinAge:           computed.recommendedMinAge > 0 ? computed.recommendedMinAge : null,
    ageFloorReason:              computed.recommendedMinAge > 0 ? computed.ageFloorReason : null,
    scoringMethod:               'full_rubric' as const,
    methodologyVersion:          CURRENT_METHODOLOGY_VERSION,
    calculatedAt:                new Date(),
  }

  const [existingScore] = await db.select({ id: gameScores.id }).from(gameScores).where(eq(gameScores.gameId, game.id)).limit(1)
  if (existingScore) {
    await db.update(gameScores).set(scoreData).where(eq(gameScores.id, existingScore.id))
  } else {
    await db.insert(gameScores).values(scoreData)
  }

  await db.update(games).set({ needsRescore: false }).where(eq(games.id, game.id))
  return computed.curascore
}

async function main() {
  console.log('\nRetrying FIFA base-game rescore for 5 titles...\n')

  const targets = await db.select().from(games).where(inArray(games.slug, SLUGS))
  for (const game of targets) {
    const [before] = await db.select({ cura: gameScores.curascore, ris: gameScores.ris })
      .from(gameScores).where(eq(gameScores.gameId, game.id)).limit(1)
    process.stdout.write(`  ${game.title.padEnd(35)} (was cura:${before?.cura ?? '?'} ris:${Number(before?.ris ?? 0).toFixed(2)}) → `)
    try {
      const result = await callGeminiTool<ReviewInput>(buildPrompt(game), REVIEW_TOOL)
      const cura = await saveReview(game, result)
      console.log(`cura:${cura}  ✓`)
    } catch (err) {
      console.error(`FAILED: ${(err as Error).message.slice(0, 80)}`)
    }
  }

  console.log('\nDone.\n')
  process.exit(0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
