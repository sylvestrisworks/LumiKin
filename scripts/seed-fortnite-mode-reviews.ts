/**
 * Seed expert reviews for the three standalone Fortnite game modes.
 * Game rows already exist (created by seed-fortnite-modes.ts).
 * This script adds reviews + computes scores for each.
 *
 * Run with:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/seed-fortnite-mode-reviews.ts
 */

import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, reviews, gameScores } from '../src/lib/db/schema'
import { calculateGameScores } from '../src/lib/scoring/engine'
import type { ReviewInput } from '../src/lib/scoring/types'

type ReviewSeed = ReviewInput & {
  estimatedMonthlyCostLow?:   number | null
  estimatedMonthlyCostHigh?:  number | null
  minSessionMinutes?:         number | null
  hasNaturalStoppingPoints?:  boolean
  penalizesBreaks?:           boolean
  stoppingPointsDescription?: string
  benefitsNarrative?:         string
  risksNarrative?:            string
  parentTip?:                 string
  parentTipBenefits?:         string
}

type GameReviewSeed = { slug: string; review: ReviewSeed }

const SEEDS: GameReviewSeed[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGO FORTNITE
  //   Family survival-crafting. Think Minecraft-lite with Fortnite cosmetics.
  //   E10+, coop with friends/family, no combat death (players respawn).
  //   Shares Epic's monetisation infrastructure but no battle pass pressure.
  //
  //   B1=27  B2=12  B3=4  |  R1=6  R2=5  R3=3
  //   BDS≈0.43  RIS≈0.19  →  90 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'lego-fortnite',
    review: {
      esrbRating: 'E10+',
      // B1 Cognitive (sum=27)
      problemSolving: 3, spatialAwareness: 4, strategicThinking: 3, criticalThinking: 2,
      memoryAttention: 2, creativity: 4, readingLanguage: 1, mathSystems: 2,
      learningTransfer: 3, adaptiveChallenge: 3,
      // B2 Social-emotional (sum=12) — cooperative survival with friends is genuinely social
      teamwork: 3, communication: 2, empathy: 1, emotionalRegulation: 3,
      ethicalReasoning: 0, positiveSocial: 3,
      // B3 Motor (sum=4)
      handEyeCoord: 2, fineMotor: 1, reactionTime: 1, physicalActivity: 0,
      // R1 Dopamine (sum=6) — gentle loop, no FOMO, no harsh loss mechanics
      variableRewards: 1, streakMechanics: 0, lossAversion: 0, fomoEvents: 1,
      stoppingBarriers: 1, notifications: 0, nearMiss: 0, infinitePlay: 2,
      escalatingCommitment: 1, variableRewardFreq: 0,
      // R2 Monetisation (sum=5) — shares Epic ecosystem; cosmetics visible but no BP pressure
      spendingCeiling: 1, payToWin: 0, currencyObfuscation: 1, spendingPrompts: 1,
      childTargeting: 1, adPressure: 0, subscriptionPressure: 0, socialSpending: 1,
      // R3 Social (sum=3) — proximity voice chat on by default; friend-only play is safe
      socialObligation: 0, competitiveToxicity: 1, strangerRisk: 1, socialComparison: 0,
      identitySelfWorth: 0, privacyRisk: 1,
      // R4 Content
      violenceLevel: 0, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 10,
      minSessionMinutes: 20, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Days, nights, and crafting cycles provide natural stopping moments. No progress is lost from logging out mid-session. Unlike Animal Crossing, nothing time-locks or decays during absence.',
      benefitsNarrative: 'LEGO Fortnite is the most family-friendly thing in the Fortnite ecosystem by a significant margin. The survival-crafting loop — gather, build, explore, craft — mirrors Minecraft\'s developmental strengths: spatial reasoning, resource planning, and creative construction. Cooperative play with friends or family develops genuine communication and shared problem-solving. Children who play together tend to build actual structures, negotiate roles, and collectively solve problems — the LEGO setting reinforces this constructive framing.',
      risksNarrative: 'The game shares Epic\'s cosmetic infrastructure, meaning children will see outfits and items they might want to purchase. Proximity voice chat is on by default across the Fortnite platform, so random strangers may be audible. There is no battle pass pressure specific to LEGO Fortnite, but seasonal Epic content may create some cosmetic FOMO. Survival enemies exist but are minimal, non-violent, and respawn has no penalty.',
      parentTip: 'Play with your child in a private world — it removes stranger contact entirely and makes this genuinely excellent shared family time. Set cosmetic spending expectations before they see the item shop: "we play, we don\'t buy" is a sustainable rule that removes the daily ask.',
      parentTipBenefits: 'This is one of the best entry points for getting a young child into creative, constructive play in a game environment. Start them in a private world with you and let them lead the building — you will be surprised what they design.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FORTNITE FESTIVAL
  //   Rhythm game by Harmonix inside Fortnite. Guitar Hero-style note tracks
  //   across guitar, bass, drums, vocals. Multiplayer jam sessions.
  //   Rated T — shares Fortnite's cosmetics, individual song purchases.
  //
  //   B1=17  B2=8  B3=9  |  R1=10  R2=7  R3=2
  //   BDS≈0.34  RIS≈0.26  →  90 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'fortnite-festival',
    review: {
      esrbRating: 'T',
      // B1 Cognitive (sum=17) — rhythm and timing are genuine cognitive skills
      problemSolving: 1, spatialAwareness: 1, strategicThinking: 1, criticalThinking: 1,
      memoryAttention: 3, creativity: 1, readingLanguage: 1, mathSystems: 2,
      learningTransfer: 2, adaptiveChallenge: 4,
      // B2 Social-emotional (sum=8)
      teamwork: 2, communication: 1, empathy: 1, emotionalRegulation: 2,
      ethicalReasoning: 0, positiveSocial: 2,
      // B3 Motor (sum=9) — rhythm games develop genuine timing and fine motor precision
      handEyeCoord: 3, fineMotor: 3, reactionTime: 3, physicalActivity: 0,
      // R1 Dopamine (sum=10) — seasonal tracks, star ratings, leaderboards
      variableRewards: 1, streakMechanics: 1, lossAversion: 1, fomoEvents: 2,
      stoppingBarriers: 1, notifications: 0, nearMiss: 1, infinitePlay: 1,
      escalatingCommitment: 1, variableRewardFreq: 1,
      // R2 Monetisation (sum=7) — individual song purchases add up; Jam Track catalogue grows via IAP
      spendingCeiling: 2, payToWin: 0, currencyObfuscation: 1, spendingPrompts: 2,
      childTargeting: 1, adPressure: 0, subscriptionPressure: 0, socialSpending: 1,
      // R3 Social (sum=2) — no voice chat in Festival specifically
      socialObligation: 0, competitiveToxicity: 1, strangerRisk: 0, socialComparison: 1,
      identitySelfWorth: 0, privacyRisk: 0,
      // R4 Content — T-rated music includes some mature themes in lyrics
      violenceLevel: 0, sexualContent: 0, language: 1, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 20,
      minSessionMinutes: 5, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Each song is 3–5 minutes with a clear endpoint. No energy system or time pressure. Easy to agree on "three songs then stop."',
      benefitsNarrative: 'Fortnite Festival is a genuine rhythm game developed by Harmonix — the studio behind Guitar Hero and Rock Band. Rhythm gaming has documented benefits: it develops timing, pattern recognition, fine motor coordination, and musical literacy. The adaptive difficulty (Easy through Expert per instrument) provides a real skill progression that keeps players in a flow state. Multiplayer Jam Sessions allow genuine cooperative music-making. Many children use Festival as their first introduction to instrument-style gaming, which can spark lasting interest in real music.',
      risksNarrative: 'Individual Jam Track purchases ($3–5 per song) are the main financial risk — a large library of desired songs can accumulate significant cost. Tracks rotate seasonally, creating mild FOMO for popular songs. The music catalogue includes T-rated content by pop artists; parents of younger children should check individual song themes. Leaderboard scoring encourages social comparison on star ratings.',
      parentTip: 'Set a clear monthly budget for Jam Tracks before they see the shop, or play exclusively with the free base tracks. Expert mode is genuinely challenging — playing together across difficulty levels is a great family activity where adults and children can participate simultaneously without one dominating.',
      parentTipBenefits: 'If your child shows sustained interest, this is a low-cost gateway to real instrument learning — many Festival players have gone on to pick up guitar or drums. Use that interest.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ROCKET RACING
  //   Arcade racing by Psyonix inside Fortnite. Boost mechanics, aerial
  //   maneuvers, ranked competitive play. E-rated but shares Fortnite cosmetics.
  //
  //   B1=15  B2=5  B3=10  |  R1=10  R2=4  R3=5
  //   BDS≈0.30  RIS≈0.27  →  90 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'fortnite-rocket-racing',
    review: {
      esrbRating: 'E',
      // B1 Cognitive (sum=15)
      problemSolving: 1, spatialAwareness: 4, strategicThinking: 2, criticalThinking: 1,
      memoryAttention: 2, creativity: 0, readingLanguage: 0, mathSystems: 1,
      learningTransfer: 1, adaptiveChallenge: 3,
      // B2 Social-emotional (sum=5) — racing is largely individual; some team modes
      teamwork: 1, communication: 1, empathy: 0, emotionalRegulation: 2,
      ethicalReasoning: 0, positiveSocial: 1,
      // B3 Motor (sum=10) — boost timing, airtime control, spatial awareness under speed
      handEyeCoord: 4, fineMotor: 2, reactionTime: 4, physicalActivity: 0,
      // R1 Dopamine (sum=10) — ranked ladder, seasonal cosmetics, replay-driven structure
      variableRewards: 1, streakMechanics: 1, lossAversion: 1, fomoEvents: 2,
      stoppingBarriers: 1, notifications: 0, nearMiss: 1, infinitePlay: 1,
      escalatingCommitment: 1, variableRewardFreq: 1,
      // R2 Monetisation (sum=4) — cosmetics only; no pay-to-win in race mechanics
      spendingCeiling: 1, payToWin: 0, currencyObfuscation: 1, spendingPrompts: 1,
      childTargeting: 0, adPressure: 0, subscriptionPressure: 0, socialSpending: 1,
      // R3 Social (sum=5) — ranked play with strangers; no voice chat but competitive toxicity
      socialObligation: 0, competitiveToxicity: 2, strangerRisk: 1, socialComparison: 1,
      identitySelfWorth: 1, privacyRisk: 0,
      // R4 Content — clean
      violenceLevel: 0, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 10,
      minSessionMinutes: 3, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Each race is 2–4 minutes. Ranked sessions have natural endpoints between queues. No energy system or time-lock mechanics.',
      benefitsNarrative: 'Rocket Racing is built by Psyonix — the Rocket League studio — and shares that game\'s demanding spatial awareness requirements. Boost management, aerial navigation, and track-memorisation are real motor and cognitive skills. The short race format (2–4 minutes) makes it one of the most session-controllable competitive games available. Ranked progression from Bronze to Diamond gives children a clear skill ladder and teaches them that improvement comes from practice, not purchasing.',
      risksNarrative: 'Competitive ranked play with strangers can produce frustration when losing streaks occur. Rocket Racing lives inside the Fortnite ecosystem, so Epic\'s cosmetic shop and seasonal content are visible even within this mode. The ranked system creates social comparison pressure. Unlike Rocket League proper, there is no dedicated custom lobby system, limiting the ability to play exclusively with known players.',
      parentTip: 'The 2–4 minute race format makes "five races then stop" a reliable and easy household rule. Cosmetics are purely visual — no race performance benefit — so a firm "we don\'t buy skins" policy works cleanly here.',
      parentTipBenefits: 'If your child enjoys this and wants more depth, Rocket League (by the same developer) is a standalone product with a larger competitive community, custom lobbies, and a cleaner monetisation model. Rocket Racing is an excellent gateway to that.',
    },
  },

]

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertReview(gameId: number, r: ReviewSeed): Promise<number> {
  const reviewData = {
    gameId,
    reviewTier: 'expert' as const,
    status:     'approved',
    problemSolving:       r.problemSolving       ?? null,
    spatialAwareness:     r.spatialAwareness     ?? null,
    strategicThinking:    r.strategicThinking    ?? null,
    criticalThinking:     r.criticalThinking     ?? null,
    memoryAttention:      r.memoryAttention      ?? null,
    creativity:           r.creativity           ?? null,
    readingLanguage:      r.readingLanguage      ?? null,
    mathSystems:          r.mathSystems          ?? null,
    learningTransfer:     r.learningTransfer     ?? null,
    adaptiveChallenge:    r.adaptiveChallenge    ?? null,
    teamwork:             r.teamwork             ?? null,
    communication:        r.communication        ?? null,
    empathy:              r.empathy              ?? null,
    emotionalRegulation:  r.emotionalRegulation  ?? null,
    ethicalReasoning:     r.ethicalReasoning     ?? null,
    positiveSocial:       r.positiveSocial       ?? null,
    handEyeCoord:         r.handEyeCoord         ?? null,
    fineMotor:            r.fineMotor            ?? null,
    reactionTime:         r.reactionTime         ?? null,
    physicalActivity:     r.physicalActivity     ?? null,
    variableRewards:      r.variableRewards      ?? null,
    streakMechanics:      r.streakMechanics      ?? null,
    lossAversion:         r.lossAversion         ?? null,
    fomoEvents:           r.fomoEvents           ?? null,
    stoppingBarriers:     r.stoppingBarriers     ?? null,
    notifications:        r.notifications        ?? null,
    nearMiss:             r.nearMiss             ?? null,
    infinitePlay:         r.infinitePlay         ?? null,
    escalatingCommitment: r.escalatingCommitment ?? null,
    variableRewardFreq:   r.variableRewardFreq   ?? null,
    spendingCeiling:      r.spendingCeiling      ?? null,
    payToWin:             r.payToWin             ?? null,
    currencyObfuscation:  r.currencyObfuscation  ?? null,
    spendingPrompts:      r.spendingPrompts      ?? null,
    childTargeting:       r.childTargeting       ?? null,
    adPressure:           r.adPressure           ?? null,
    subscriptionPressure: r.subscriptionPressure ?? null,
    socialSpending:       r.socialSpending       ?? null,
    socialObligation:     r.socialObligation     ?? null,
    competitiveToxicity:  r.competitiveToxicity  ?? null,
    strangerRisk:         r.strangerRisk         ?? null,
    socialComparison:     r.socialComparison     ?? null,
    identitySelfWorth:    r.identitySelfWorth    ?? null,
    privacyRisk:          r.privacyRisk          ?? null,
    violenceLevel:        r.violenceLevel        ?? null,
    sexualContent:        r.sexualContent        ?? null,
    language:             r.language             ?? null,
    substanceRef:         r.substanceRef         ?? null,
    fearHorror:           r.fearHorror           ?? null,
    estimatedMonthlyCostLow:   r.estimatedMonthlyCostLow  ?? null,
    estimatedMonthlyCostHigh:  r.estimatedMonthlyCostHigh ?? null,
    minSessionMinutes:         r.minSessionMinutes        ?? null,
    hasNaturalStoppingPoints:  r.hasNaturalStoppingPoints ?? null,
    penalizesBreaks:           r.penalizesBreaks          ?? null,
    stoppingPointsDescription: r.stoppingPointsDescription ?? null,
    benefitsNarrative:   r.benefitsNarrative   ?? null,
    risksNarrative:      r.risksNarrative      ?? null,
    parentTip:           r.parentTip           ?? null,
    parentTipBenefits:   r.parentTipBenefits   ?? null,
    approvedAt:          new Date(),
    updatedAt:           new Date(),
  }

  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.gameId, gameId))
    .limit(1)

  if (existing) {
    await db.update(reviews).set(reviewData).where(eq(reviews.id, existing.id))
    return existing.id
  }

  const [inserted] = await db.insert(reviews).values(reviewData).returning({ id: reviews.id })
  return inserted.id
}

async function upsertGameScores(gameId: number, reviewId: number, r: ReviewInput) {
  const computed = calculateGameScores(r)
  const scoreData = {
    gameId,
    reviewId,
    cognitiveScore:              computed.cognitiveScore,
    socialEmotionalScore:        computed.socialEmotionalScore,
    motorScore:                  computed.motorScore,
    bds:                         computed.bds,
    dopamineRisk:                computed.dopamineRisk,
    monetizationRisk:            computed.monetizationRisk,
    socialRisk:                  computed.socialRisk,
    contentRisk:                 computed.contentRisk,
    ris:                         computed.ris,
    timeRecommendationMinutes:   computed.timeRecommendation.minutes,
    timeRecommendationLabel:     computed.timeRecommendation.label,
    timeRecommendationReasoning: computed.timeRecommendation.reasoning,
    timeRecommendationColor:     computed.timeRecommendation.color,
    topBenefits:                 computed.topBenefits,
    calculatedAt:                new Date(),
  }

  const [existing] = await db
    .select({ id: gameScores.id })
    .from(gameScores)
    .where(eq(gameScores.gameId, gameId))
    .limit(1)

  if (existing) {
    await db.update(gameScores).set(scoreData).where(eq(gameScores.id, existing.id))
  } else {
    await db.insert(gameScores).values(scoreData)
  }

  return computed
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('LumiKin seed-fortnite-mode-reviews\n')

  for (const seed of SEEDS) {
    process.stdout.write(`  ${seed.slug.padEnd(30)} `)

    const [game] = await db
      .select({ id: games.id, title: games.title })
      .from(games)
      .where(eq(games.slug, seed.slug))
      .limit(1)

    if (!game) {
      console.log(`SKIPPED — game row not found (run seed-fortnite-modes.ts first)`)
      continue
    }

    const reviewId = await upsertReview(game.id, seed.review)
    const computed = await upsertGameScores(game.id, reviewId, seed.review)

    const bds  = Math.round(computed.bds * 100)
    const ris  = Math.round(computed.ris * 100)
    const mins = computed.timeRecommendation.minutes
    const col  = computed.timeRecommendation.color

    console.log(`BDS ${String(bds).padStart(3)}  RIS ${String(ris).padStart(3)}  ${String(mins).padStart(3)} min  [${col}]`)
  }

  console.log('\n✓ Done')
  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ Seed failed:', err)
  process.exit(1)
})
