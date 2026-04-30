import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { callGeminiTool, GEMINI_PRO, GEMINI_FLASH, type GeminiTool } from '@/lib/vertex-ai'

const B1_FIELDS = ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge']
const B2_FIELDS = ['teamwork','communication','empathy','emotionalRegulation','ethicalReasoning','positiveSocial']
const B3_FIELDS = ['handEyeCoord','fineMotor','reactionTime','physicalActivity']
const R1_FIELDS = ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq']
const R2_FIELDS = ['spendingCeiling','payToWin','currencyObfuscation','spendingPrompts','childTargeting','adPressure','subscriptionPressure','socialSpending']
const R3_FIELDS = ['socialObligation','competitiveToxicity','strangerRisk','socialComparison','identitySelfWorth','privacyRisk']

function sg(fields: string[], max: number) {
  return { type: 'object', required: fields, properties: Object.fromEntries(fields.map(f => [f, { type: 'integer', minimum: 0, maximum: max }])) }
}

const TOOL: GeminiTool = {
  name: 'submit_scores',
  description: 'Submit scores and reasoning.',
  input_schema: {
    type: 'object',
    required: ['b1','b2','b3','r1','r2','r3','reasoning'],
    properties: {
      b1: sg(B1_FIELDS, 5), b2: sg(B2_FIELDS, 5), b3: sg(B3_FIELDS, 5),
      r1: sg(R1_FIELDS, 3), r2: sg(R2_FIELDS, 3), r3: sg(R3_FIELDS, 3),
      reasoning: { type: 'string' },
    },
  },
}

const RUBRIC = `## RUBRIC (0–5 per benefit field, 0–3 per risk field)
B1 Cognitive (0–5 each): ${B1_FIELDS.join(', ')}
B2 Social (0–5 each): ${B2_FIELDS.join(', ')}
B3 Motor (0–5 each): ${B3_FIELDS.join(', ')}
R1 Dopamine (0–3 each): ${R1_FIELDS.join(', ')}
R2 Monetization (0–3 each): ${R2_FIELDS.join(', ')}
R3 Social risk (0–3 each): ${R3_FIELDS.join(', ')}

CALIBRATION:
Zelda BotW:  B1=42, B2=18, B3=10 | R1=2,  R2=0,  R3=2  → curascore 82
Minecraft:   B1=38, B2=16, B3=6  | R1=4,  R2=2,  R3=4  → curascore 75
Fortnite:    B1=19, B2=10, B3=13 | R1=18, R2=13, R3=11 → curascore 42
Brawl Stars: B1=14, B2=9,  B3=11 | R1=23, R2=18, R3=12 → curascore 30`

const GAME = `Title: Far Cry 3: Blood Dragon
Genres: Action, Shooter
Platforms: PC, PlayStation 3, Xbox 360
Description: Far Cry 3: Blood Dragon is an open world first-person shooter set in a dark future 2007 where you must get the girl, kill the baddies, and save the world. You are Sergeant Rex Colt, a Mark IV Cyber Commando who's fighting against a cyborg army gone rogue.
Metacritic: 79
Microtransactions: No  Loot boxes: No  Battle pass: No
Stranger chat: No`

const ADVOCATE_R1 = `You are the ADVOCATE in a LumiKin scoring debate. Argue for the HIGHEST DEFENSIBLE scores.
- Push benefit scores UP whenever evidence supports it
- Push risk scores DOWN when risks are manageable
- Base arguments on child development research
- CRITICAL: Single-player games with no co-op get teamwork=0, communication=0, positiveSocial≤1

${RUBRIC}

## GAME
${GAME}

Produce your OPENING position. Call submit_scores with your scores and reasoning.`

async function timeCall(model: string, budget: number, label: string) {
  const start = Date.now()
  try {
    await callGeminiTool(ADVOCATE_R1, TOOL, model, 0, budget)
    console.log(`${label}: ${((Date.now()-start)/1000).toFixed(1)}s ✓`)
  } catch(e) {
    console.log(`${label}: FAILED - ${String(e).slice(0,100)}`)
  }
}

async function main() {
  console.log('Testing full-length debate prompt timing...\n')
  await timeCall(GEMINI_PRO,   -1,   'Pro  (thinking auto)')
  await timeCall(GEMINI_FLASH, 2048, 'Flash (thinking 2048)')
  await timeCall(GEMINI_FLASH, 1024, 'Flash (thinking 1024)')
}

main().catch(e => { console.error(e); process.exit(1) })
