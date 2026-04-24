/**
 * Quick diagnostic: test Gemini function calling with a simplified schema.
 * Run with: node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/test-gemini-debate.ts
 */

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// Full nested schema matching debate-games/route.ts
const B1_FIELDS = ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge']
const B2_FIELDS = ['teamwork','communication','empathy','emotionalRegulation','ethicalReasoning','positiveSocial']
const B3_FIELDS = ['handEyeCoord','fineMotor','reactionTime','physicalActivity']
const R1_FIELDS = ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq']
const R2_FIELDS = ['spendingCeiling','payToWin','currencyObfuscation','spendingPrompts','childTargeting','adPressure','subscriptionPressure','socialSpending']
const R3_FIELDS = ['socialObligation','competitiveToxicity','strangerRisk','socialComparison','identitySelfWorth','privacyRisk']

function scoreGroup(fields: string[], max: number) {
  return {
    type: 'object' as const, required: fields,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer' as const, minimum: 0, maximum: max }])),
  }
}

const SIMPLE_TOOL = {
  functionDeclarations: [{
    name: 'submit_scores',
    description: 'Submit your scores and reasoning for this debate round.',
    parameters: {
      type: 'object',
      required: ['b1','b2','b3','r1','r2','r3','reasoning'],
      properties: {
        b1: scoreGroup(B1_FIELDS, 5),
        b2: scoreGroup(B2_FIELDS, 5),
        b3: scoreGroup(B3_FIELDS, 5),
        r1: scoreGroup(R1_FIELDS, 3),
        r2: scoreGroup(R2_FIELDS, 3),
        r3: scoreGroup(R3_FIELDS, 3),
        reasoning: { type: 'string' as const },
      },
    },
  }],
}

async function main() {
  const key = process.env.GEMINI_API_KEY
  if (!key) { console.error('No GEMINI_API_KEY'); process.exit(1) }

  const url = `${GEMINI_URL}?key=${key}`
  const prompt = `You are the ADVOCATE in a LumiKin scoring debate. Rate Minecraft.

## RUBRIC (0–5 per benefit field, 0–3 per risk field)
B1 Cognitive (0–5 each): problemSolving, spatialAwareness, strategicThinking, criticalThinking, memoryAttention, creativity, readingLanguage, mathSystems, learningTransfer, adaptiveChallenge
B2 Social (0–5 each): teamwork, communication, empathy, emotionalRegulation, ethicalReasoning, positiveSocial
B3 Motor (0–5 each): handEyeCoord, fineMotor, reactionTime, physicalActivity
R1 Dopamine (0–3 each): variableRewards, streakMechanics, lossAversion, fomoEvents, stoppingBarriers, notifications, nearMiss, infinitePlay, escalatingCommitment, variableRewardFreq
R2 Monetization (0–3 each): spendingCeiling, payToWin, currencyObfuscation, spendingPrompts, childTargeting, adPressure, subscriptionPressure, socialSpending
R3 Social risk (0–3 each): socialObligation, competitiveToxicity, strangerRisk, socialComparison, identitySelfWorth, privacyRisk

Call submit_scores with your scores and reasoning.`

  console.log('Calling Gemini with simplified schema...\n')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [SIMPLE_TOOL],
      tool_config: { function_calling_config: { mode: 'ANY', allowed_function_names: ['submit_scores'] } },
      generationConfig: { temperature: 0.2 },
    }),
  })

  const raw = await res.text()
  console.log('Status:', res.status)
  console.log('Raw response:')
  console.log(JSON.stringify(JSON.parse(raw), null, 2))

  if (res.ok) {
    const data = JSON.parse(raw)
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const fnPart = parts.find((p: { functionCall?: unknown }) => p.functionCall)
    if (fnPart) {
      console.log('\n✓ Function call found:')
      console.log(JSON.stringify(fnPart.functionCall, null, 2))
    } else {
      console.log('\n✗ No function call in parts:', parts)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
