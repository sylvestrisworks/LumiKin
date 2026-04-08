/**
 * Review seed for Brawl Stars.
 *
 * Scores derived from rubric methodology v0.1:
 *   B1=14  B2=9  B3=11  |  R1=23  R2=18  R3=12  R4=1
 *   BDS=0.34  RIS=0.737  →  15 min/day
 *   Curascore ≈ 30
 *
 * Run with:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/review-brawl-stars.ts
 */

import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, reviews, gameScores } from '../src/lib/db/schema'
import { calculateGameScores } from '../src/lib/scoring/engine'

async function main() {
  // ── 1. Find the game ────────────────────────────────────────────────────────
  const [game] = await db.select({ id: games.id, title: games.title })
    .from(games).where(eq(games.slug, 'brawl-stars')).limit(1)

  if (!game) {
    console.error('Game "brawl-stars" not found. Run fetch-game.ts --slug brawl-stars first.')
    process.exit(1)
  }
  console.log(`Reviewing: ${game.title} (id:${game.id})`)

  // ── 2. Update game metadata fields that RAWG doesn't provide ────────────────
  await db.update(games).set({
    hasMicrotransactions: true,
    hasLootBoxes:         false,
    hasSubscription:      false,
    hasBattlePass:        true,
    requiresInternet:     'always',
    hasStrangerChat:      true,
    chatModeration:       'basic',
    basePrice:            0,
    updatedAt:            new Date(),
  }).where(eq(games.id, game.id))

  // ── 3. Upsert review ────────────────────────────────────────────────────────
  const reviewData = {
    gameId:      game.id,
    reviewTier:  'expert' as const,
    status:      'approved' as const,

    // ── B1: Cognitive (sum=14) ─────────────────────────────────────────────
    // Spatial combat positioning and team strategy are present but game is
    // mostly reaction-based with no creative, language, or learning-transfer value.
    problemSolving:    2,  // Some map-reading and ability sequencing
    spatialAwareness:  3,  // Arena positioning, reading sight lines
    strategicThinking: 3,  // Team comps, objective control, ability timing
    criticalThinking:  1,  // Minimal — mostly pattern recognition
    memoryAttention:   2,  // Track opponents, cooldowns, map hazards
    creativity:        0,  // No creative tools — purely competitive
    readingLanguage:   0,  // No narrative or language engagement
    mathSystems:       1,  // Very light: upgrade cost planning
    learningTransfer:  0,  // No real-world skill transfer
    adaptiveChallenge: 2,  // Matchmaking exists, but power-level gaps from upgrades undermine it

    // ── B2: Social-emotional (sum=9) ──────────────────────────────────────
    teamwork:            3,  // 3v3 modes require genuine coordination and role awareness
    communication:       2,  // In-game pings and quick-chat only — no voice
    empathy:             0,  // No perspective-taking mechanics
    emotionalRegulation: 2,  // Trophy loss on defeat teaches frustration tolerance — but punishment-heavy
    ethicalReasoning:    0,  // No moral choices
    positiveSocial:      2,  // Can play with friends; Club system; random matchmaking carries risk

    // ── B3: Motor (sum=11) ────────────────────────────────────────────────
    handEyeCoord:    4,  // Joystick + aim on touchscreen or controller — genuine precision
    fineMotor:       3,  // Mobile touchscreen precision; controller dexterity
    reactionTime:    4,  // Fast-paced arena combat; dodge timing; super activation
    physicalActivity: 0,  // Seated mobile game

    // ── R1: Dopamine manipulation (sum=23) ────────────────────────────────
    variableRewards:       3,  // Star drops calibrated for brawler/cosmetic unlock — core gacha loop
    streakMechanics:       2,  // Daily star tokens, Brawl Pass daily/weekly missions with visible progress
    lossAversion:          2,  // Trophy loss on every defeat; visible regression on trophy road
    fomoEvents:            3,  // Seasonal limited skins; Brawl Pass exclusive cosmetics disappear at season end
    stoppingBarriers:      2,  // 3-minute matches make "one more game" trivially easy — loop by design
    notifications:         2,  // Push notifications for events, club activity, limited offers
    nearMiss:              2,  // Trophy count always visible — reward tier constantly one match away
    infinitePlay:          2,  // No content endpoint; continuous seasonal loop with no natural finish
    escalatingCommitment:  2,  // Coin + power-point investment in brawlers creates significant sunk cost
    variableRewardFreq:    3,  // Star drop timing and coin rewards precisely calibrated — slot-machine pattern

    // ── R2: Monetization pressure (sum=18) ────────────────────────────────
    spendingCeiling:       3,  // No cap — gems, bundles, Brawl Pass, skins, limited offers
    payToWin:              2,  // Brawl Pass accelerates brawler unlock and power-point gain; upgraded brawlers have stat advantages in trophy pushing
    currencyObfuscation:   3,  // Gems → Brawl Pass; plus Coins, Star Points, Bling, Credits — four+ layers obfuscating real cost
    spendingPrompts:       3,  // Persistent shop, bundle "deals" on match end, limited-time offer countdowns
    childTargeting:        3,  // Cartoon brawlers, candy-colored purchase animations, colorful reward UIs — textbook child-targeted design
    adPressure:            0,  // No ads (premium free-to-play model)
    subscriptionPressure:  2,  // Brawl Pass+ seasonal subscription; previous free features locked behind pass
    socialSpending:        2,  // Skins visible in battle — social comparison pressure to keep up with peers

    // ── R3: Social risk (sum=12) ──────────────────────────────────────────
    socialObligation:    2,  // Brawl Pass timed challenges, Club events — regular play expected
    competitiveToxicity: 2,  // Trophy anxiety, season-end rank decay, visible loss streaks, some lobby toxicity
    strangerRisk:        2,  // Random matchmaking; Club chat with unknown adults; basic moderation only
    socialComparison:    2,  // Trophy counts, brawler ranks, and cosmetics visible — status hierarchy built in
    identitySelfWorth:   2,  // Trophy count and brawler rarity tied to perceived social status among peers
    privacyRisk:         2,  // Supercell collects extensive behavioral and session data; no clear child-data transparency

    // ── R4: Content (sum=1) ───────────────────────────────────────────────
    violenceLevel:  1,  // Cartoon "knockout" — no blood or realistic violence
    sexualContent:  0,
    language:       0,
    substanceRef:   0,
    fearHorror:     0,

    // ── Practical ─────────────────────────────────────────────────────────
    estimatedMonthlyCostLow:  0,
    estimatedMonthlyCostHigh: 30,
    minSessionMinutes:        5,
    hasNaturalStoppingPoints: true,
    penalizesBreaks:          true,
    stoppingPointsDescription:
      'Matches are 3–5 minutes with a clear end. However, Brawl Pass daily missions, ' +
      'limited-time events, and trophy road visibility create strong pressure to return. ' +
      'Missing active seasons means permanently lost cosmetics.',

    benefitsNarrative:
      'Brawl Stars offers genuine motor skill development — mobile joystick combat requires ' +
      'real precision aiming, fast reaction times, and spatial awareness. The 3v3 modes build ' +
      'teamwork instincts: positioning around teammates, timing supers, and controlling map ' +
      'objectives are all authentic cooperative skills. Matches are short and structured, which ' +
      'keeps individual sessions bounded if rules are enforced externally.',

    risksNarrative:
      'Supercell has engineered one of the most psychologically sophisticated monetization ' +
      'systems in mobile gaming. The four-layer currency structure (Gems, Coins, Star Points, ' +
      'Bling) systematically disconnects purchases from real-money cost. Seasonal Brawl Pass ' +
      'content disappears permanently — manufactured scarcity that is acutely felt by children. ' +
      'Brawler upgrades (power points + coins) create meaningful stat advantages, making ' +
      'spending feel necessary for competitive play. The cartoon art style and purchase animations ' +
      'are textbook child-targeting design. Star drop timing is calibrated to reinforce continued ' +
      'play through variable-ratio rewards — the same psychological mechanism as slot machines.',

    parentTip:
      'If you allow Brawl Stars, set a firm no-spending rule before your child starts — the ' +
      '"just this one skin" conversation is extremely hard to have once they are emotionally ' +
      'invested. Disable in-app purchases at the device level (iOS Screen Time / Android Family ' +
      'Link). The game is most fun played with known friends rather than random matchmaking. ' +
      'Limit to 1–2 matches per session; the short match format is designed to make one more ' +
      'feel costless.',

    approvedAt: new Date(),
  }

  // Check if review exists
  const [existing] = await db.select({ id: reviews.id })
    .from(reviews).where(eq(reviews.gameId, game.id)).limit(1)

  let reviewId: number
  if (existing) {
    await db.update(reviews).set({ ...reviewData, updatedAt: new Date() })
      .where(eq(reviews.id, existing.id))
    reviewId = existing.id
    console.log(`Updated existing review (id:${reviewId})`)
  } else {
    const [inserted] = await db.insert(reviews).values(reviewData).returning({ id: reviews.id })
    reviewId = inserted.id
    console.log(`Inserted new review (id:${reviewId})`)
  }

  // ── 4. Calculate and upsert scores ─────────────────────────────────────────
  const scoreInput = {
    // B1
    problemSolving: 2, spatialAwareness: 3, strategicThinking: 3, criticalThinking: 1,
    memoryAttention: 2, creativity: 0, readingLanguage: 0, mathSystems: 1,
    learningTransfer: 0, adaptiveChallenge: 2,
    // B2
    teamwork: 3, communication: 2, empathy: 0, emotionalRegulation: 2,
    ethicalReasoning: 0, positiveSocial: 2,
    // B3
    handEyeCoord: 4, fineMotor: 3, reactionTime: 4, physicalActivity: 0,
    // R1
    variableRewards: 3, streakMechanics: 2, lossAversion: 2, fomoEvents: 3,
    stoppingBarriers: 2, notifications: 2, nearMiss: 2, infinitePlay: 2,
    escalatingCommitment: 2, variableRewardFreq: 3,
    // R2
    spendingCeiling: 3, payToWin: 2, currencyObfuscation: 3, spendingPrompts: 3,
    childTargeting: 3, adPressure: 0, subscriptionPressure: 2, socialSpending: 2,
    // R3
    socialObligation: 2, competitiveToxicity: 2, strangerRisk: 2, socialComparison: 2,
    identitySelfWorth: 2, privacyRisk: 2,
    // R4 (display only — not in RIS)
    violenceLevel: 1, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
  }

  const computed = calculateGameScores(scoreInput)

  console.log(`\nComputed scores:`)
  console.log(`  BDS:       ${computed.bds.toFixed(3)}`)
  console.log(`  RIS:       ${computed.ris.toFixed(3)}`)
  console.log(`  Curascore: ${computed.curascore}`)
  console.log(`  Time rec:  ${computed.timeRecommendation.minutes} min/day (${computed.timeRecommendation.color})`)

  const [existingScore] = await db.select({ id: gameScores.id })
    .from(gameScores).where(eq(gameScores.gameId, game.id)).limit(1)

  const scoreData = {
    gameId:   game.id,
    reviewId: reviewId,
    cognitiveScore:        computed.cognitiveScore,
    socialEmotionalScore:  computed.socialEmotionalScore,
    motorScore:            computed.motorScore,
    bds:                   computed.bds,
    dopamineRisk:          computed.dopamineRisk,
    monetizationRisk:      computed.monetizationRisk,
    socialRisk:            computed.socialRisk,
    contentRisk:           computed.contentRisk,
    ris:                   computed.ris,
    curascore:             computed.curascore,
    timeRecommendationMinutes:   computed.timeRecommendation.minutes,
    timeRecommendationLabel:     computed.timeRecommendation.label,
    timeRecommendationReasoning: computed.timeRecommendation.reasoning,
    timeRecommendationColor:     computed.timeRecommendation.color,
    topBenefits:           computed.topBenefits,
    calculatedAt:          new Date(),
  }

  if (existingScore) {
    await db.update(gameScores).set(scoreData).where(eq(gameScores.id, existingScore.id))
    console.log(`Updated existing scores (id:${existingScore.id})`)
  } else {
    const [insertedScore] = await db.insert(gameScores).values(scoreData).returning({ id: gameScores.id })
    console.log(`Inserted new scores (id:${insertedScore.id})`)
  }

  console.log(`\nDone. Visit /game/brawl-stars`)
}

main().catch(e => { console.error(e); process.exit(1) })
