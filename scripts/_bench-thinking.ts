import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { callGeminiTool, GEMINI_FLASH, type GeminiTool } from '@/lib/vertex-ai'

const tool: GeminiTool = {
  name: 'submit_scores',
  description: 'Submit scores.',
  input_schema: {
    type: 'object', required: ['problemSolving','variableRewards','reasoning'],
    properties: {
      problemSolving:  { type: 'integer', minimum: 0, maximum: 5 },
      variableRewards: { type: 'integer', minimum: 0, maximum: 3 },
      reasoning:       { type: 'string' },
    },
  },
}

const PROMPT = 'Score Minecraft Java Edition: problemSolving (0-5 cognitive benefit), variableRewards (0-3 addictive mechanics). Call submit_scores with your assessment.'

async function main() {
  for (const budget of [2048, 1024]) {
    const start = Date.now()
    await callGeminiTool(PROMPT, tool, GEMINI_FLASH, 0, budget)
    console.log(`budget ${budget} -> ${((Date.now() - start) / 1000).toFixed(1)}s`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
