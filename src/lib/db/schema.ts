// Core tables for the LumiKin game rating engine

import {
  pgTable, text, integer, real, timestamp, boolean,
  varchar, jsonb, serial, uniqueIndex, index, primaryKey, bigint, date
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
  rawgAdded: integer('rawg_added'),              // total RAWG library adds — popularity signal
  trendingScore: integer('trending_score'),       // YouTube gaming trending mentions (updated daily)
  trendingUpdatedAt: timestamp('trending_updated_at'), // when trendingScore was last set
  avgPlaytimeHours: real('avg_playtime_hours'),
  backgroundImage: text('background_image'),

  // Our enrichment
  isVr: boolean('is_vr').default(false),        // true if primary experience requires a VR headset
  basePrice: real('base_price'),                // in USD
  basePriceCurrency: varchar('base_price_currency', { length: 3 }).default('USD'),
  hasMicrotransactions: boolean('has_microtransactions').default(false),
  hasLootBoxes: boolean('has_loot_boxes').default(false),
  hasSubscription: boolean('has_subscription').default(false),
  hasBattlePass: boolean('has_battle_pass').default(false),
  requiresInternet: varchar('requires_internet', { length: 20 }), // always, sometimes, never
  hasStrangerChat: boolean('has_stranger_chat').default(false),
  chatModeration: varchar('chat_moderation', { length: 50 }),     // none, basic, strong
  bundledOnlineNote: text('bundled_online_note'),                 // manually curated warning for games where a toxic online mode is bundled with a good single-player campaign (e.g. RDR2, GTA V)

  // Content type — distinguishes standalone games from UGC platform hosts
  contentType: varchar('content_type', { length: 20 })
    .$type<'standalone_game' | 'platform'>()
    .notNull()
    .default('standalone_game'),

  // Rescore flag — set by sync-game-updates when RAWG detects a change
  needsRescore: boolean('needs_rescore').notNull().default(false),
  rawgUpdatedAt: timestamp('rawg_updated_at'),

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

  // REP: Representation (0-3 each) — DISPLAY ONLY, higher = better
  repGenderBalance:   integer('rep_gender_balance'),   // 0=stereotyped/absent, 3=authentic diverse
  repEthnicDiversity: integer('rep_ethnic_diversity'),  // 0=monoculture/stereotyped, 3=authentic diverse

  // PROP: Propaganda / ideological content (0-3) — DISPLAY ONLY
  propagandaLevel: integer('propaganda_level'),         // 0=neutral, 3=heavy ideological content
  propagandaNotes: text('propaganda_notes'),            // context: type/source of ideological framing

  // BECHDEL: Female character representation test — DISPLAY ONLY, does not affect scoring
  bechdelResult: varchar('bechdel_result', { length: 4 }), // 'pass' | 'fail' | 'na'
  bechdelNotes: text('bechdel_notes'),                      // brief explanation of the result

  // R5: Accessibility risk (0-3 each, max 12) — DISPLAY ONLY, not in RIS
  r5CrossPlatform:    integer('r5_cross_platform'),
  r5LoadTime:         integer('r5_load_time'),
  r5MobileOptimized:  integer('r5_mobile_optimized'),
  r5LoginBarrier:     integer('r5_login_barrier'),

  // R6: Endless/world design risk (0-3 each, max 12) — DISPLAY ONLY, not in RIS
  r6InfiniteGameplay:   integer('r6_infinite_gameplay'),
  r6NoStoppingPoints:   integer('r6_no_stopping_points'),
  r6NoGameOver:         integer('r6_no_game_over'),
  r6NoChapterStructure: integer('r6_no_chapters'),

  // Virtual currency (for DP04 banner)
  usesVirtualCurrency: boolean('uses_virtual_currency').default(false),
  virtualCurrencyName: varchar('virtual_currency_name', { length: 50 }),
  virtualCurrencyRate: text('virtual_currency_rate'),  // e.g. "100 = $1.99"

  // Reviewer notes
  benefitsNarrative: text('benefits_narrative'),  // "What your child develops" explanation
  risksNarrative: text('risks_narrative'),         // "What to watch out for" explanation
  parentTip: text('parent_tip'),                   // Risk-side practical advice
  parentTipBenefits: text('parent_tip_benefits'),  // Benefits-side encouragement tip

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  approvedAt: timestamp('approved_at'),

  // AI provenance
  aiModel: varchar('ai_model', { length: 100 }),
  reviewedAt: timestamp('reviewed_at'),
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
  curascore: integer('curascore'),                   // harmonic mean of BDS + Safety, 0–100

  // Time recommendation output
  timeRecommendationMinutes: integer('time_rec_minutes'), // 15, 30, 60, 90, 120
  timeRecommendationLabel: varchar('time_rec_label', { length: 100 }),
  timeRecommendationReasoning: text('time_rec_reasoning'),
  timeRecommendationColor: varchar('time_rec_color', { length: 10 }), // green, amber, red

  // Age recommendation (our own, may differ from ESRB/PEGI)
  recommendedMinAge: integer('recommended_min_age'),

  // R5/R6 normalized (display only — not in RIS formula)
  accessibilityRisk: real('accessibility_risk'),
  endlessDesignRisk: real('endless_design_risk'),

  // Representation score (display only — avg of gender + ethnic, normalized 0–1, higher = better)
  representationScore: real('representation_score'),
  // Propaganda level pass-through (display only)
  propagandaLevel: integer('propaganda_level'),
  // Bechdel result pass-through (display only)
  bechdelResult: varchar('bechdel_result', { length: 4 }), // 'pass' | 'fail' | 'na'

  // Executive summary — one plain-language sentence for parents
  executiveSummary: text('executive_summary'),

  // Top benefit skills for display (ordered by score)
  topBenefits: jsonb('top_benefits').$type<Array<{
    skill: string;
    score: number;
    maxScore: number;
  }>>(),

  // Adversarial debate scoring
  debateTranscript: text('debate_transcript'),       // full round-by-round transcript
  debateRounds:     integer('debate_rounds'),         // number of rounds completed

  // Methodology traceability
  methodologyVersion: varchar('methodology_version', { length: 10 }),
  scoringMethod: varchar('scoring_method', { length: 20 }), // 'full_rubric' | 'ugc_adapted' | 'hand_curated'

  // Timestamps
  calculatedAt: timestamp('calculated_at').defaultNow(),
});


// ============================================
// COMPLIANCE STATUS (regulatory badges per game)
// ============================================

export const complianceStatus = pgTable('compliance_status', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull().references(() => games.id),
  regulation: varchar('regulation', { length: 10 }).notNull(),  // DSA, GDPR-K, ODDS
  status: varchar('status', { length: 15 }).notNull().default('not_assessed'),  // compliant, non_compliant, not_assessed
  notes: text('notes'),
  assessedAt: timestamp('assessed_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  complianceUnique: uniqueIndex('compliance_unique').on(table.gameId, table.regulation),
}));


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
// GAME FEEDBACK
// ============================================

export const gameFeedback = pgTable('game_feedback', {
  id:        serial('id').primaryKey(),
  gameId:    integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 50 }).notNull(), // 'too_high' | 'too_low' | 'outdated' | 'missing_info' | 'other'
  comment:   text('comment'),
  status:    varchar('status', { length: 20 }).default('pending'), // 'pending' | 'reviewed' | 'actioned'
  createdAt: timestamp('created_at').defaultNow(),
})

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


// ============================================
// PARTNER INQUIRIES
// ============================================

export const partnerInquiries = pgTable('partner_inquiries', {
  id:          serial('id').primaryKey(),
  name:        varchar('name', { length: 255 }).notNull(),
  company:     varchar('company', { length: 255 }).notNull(),
  role:        varchar('role', { length: 255 }).notNull(),
  email:       varchar('email', { length: 255 }).notNull(),
  usecase:     text('usecase').notNull(),
  submittedAt: timestamp('submitted_at').defaultNow(),
  emailSent:   boolean('email_sent').notNull().default(false),
});

// ============================================
// AUTH.JS v5 — User persistence tables
// ============================================

export const users = pgTable('user', {
  id:            text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:          text('name'),
  email:         text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image:         text('image'),
})

export const accounts = pgTable('account', {
  userId:            text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:              text('type').notNull(),
  provider:          text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token:     text('refresh_token'),
  access_token:      text('access_token'),
  expires_at:        integer('expires_at'),
  token_type:        text('token_type'),
  scope:             text('scope'),
  id_token:          text('id_token'),
  session_state:     text('session_state'),
}, (account) => ({
  compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
}))

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId:       text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires:      timestamp('expires', { mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token:      text('token').notNull(),
  expires:    timestamp('expires', { mode: 'date' }).notNull(),
}, (vt) => ({
  compositePk: primaryKey({ columns: [vt.identifier, vt.token] }),
}))

// ============================================
// USER GAME LISTS (library + wishlist)
// ============================================

export const userGames = pgTable('user_games', {
  id:             serial('id').primaryKey(),
  userId:         text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameId:         integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  listType:       varchar('list_type', { length: 20 }).notNull().default('owned'), // 'owned' | 'wishlist'
  addedAt:        timestamp('added_at').defaultNow(),
}, (table) => ({
  uniqueEntry:    uniqueIndex('user_game_list_unique').on(table.userId, table.gameId, table.listType),
  userIdx:        index('user_games_user_idx').on(table.userId),
}))

// ============================================
// CHILD PROFILES
// ============================================

export const childProfiles = pgTable('child_profiles', {
  id:          serial('id').primaryKey(),
  userId:      text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:        varchar('name', { length: 100 }).notNull(),
  birthYear:   integer('birth_year').notNull(),              // kept for compat; prefer birthDate
  birthDate:   date('birth_date'),                           // YYYY-MM-DD, exact birth date
  platforms:   jsonb('platforms').$type<string[]>().default([]),
  focusSkills: jsonb('focus_skills').$type<string[]>().default([]),
  createdAt:   timestamp('created_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdx: index('child_profile_user_idx').on(table.userId),
}))


// ============================================
// PARENT TIPS (community UGC)
// ============================================

export const gameTips = pgTable('game_tips', {
  id:         serial('id').primaryKey(),
  gameId:     integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  userId:     text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  authorName: varchar('author_name', { length: 100 }).notNull().default('A parent'),
  content:    varchar('content', { length: 280 }).notNull(),
  tipType:    varchar('tip_type', { length: 20 }).notNull().default('tip'), // 'tip' | 'warning' | 'praise'
  status:     varchar('status', { length: 20 }).notNull().default('approved'), // 'approved' | 'flagged'
  createdAt:  timestamp('created_at').defaultNow(),
}, (table) => ({
  gameIdx: index('game_tips_game_idx').on(table.gameId),
  userIdx: index('game_tips_user_idx').on(table.userId),
}))

export const gameTipVotes = pgTable('game_tip_votes', {
  id:        serial('id').primaryKey(),
  tipId:     integer('tip_id').notNull().references(() => gameTips.id, { onDelete: 'cascade' }),
  userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniq: uniqueIndex('game_tip_votes_tip_user_idx').on(table.tipId, table.userId),
}))

// ============================================
// INGEST STATE (background game crawler cursor)
// ============================================

// ============================================
// PLATFORM EXPERIENCES (UGC inside platforms like Roblox)
// ============================================

export const platformExperiences = pgTable('platform_experiences', {
  id:           serial('id').primaryKey(),
  slug:         varchar('slug', { length: 255 }).notNull().unique(),
  platformId:   integer('platform_id').notNull().references(() => games.id),

  // External platform IDs
  universeId:   varchar('universe_id', { length: 50 }),   // Roblox Universe ID
  placeId:      varchar('place_id', { length: 50 }).notNull().unique(), // Roblox Place ID

  // Metadata
  title:        varchar('title', { length: 500 }).notNull(),
  description:  text('description'),
  creatorName:  varchar('creator_name', { length: 255 }),
  creatorId:    varchar('creator_id', { length: 50 }),
  thumbnailUrl: text('thumbnail_url'),
  genre:        varchar('genre', { length: 100 }),
  isPublic:     boolean('is_public').default(true),

  // Live stats (refreshed periodically)
  visitCount:    bigint('visit_count', { mode: 'number' }),
  activePlayers: integer('active_players'),
  maxPlayers:    integer('max_players'),

  // Re-fetch cadence
  lastFetchedAt: timestamp('last_fetched_at'),

  // Rescore flag — set when content changes are detected during stat refresh
  needsRescore: boolean('needs_rescore').notNull().default(false),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  platformIdx:  index('pe_platform_idx').on(table.platformId),
  universeIdx:  index('pe_universe_idx').on(table.universeId),
}));

// ============================================
// EXPERIENCE SCORES (AI evaluation of UGC experiences)
// ============================================

export const experienceScores = pgTable('experience_scores', {
  id:           serial('id').primaryKey(),
  experienceId: integer('experience_id').notNull().references(() => platformExperiences.id).unique(),

  // Curascore (0–100) — same scale as game_scores for UI consistency
  curascore: integer('curascore'),

  // UGC-specific risk scores (0–3 each)
  dopamineTrapScore:  integer('dopamine_trap_score'),  // variable rewards, streaks, near-miss
  toxicityScore:      integer('toxicity_score'),       // chat toxicity, bullying, competitive pressure
  ugcContentRisk:     integer('ugc_content_risk'),     // inappropriate UGC (builds, avatars, chat)
  strangerRisk:       integer('stranger_risk'),        // stranger interaction, grooming vectors
  monetizationScore:  integer('monetization_score'),  // Robux pressure, pay-to-win, social spending
  privacyRisk:        integer('privacy_risk'),         // data collection, location, identity exposure

  // Benefit scores (0–3 each)
  creativityScore:    integer('creativity_score'),     // building, designing, scripting
  socialScore:        integer('social_score'),         // cooperative play, friendship, community
  learningScore:      integer('learning_score'),       // skill development, problem solving

  // Normalized composite scores (0–1)
  riskScore:    real('risk_score'),    // weighted average of risk dimensions
  benefitScore: real('benefit_score'), // weighted average of benefit dimensions

  // Rubric-mapped normalized composites (0–1, same scale as game_scores)
  dopamineRisk:    real('dopamine_risk'),       // R1: dopamineTrapScore / 3
  monetizationRisk: real('monetization_risk'), // R2: monetizationScore / 3
  socialRisk:      real('social_risk'),         // R3: toxicity×0.4 + stranger×0.4 + privacy×0.2
  contentRisk:     real('content_risk'),        // R4: ugcContentRisk / 3 (display only)

  // Time recommendation
  timeRecommendationMinutes: integer('time_rec_minutes'),
  timeRecommendationLabel:   varchar('time_rec_label', { length: 100 }),
  timeRecommendationReasoning: text('time_rec_reasoning'),
  timeRecommendationColor:   varchar('time_rec_color', { length: 10 }),

  // Narrative output
  summary:           text('summary'),
  benefitsNarrative: text('benefits_narrative'),
  risksNarrative:    text('risks_narrative'),
  parentTip:         text('parent_tip'),

  // Recommended minimum age
  recommendedMinAge: integer('recommended_min_age'),

  // AI curascore kept for monitoring; displayed value is formula-derived
  curascoreAiSuggested: integer('curascore_ai_suggested'),

  // Methodology traceability
  methodologyVersion: varchar('methodology_version', { length: 10 }),
  scoringMethod: varchar('scoring_method', { length: 20 }), // 'ugc_adapted' | 'hand_curated'

  // Timestamps
  calculatedAt: timestamp('calculated_at').defaultNow(),
  updatedAt:    timestamp('updated_at').defaultNow(),
});

// ============================================
// INGEST STATE (background game crawler cursor)
// ============================================

// ============================================
// EPIC GAMES INTEGRATION
// ============================================

export const epicConnections = pgTable('epic_connections', {
  id:            serial('id').primaryKey(),
  userId:        text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  epicAccountId: varchar('epic_account_id', { length: 50 }).notNull().unique(),
  displayName:   varchar('display_name', { length: 255 }),
  accessToken:   text('access_token').notNull(),
  refreshToken:  text('refresh_token').notNull(),
  expiresAt:     timestamp('expires_at').notNull(),
  lastSyncedAt:  timestamp('last_synced_at'),
  createdAt:     timestamp('created_at').defaultNow(),
})

// Raw Epic entitlement records (catalog items the user owns)
export const epicLibrary = pgTable('epic_library', {
  id:            serial('id').primaryKey(),
  userId:        text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  epicAccountId: varchar('epic_account_id', { length: 50 }).notNull(),
  catalogItemId: varchar('catalog_item_id', { length: 100 }).notNull(),
  namespace:     varchar('namespace', { length: 100 }).notNull(),
  appName:       varchar('app_name', { length: 255 }),
  title:         varchar('title', { length: 500 }),
  // Matched game in our catalog (null if no match found)
  gameId:        integer('game_id').references(() => games.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueEntry: uniqueIndex('epic_library_unique').on(table.userId, table.catalogItemId),
  userIdx:     index('epic_library_user_idx').on(table.userId),
}))

// ============================================
// NINTENDO PARENTAL CONTROLS INTEGRATION
// ============================================

export const nintendoConnections = pgTable('nintendo_connections', {
  id:           serial('id').primaryKey(),
  userId:       text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  naId:         varchar('na_id', { length: 50 }).notNull().unique(),
  nickname:     varchar('nickname', { length: 255 }),
  imageUrl:     text('image_url'),
  sessionToken: text('session_token').notNull(),  // long-lived, never expires
  createdAt:    timestamp('created_at').defaultNow(),
  lastSyncedAt: timestamp('last_synced_at'),
})

export const nintendoPlaytime = pgTable('nintendo_playtime', {
  id:               serial('id').primaryKey(),
  userId:           text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  naId:             varchar('na_id', { length: 50 }).notNull(),
  deviceId:         varchar('device_id', { length: 100 }).notNull(),
  deviceName:       varchar('device_name', { length: 255 }),
  date:             varchar('date', { length: 10 }).notNull(),   // YYYY-MM-DD
  appId:            varchar('app_id', { length: 50 }).notNull(),
  appTitle:         varchar('app_title', { length: 500 }).notNull(),
  appImageUrl:      text('app_image_url'),
  playTimeMinutes:  integer('play_time_minutes').notNull().default(0),
  createdAt:        timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueEntry: uniqueIndex('nintendo_playtime_unique').on(table.naId, table.deviceId, table.date, table.appId),
  userIdx:     index('nintendo_playtime_user_idx').on(table.userId),
  dateIdx:     index('nintendo_playtime_date_idx').on(table.userId, table.date),
}))

// ============================================
// NOTIFICATIONS
// ============================================

export const notifications = pgTable('notifications', {
  id:        serial('id').primaryKey(),
  userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameId:    integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 30 }).notNull(), // 'first_score' | 'score_change' | 'time_change'
  title:     varchar('title', { length: 255 }).notNull(),
  body:      text('body').notNull(),
  read:      boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdx: index('notif_user_idx').on(table.userId),
  unreadIdx: index('notif_unread_idx').on(table.userId, table.read),
}))

export const ingestCursor = pgTable('ingest_cursor', {
  id:             integer('id').primaryKey().default(1),
  genreIndex:     integer('genre_index').notNull().default(0),
  page:           integer('page').notNull().default(1),
  sweep:          integer('sweep').notNull().default(1),   // which ordering pass we're on
  totalImported:  integer('total_imported').notNull().default(0),
  lastRunAt:      timestamp('last_run_at'),
  updatedAt:      timestamp('updated_at').defaultNow(),
})

// ============================================
// CONTENT TRANSLATIONS (auto-generated per locale)
// ============================================

export const gameTranslations = pgTable('game_translations', {
  id:                 serial('id').primaryKey(),
  gameId:             integer('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
  locale:             varchar('locale', { length: 10 }).notNull(),  // sv, de, fr, es
  executiveSummary:   text('executive_summary'),
  benefitsNarrative:  text('benefits_narrative'),
  risksNarrative:     text('risks_narrative'),
  parentTip:          text('parent_tip'),
  parentTipBenefits:  text('parent_tip_benefits'),
  bechdelNotes:       text('bechdel_notes'),
  createdAt:          timestamp('created_at').defaultNow(),
}, (t) => ({
  uniqueGameLocale: uniqueIndex('game_translations_game_locale_idx').on(t.gameId, t.locale),
}))

// ============================================
// PIPELINE OBSERVABILITY
// ============================================

export const cronRuns = pgTable('cron_runs', {
  id:             serial('id').primaryKey(),
  jobName:        varchar('job_name', { length: 100 }).notNull(),
  startedAt:      timestamp('started_at').notNull(),
  finishedAt:     timestamp('finished_at'),
  status:         varchar('status', { length: 20 }).notNull(), // 'success' | 'partial' | 'error'
  itemsProcessed: integer('items_processed').notNull().default(0),
  itemsSkipped:   integer('items_skipped').notNull().default(0),
  errors:         integer('errors').notNull().default(0),
  durationMs:     integer('duration_ms'),
  meta:           jsonb('meta').$type<Record<string, unknown>>(),
}, (t) => ({
  jobNameIdx:   index('cron_runs_job_name_idx').on(t.jobName),
  startedAtIdx: index('cron_runs_started_at_idx').on(t.startedAt),
}))
