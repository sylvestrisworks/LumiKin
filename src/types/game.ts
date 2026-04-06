// Serializable prop types for GameCard and related components.
// Dates are strings (ISO) since these types cross the server→client boundary.

export type DarkPattern = {
  patternId: string       // DP01–DP12
  severity: 'low' | 'medium' | 'high'
  description: string | null
}

export type SerializedGame = {
  id: number
  slug: string
  title: string
  description: string | null
  developer: string | null
  publisher: string | null
  releaseDate: string | null
  genres: string[]
  platforms: string[]
  esrbRating: string | null
  metacriticScore: number | null
  avgPlaytimeHours: number | null
  backgroundImage: string | null
  basePrice: number | null
  hasMicrotransactions: boolean
  hasLootBoxes: boolean
  hasSubscription: boolean
  hasBattlePass: boolean
  requiresInternet: string | null
  hasStrangerChat: boolean
  chatModeration: string | null
  updatedAt: string | null
}

export type SerializedScores = {
  bds: number | null
  ris: number | null
  cognitiveScore: number | null
  socialEmotionalScore: number | null
  motorScore: number | null
  dopamineRisk: number | null
  monetizationRisk: number | null
  socialRisk: number | null
  contentRisk: number | null
  timeRecommendationMinutes: number | null
  timeRecommendationLabel: string | null
  timeRecommendationReasoning: string | null
  timeRecommendationColor: 'green' | 'amber' | 'red' | null
  topBenefits: Array<{ skill: string; score: number; maxScore: number }> | null
  calculatedAt: string | null
}

export type SerializedReview = {
  // B1: Cognitive
  problemSolving: number | null
  spatialAwareness: number | null
  strategicThinking: number | null
  criticalThinking: number | null
  memoryAttention: number | null
  creativity: number | null
  readingLanguage: number | null
  mathSystems: number | null
  learningTransfer: number | null
  adaptiveChallenge: number | null
  // B2: Social-emotional
  teamwork: number | null
  communication: number | null
  empathy: number | null
  emotionalRegulation: number | null
  ethicalReasoning: number | null
  positiveSocial: number | null
  // B3: Motor
  handEyeCoord: number | null
  fineMotor: number | null
  reactionTime: number | null
  physicalActivity: number | null
  // R1: Dopamine
  variableRewards: number | null
  streakMechanics: number | null
  lossAversion: number | null
  fomoEvents: number | null
  stoppingBarriers: number | null
  notifications: number | null
  nearMiss: number | null
  infinitePlay: number | null
  escalatingCommitment: number | null
  variableRewardFreq: number | null
  // R2: Monetization
  spendingCeiling: number | null
  payToWin: number | null
  currencyObfuscation: number | null
  spendingPrompts: number | null
  childTargeting: number | null
  adPressure: number | null
  subscriptionPressure: number | null
  socialSpending: number | null
  // R3: Social
  socialObligation: number | null
  competitiveToxicity: number | null
  strangerRisk: number | null
  socialComparison: number | null
  identitySelfWorth: number | null
  privacyRisk: number | null
  // R4: Content
  violenceLevel: number | null
  sexualContent: number | null
  language: number | null
  substanceRef: number | null
  fearHorror: number | null
  // Practical info
  estimatedMonthlyCostLow: number | null
  estimatedMonthlyCostHigh: number | null
  minSessionMinutes: number | null
  hasNaturalStoppingPoints: boolean | null
  penalizesBreaks: boolean | null
  stoppingPointsDescription: string | null
  // Virtual currency
  usesVirtualCurrency: boolean | null
  virtualCurrencyName: string | null
  virtualCurrencyRate: string | null
  // Narratives
  benefitsNarrative: string | null
  risksNarrative: string | null
  parentTip: string | null
}

export type GameCardProps = {
  game: SerializedGame
  scores: SerializedScores | null
  review: SerializedReview | null
  darkPatterns: DarkPattern[]
}

// Lightweight type for search results and cards in list views
export type GameSummary = {
  slug: string
  title: string
  developer: string | null
  genres: string[]
  esrbRating: string | null
  backgroundImage: string | null
  metacriticScore: number | null
  timeRecommendationMinutes: number | null
  timeRecommendationColor: 'green' | 'amber' | 'red' | null
  bds?: number | null
  ris?: number | null
  hasMicrotransactions?: boolean
  hasLootBoxes?: boolean
}
