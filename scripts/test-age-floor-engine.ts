import { calculateGameScores } from '../src/lib/scoring/engine'

// Test with a high-violence game (GTA-like: v=3, s=1)
const result = calculateGameScores({
  problemSolving: 4, spatialAwareness: 3, strategicThinking: 3, criticalThinking: 3,
  memoryAttention: 2, creativity: 2, readingLanguage: 1, mathSystems: 1,
  learningTransfer: 3, adaptiveChallenge: 3,
  teamwork: 1, communication: 1, empathy: 1, emotionalRegulation: 1,
  ethicalReasoning: 1, positiveSocial: 1,
  handEyeCoord: 3, fineMotor: 2, reactionTime: 3, physicalActivity: 0,
  variableRewards: 2, streakMechanics: 1, lossAversion: 2, fomoEvents: 0,
  stoppingBarriers: 1, notifications: 0, nearMiss: 1, infinitePlay: 2,
  escalatingCommitment: 2, variableRewardFreq: 2,
  spendingCeiling: 0, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
  childTargeting: 0, adPressure: 0, subscriptionPressure: 0, socialSpending: 0,
  socialObligation: 0, competitiveToxicity: 1, strangerRisk: 0,
  socialComparison: 0, identitySelfWorth: 0, privacyRisk: 0,
  violenceLevel: 3, sexualContent: 1, language: 2, substanceRef: 1, fearHorror: 1,
  trivialized: false, defencelessTarget: false, mixedSexualViolent: false,
})

console.log('recommendedMinAge:', result.recommendedMinAge)
console.log('ageFloorReason:', result.ageFloorReason)
console.log('curascore:', result.curascore)
console.log('bds:', result.bds.toFixed(3))
console.log('ris:', result.ris.toFixed(3))

// Verify the scoreData object that would be written to DB
const scoreData = {
  recommendedMinAge: result.recommendedMinAge,
  ageFloorReason:    result.ageFloorReason,
}
console.log('\nscoreData fields:')
console.log('  recommendedMinAge type:', typeof scoreData.recommendedMinAge, '=', scoreData.recommendedMinAge)
console.log('  ageFloorReason type:', typeof scoreData.ageFloorReason, '=', scoreData.ageFloorReason)

// Test with zero content (most games)
const resultZero = calculateGameScores({
  problemSolving: 3, strategicThinking: 3,
  violenceLevel: 0, sexualContent: 0,
  trivialized: false, defencelessTarget: false, mixedSexualViolent: false,
})
console.log('\nZero content game:')
console.log('  recommendedMinAge:', resultZero.recommendedMinAge, '(type:', typeof resultZero.recommendedMinAge + ')')
process.exit(0)
