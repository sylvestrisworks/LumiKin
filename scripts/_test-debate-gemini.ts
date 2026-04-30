import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { callGeminiTool, GEMINI_FLASH, type GeminiTool } from '@/lib/vertex-ai'

const tool: GeminiTool = {
  name: 'submit_scores',
  description: 'Submit scores for this debate round.',
  input_schema: {
    type: 'object',
    required: ['problemSolving', 'variableRewards', 'reasoning'],
    properties: {
      problemSolving:  { type: 'integer', minimum: 0, maximum: 5 },
      variableRewards: { type: 'integer', minimum: 0, maximum: 3 },
      reasoning:       { type: 'string' },
    },
  },
}

async function main() {
  console.log('Testing callGeminiTool with thinkingBudget=4096...')
  const start = Date.now()
  const result = await callGeminiTool<{
    problemSolving: number; variableRewards: number; reasoning: string
  }>(
    `You are the ADVOCATE in a LumiKin debate. Score Minecraft (Java Edition) on:
- problemSolving (0-5): cognitive benefit for problem solving
- variableRewards (0-3): addictive variable reward mechanics

Call submit_scores with your assessment and reasoning.`,
    tool,
    GEMINI_FLASH,
    0,
    4096,
  )
  const ms = Date.now() - start
  console.log(`Done in ${(ms/1000).toFixed(1)}s`)
  console.log('problemSolving:', result.problemSolving)
  console.log('variableRewards:', result.variableRewards)
  console.log('reasoning:', result.reasoning.slice(0, 200))
}

main().catch(e => { console.error(e); process.exit(1) })
