/**
 * Set bundledOnlineNote and rescore sports games where the live-service mode
 * (FUT / MyTeam / MUT) has contaminated the base-game risk score.
 *
 * Each game is rescored to reflect Career Mode / MyCareer / Franchise Mode only.
 *
 * Usage:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/rescore-sports-bundled.ts
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env') })

import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, gameScores, reviews } from '../src/lib/db/schema'
import { calculateGameScores } from '../src/lib/scoring/engine'
import { callGeminiTool, GEMINI_FLASH } from '../src/lib/vertex-ai'
import { CURRENT_METHODOLOGY_VERSION } from '../src/lib/methodology'

// ─── Notes per franchise ──────────────────────────────────────────────────────

const FUT_NOTE =
  'Career Mode and Player Career are fully offline with no spending pressure — an excellent football management and player development experience. Ultimate Team (FUT) is a separate mode using FIFA/FC Points (real money) and card packs with heavy FOMO and seasonal spending pressure targeted at children. To keep the experience family-friendly, play Career Mode only and disable Ultimate Team purchases through EA\'s parental controls or your console\'s spending limits.'

const MUT_NOTE =
  'Franchise Mode is a team management simulation with no spending required — solid for learning football strategy and team building. Madden Ultimate Team (MUT) is a separate mode using Madden Points (real money) and card packs with aggressive FOMO seasonal content. Block MUT access or set spending limits through EA\'s parental controls to keep the experience family-friendly.'

const NBA2K_NOTE =
  'MyCareer (an offline basketball story campaign) and MyLeague/MyNBA (franchise management sims) deliver engaging gameplay with minimal spending pressure. MyTeam is a separate card-collecting mode that uses Virtual Currency (VC) with aggressive pack-opening mechanics and FOMO seasonal events. Block MyTeam access or restrict VC purchases through your console\'s parental controls to keep the experience family-friendly.'

// ─── Targets ──────────────────────────────────────────────────────────────────

const TARGETS: { slug: string; note: string; franchise: string }[] = [
  // EA Sports FC / FIFA — FUT live-service mode (FIFA 12 onwards, significant real-money pressure)
  { slug: 'ea-sports-fc-25',    note: FUT_NOTE,   franchise: 'EA FC / FIFA' },
  { slug: 'ea-sports-fc-24',    note: FUT_NOTE,   franchise: 'EA FC / FIFA' },
  { slug: 'fifa-22',            note: FUT_NOTE,   franchise: 'EA FC / FIFA' },
  { slug: 'fifa-22-xbox-one',   note: FUT_NOTE,   franchise: 'EA FC / FIFA' },
  { slug: 'fifa-19',            note: FUT_NOTE,   franchise: 'EA FC / FIFA' },
  { slug: 'fifa-18',            note: FUT_NOTE,   franchise: 'EA FC / FIFA' },
  { slug: 'ea-sports-fifa-17',  note: FUT_NOTE,   franchise: 'EA FC / FIFA' },
  { slug: 'ea-sports-fifa-16',  note: FUT_NOTE,   franchise: 'EA FC / FIFA' },
  { slug: 'fifa-15',            note: FUT_NOTE,   franchise: 'EA FC / FIFA' },
  { slug: 'fifa-14',            note: FUT_NOTE,   franchise: 'EA FC / FIFA' },
  { slug: 'fifa-13',            note: FUT_NOTE,   franchise: 'EA FC / FIFA' },
  { slug: 'fifa-12',            note: FUT_NOTE,   franchise: 'EA FC / FIFA' },
  // Madden NFL — MUT live-service mode
  { slug: 'madden-nfl-24',      note: MUT_NOTE,   franchise: 'Madden NFL' },
  { slug: 'madden-nfl-22',      note: MUT_NOTE,   franchise: 'Madden NFL' },
  { slug: 'madden-nfl-19',      note: MUT_NOTE,   franchise: 'Madden NFL' },
  { slug: 'madden-nfl-18',      note: MUT_NOTE,   franchise: 'Madden NFL' },
  { slug: 'madden-nfl-17',      note: MUT_NOTE,   franchise: 'Madden NFL' },
  { slug: 'madden-nfl-16',      note: MUT_NOTE,   franchise: 'Madden NFL' },
  { slug: 'madden-nfl-15',      note: MUT_NOTE,   franchise: 'Madden NFL' },
  { slug: 'madden-nfl-12',      note: MUT_NOTE,   franchise: 'Madden NFL' },
  // NBA 2K — MyTeam live-service mode (launched NBA 2K13, VC introduced same year)
  { slug: 'nba-2k24',           note: NBA2K_NOTE, franchise: 'NBA 2K' },
  { slug: 'nba-2k21',           note: NBA2K_NOTE, franchise: 'NBA 2K' },
  { slug: 'nba-2k20',           note: NBA2K_NOTE, franchise: 'NBA 2K' },
  { slug: 'nba-2k19-2',         note: NBA2K_NOTE, franchise: 'NBA 2K' },
  { slug: 'nba-2k17',           note: NBA2K_NOTE, franchise: 'NBA 2K' },
  { slug: 'nba-2k16',           note: NBA2K_NOTE, franchise: 'NBA 2K' },
  { slug: 'nba-2k15',           note: NBA2K_NOTE, franchise: 'NBA 2K' },
  { slug: 'nba-2k14',           note: NBA2K_NOTE, franchise: 'NBA 2K' },
  { slug: 'nba-2k13',           note: NBA2K_NOTE, franchise: 'NBA 2K' },
]

// ─── Review tool ──────────────────────────────────────────────────────────────

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
        type: 'object' as const, required: ['trivialized','defencelessTarget','mixedSexualViolent'],
        properties: {
          trivialized:        { type: 'boolean' as const },
          defencelessTarget:  { type: 'boolean' as const },
          mixedSexualViolent: { type: 'boolean' as const },
        },
      },
      representation: scoreGroup(REP, 3, 'REP representation 0–3'),
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

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(g: typeof games.$inferSelect, franchise: string): string {
  const price = g.basePrice === 0 ? 'Free-to-play'
    : g.basePrice != null ? `$${g.basePrice}` : 'Unknown'

  const franchiseCalibration: Record<string, string> = {
    'EA FC / FIFA': [
      'FIFA/EA FC Career Mode (baseline): B1~22, B2~14, B3~10 | R1~5, R2~0, R3~4 → curascore ~67, 90–120 min/day',
      'FIFA/EA FC Player Career (baseline): B1~18, B2~12, B3~12 | R1~4, R2~0, R3~2 → curascore ~68, 120 min/day',
    ].join('\n'),
    'Madden NFL': [
      'Madden Franchise Mode (baseline): B1~22, B2~12, B3~8 | R1~4, R2~0, R3~3 → curascore ~67, 90–120 min/day',
    ].join('\n'),
    'NBA 2K': [
      'NBA 2K MyCareer (baseline): B1~20, B2~16, B3~12 | R1~5, R2~0, R3~4 → curascore ~67, 90–120 min/day',
      'NBA 2K MyLeague/MyNBA (baseline): B1~24, B2~14, B3~6 | R1~3, R2~0, R3~2 → curascore ~70, 120 min/day',
    ].join('\n'),
  }

  return [
    'You are a child development researcher scoring a video game using the LumiKin rubric.',
    '',
    '## SCORING RUBRIC SUMMARY',
    'Benefits (B1–B3) — scale 0–5 per item',
    'B1 Cognitive (max 50): problemSolving, spatialAwareness, strategicThinking, criticalThinking, memoryAttention, creativity, readingLanguage, mathSystems, learningTransfer, adaptiveChallenge',
    'B2 Social-emotional (max 30): teamwork, communication, empathy, emotionalRegulation, ethicalReasoning, positiveSocial',
    'B3 Motor (max 20): handEyeCoord, fineMotor, reactionTime, physicalActivity',
    'Risks (R1–R4) — scale 0–3 per item',
    'R1 Dopamine (max 30): variableRewards, streakMechanics, lossAversion, fomoEvents, stoppingBarriers, notifications, nearMiss, infinitePlay, escalatingCommitment, variableRewardFreq',
    'R2 Monetization (max 24): spendingCeiling, payToWin, currencyObfuscation, spendingPrompts, childTargeting, adPressure, subscriptionPressure, socialSpending',
    'R3 Social (max 18): socialObligation, competitiveToxicity, strangerRisk, socialComparison, identitySelfWorth, privacyRisk',
    'R4 Content (max 15): violenceLevel, sexualContent, language, substanceRef, fearHorror',
    '',
    `## FRANCHISE CALIBRATION — ${franchise}`,
    franchiseCalibration[franchise] ?? '',
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
    '⚠ BUNDLED LIVE-SERVICE MODE — SCORE BASE GAME ONLY:',
    `This ${franchise} title bundles a live-service mode (Ultimate Team / MyTeam / MUT) that uses real-money currency and card packs. That mode is covered by a dedicated caution notice shown to parents.`,
    'Score ONLY the offline Career Mode / MyCareer / Franchise Mode experience:',
    '  - R2 (monetization): set all fields to 0 — Career Mode has no spending mechanics',
    '  - R1 (dopamine): score only the offline match/season loop, not card-pack or pack-opening loops',
    '  - R3 (social): score offline play; set strangerRisk/socialObligation to 0 unless the base game forces online',
    'Narratives must describe Career Mode / MyCareer as the primary experience.',
    '',
    'Call submit_game_review with your scores.',
  ].join('\n')
}

// ─── Save ─────────────────────────────────────────────────────────────────────

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
    estimatedMonthlyCostLow:  r.practical.estimatedMonthlyCostLow,
    estimatedMonthlyCostHigh: r.practical.estimatedMonthlyCostHigh,
    minSessionMinutes:        r.practical.minSessionMinutes,
    hasNaturalStoppingPoints: r.practical.hasNaturalStoppingPoints,
    penalizesBreaks:          r.practical.penalizesBreaks,
    stoppingPointsDescription: r.practical.stoppingPointsDescription,
    benefitsNarrative:  r.narratives.benefitsNarrative,
    risksNarrative:     r.narratives.risksNarrative,
    parentTip:          r.narratives.parentTip,
    parentTipBenefits:  r.narratives.parentTipBenefits,
    approvedAt: new Date(), aiModel: GEMINI_FLASH, reviewedAt: new Date(),
  }

  const [existing] = await db.select({ id: reviews.id })
    .from(reviews).where(eq(reviews.gameId, game.id)).limit(1)

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

  const [existingScore] = await db.select({ id: gameScores.id })
    .from(gameScores).where(eq(gameScores.gameId, game.id)).limit(1)

  if (existingScore) {
    await db.update(gameScores).set(scoreData).where(eq(gameScores.id, existingScore.id))
  } else {
    await db.insert(gameScores).values(scoreData)
  }

  await db.update(games).set({ needsRescore: false }).where(eq(games.id, game.id))

  return computed.curascore
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║  Sports bundled-online rescore (base game only)     ║')
  console.log(`║  ${TARGETS.length} titles: EA FC/FIFA, Madden, NBA 2K              ║`)
  console.log('╚══════════════════════════════════════════════════════╝\n')

  const slugs = TARGETS.map(t => t.slug)
  const rows = await db.select().from(games).where(inArray(games.slug, slugs))

  // Index by slug for note lookup
  const noteMap = Object.fromEntries(TARGETS.map(t => [t.slug, t]))
  const found = rows.filter(g => noteMap[g.slug])
  const missing = slugs.filter(s => !rows.find(g => g.slug === s))

  if (missing.length > 0) {
    console.log(`⚠  Slugs not found in DB: ${missing.join(', ')}\n`)
  }

  // Step 1: set bundledOnlineNote on all targets
  console.log('Setting bundledOnlineNote...')
  for (const game of found) {
    const { note } = noteMap[game.slug]
    await db.update(games).set({ bundledOnlineNote: note }).where(eq(games.id, game.id))
    console.log(`  ✓ ${game.title}`)
  }

  // Step 2: rescore each
  console.log('\nRescoring...\n')
  const results: { title: string; before: number | null; after: number }[] = []

  for (const game of found) {
    // Fetch current curascore for before/after comparison
    const [current] = await db.select({ curascore: gameScores.curascore })
      .from(gameScores).where(eq(gameScores.gameId, game.id)).limit(1)
    const before = current?.curascore ?? null

    process.stdout.write(`  ${game.title.slice(0, 44).padEnd(44)} `)
    try {
      const { franchise } = noteMap[game.slug]
      const prompt = buildPrompt(game, franchise)
      const result = await callGeminiTool<ReviewInput>(prompt, REVIEW_TOOL)
      const after = await saveReview(game, result)
      const delta = before != null ? ` (${before} → ${after}, Δ${after - before > 0 ? '+' : ''}${after - before})` : ` (new: ${after})`
      console.log(`curascore ${after}${delta}  ✓`)
      results.push({ title: game.title, before, after })
    } catch (err) {
      console.error(`FAILED: ${(err as Error).message.slice(0, 80)}`)
    }
  }

  console.log('\n── Summary ──────────────────────────────────────\n')
  for (const r of results) {
    const delta = r.before != null ? r.after - r.before : 0
    const arrow = r.before != null ? `${r.before} → ${r.after}` : `new: ${r.after}`
    const flag  = Math.abs(delta) >= 10 ? ' ◀' : ''
    console.log(`  ${r.title.slice(0, 40).padEnd(40)}  ${arrow}${flag}`)
  }
  console.log()

  process.exit(0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
