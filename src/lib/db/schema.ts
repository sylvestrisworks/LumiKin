// Core tables for the PlaySmart game rating engine

import {
  pgTable, text, integer, real, timestamp, boolean,
  varchar, jsonb, serial, uniqueIndex, index
} from 'drizzle-orm/pg-core';

// ============================================
// GAME METADATA (from RAWG/IGDB + our enrichment)
// ============================================

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),

  // External IDs for cross-referencing
  rawgId: integer('rawg_id').unique(),
  igdbId: integer('igdb_id').unique(),

  // Basic metadata
  developer: varchar('developer', { length: 255 }),
  publisher: varchar('publisher', { length: 255 }),
  releaseDate: timestamp('release_date'),
  genres: jsonb('genres').$type<string[]>().default([]),
  platforms: jsonb('platforms').$type<string[]>().default([]),
  esrbRating: varchar('esrb_rating', { length: 10 }),  // E, E10, T, M, AO
  pegiRating: integer('pegi_rating'),                   // 3, 7, 12, 16, 18

  // From RAWG/Steam
  metacriticScore: integer('metacritic_score'),
  avgPlaytimeHours: real('avg_playtime_hours'),
  backgroundImage: text('background_image'),

  // Our enrichment
  basePrice: real('base_price'),                // in USD
  basePriceCurrency: varchar('base_price_currency', { length: 3 }).default('USD'),
  hasMicrotransactions: boolean('has_microtransactions').default(false),
  hasLootBoxes: boolean('has_loot_boxes').default(false),
  hasSubscription: boolean('has_subscription').default(false),
  hasBattlePass: boolean('has_battle_pass').default(false),
  requiresInternet: varchar('requires_internet', { length: 20 }), // always, sometimes, never
  hasStrangerChat: boolean('has_stranger_chat').default(false),
  chatModeration: varchar('chat_moderation', { length: 50 }),     // none, basic, strong

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  metadataLastSynced: timestamp('metadata_last_synced'),
}, (table) => ({
  slugIdx: uniqueIndex('slug_idx').on(table.slug),
  titleIdx: index('title_idx').on(table.title),
}));


// ============================================
// REVIEWS (our original assessments)
// ============================================

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull().references(() => games.id),
  reviewerId: integer('reviewer_id').references(() => reviewers.id),
  reviewTier: varchar('review_tier', { length: 20 }).notNull(), // 'automated', 'community', 'expert'
  status: varchar('status', { length: 20 }).default('draft'),   // draft, submitted, approved, rejected

  // ---- BENEFIT SCORES (0-5 each) ----
  // B1: Cognitive
  problemSolving: integer('problem_solving'),         // B1.1
  spatialAwareness: integer('spatial_awareness'),     // B1.2
  strategicThinking: integer('strategic_thinking'),   // B1.3
  criticalThinking: integer('critical_thinking'),     // B1.4
  memoryAttention: integer('memory_attention'),       // B1.5
  creativity: integer('creativity'),                  // B1.6
  readingLanguage: integer('reading_language'),       // B1.7
  mathSystems: integer('math_systems'),               // B1.8
  learningTransfer: integer('learning_transfer'),     // B1.9
  adaptiveChallenge: integer('adaptive_challenge'),   // B1.10

  // B2: Social-emotional
  teamwork: integer('teamwork'),                      // B2.1
  communication: integer('communication'),            // B2.2
  empathy: integer('empathy'),                        // B2.3
  emotionalRegulation: integer('emotional_regulation'), // B2.4
  ethicalReasoning: integer('ethical_reasoning'),      // B2.5
  positiveSocial: integer('positive_social'),          // B2.6

  // B3: Motor
  handEyeCoord: integer('hand_eye_coord'),            // B3.1
  fineMotor: integer('fine_motor'),                   // B3.2
  reactionTime: integer('reaction_time'),             // B3.3
  physicalActivity: integer('physical_activity'),     // B3.4

  // ---- RISK SCORES (0-3 each) ----
  // R1: Dopamine manipulation
  variableRewards: integer('variable_rewards'),       // R1.1
  streakMechanics: integer('streak_mechanics'),       // R1.2
  lossAversion: integer('loss_aversion'),             // R1.3
  fomoEvents: integer('fomo_events'),                 // R1.4
  stoppingBarriers: integer('stopping_barriers'),     // R1.5
  notifications: integer('notifications'),            // R1.6
  nearMiss: integer('near_miss'),                     // R1.7
  infinitePlay: integer('infinite_play'),             // R1.8
  escalatingCommitment: integer('escalating_commitment'), // R1.9
  variableRewardFreq: integer('variable_reward_freq'), // R1.10

  // R2: Monetization
  spendingCeiling: integer('spending_ceiling'),       // R2.1
  payToWin: integer('pay_to_win'),                    // R2.2
  currencyObfuscation: integer('currency_obfuscation'), // R2.3
  spendingPrompts: integer('spending_prompts'),       // R2.4
  childTargeting: integer('child_targeting'),         // R2.5
  adPressure: integer('ad_pressure'),                 // R2.6
  subscriptionPressure: integer('subscription_pressure'), // R2.7
  socialSpending: integer('social_spending'),         // R2.8

  // R3: Social risk
  socialObligation: integer('social_obligation'),     // R3.1
  competitiveToxicity: integer('competitive_toxicity'), // R3.2
  strangerRisk: integer('stranger_risk'),             // R3.3
  socialComparison: integer('social_comparison'),     // R3.4
  identitySelfWorth: integer('identity_self_worth'),  // R3.5
  privacyRisk: integer('privacy_risk'),               // R3.6

  // R4: Content risk
  violenceLevel: integer('violence_level'),           // R4.1
  sexualContent: integer('sexual_content'),           // R4.2
  language: integer('language_content'),              // R4.3
  substanceRef: integer('substance_ref'),             // R4.4
  fearHorror: integer('fear_horror'),                 // R4.5

  // ---- PRACTICAL INFO ----
  estimatedMonthlyCostLow: real('est_monthly_cost_low'),
  estimatedMonthlyCostHigh: real('est_monthly_cost_high'),
  minSessionMinutes: integer('min_session_minutes'),
  hasNaturalStoppingPoints: boolean('has_natural_stopping_points'),
  penalizesBreaks: boolean('penalizes_breaks'),
  stoppingPointsDescription: text('stopping_points_desc'),

  // Virtual currency (for DP04 banner)
  usesVirtualCurrency: boolean('uses_virtual_currency').default(false),
  virtualCurrencyName: varchar('virtual_currency_name', { length: 50 }),
  virtualCurrencyRate: text('virtual_currency_rate'),  // e.g. "100 = $1.99"

  // Reviewer notes
  benefitsNarrative: text('benefits_narrative'),  // "What your child develops" explanation
  risksNarrative: text('risks_narrative'),         // "What to watch out for" explanation
  parentTip: text('parent_tip'),                   // Practical advice

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  approvedAt: timestamp('approved_at'),
}, (table) => ({
  gameIdx: index('review_game_idx').on(table.gameId),
  statusIdx: index('review_status_idx').on(table.status),
}));


// ============================================
// COMPUTED SCORES (derived from reviews via scoring engine)
// ============================================

export const gameScores = pgTable('game_scores', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull().references(() => games.id).unique(),
  reviewId: integer('review_id').notNull().references(() => reviews.id),

  // Category scores (0-1 normalized)
  cognitiveScore: real('cognitive_score'),           // B1 normalized
  socialEmotionalScore: real('social_emotional_score'), // B2 normalized
  motorScore: real('motor_score'),                   // B3 normalized
  bds: real('bds'),                                  // Benefit Density Score

  dopamineRisk: real('dopamine_risk'),               // R1 normalized
  monetizationRisk: real('monetization_risk'),       // R2 normalized
  socialRisk: real('social_risk'),                   // R3 normalized
  contentRisk: real('content_risk'),                 // R4 normalized
  ris: real('ris'),                                  // Risk Intensity Score

  // Time recommendation output
  timeRecommendationMinutes: integer('time_rec_minutes'), // 15, 30, 60, 90, 120
  timeRecommendationLabel: varchar('time_rec_label', { length: 100 }),
  timeRecommendationReasoning: text('time_rec_reasoning'),
  timeRecommendationColor: varchar('time_rec_color', { length: 10 }), // green, amber, red

  // Age recommendation (our own, may differ from ESRB/PEGI)
  recommendedMinAge: integer('recommended_min_age'),

  // Executive summary — one plain-language sentence for parents
  executiveSummary: text('executive_summary'),

  // Top benefit skills for display (ordered by score)
  topBenefits: jsonb('top_benefits').$type<Array<{
    skill: string;
    score: number;
    maxScore: number;
  }>>(),

  // Timestamps
  calculatedAt: timestamp('calculated_at').defaultNow(),
});


// ============================================
// DARK PATTERNS (manipulation tactics per review)
// ============================================

export const darkPatterns = pgTable('dark_patterns', {
  id: serial('id').primaryKey(),
  reviewId: integer('review_id').notNull().references(() => reviews.id),
  patternId: varchar('pattern_id', { length: 4 }).notNull(),   // DP01–DP12
  severity: varchar('severity', { length: 6 }).notNull(),       // low, medium, high
  description: text('description'),  // reviewer's game-specific note
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  reviewIdx: index('dp_review_idx').on(table.reviewId),
}));


// ============================================
// REVIEWERS
// ============================================

export const reviewers = pgTable('reviewers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: varchar('role', { length: 20 }).default('community'), // community, expert, admin
  bio: text('bio'),
  reviewCount: integer('review_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});
