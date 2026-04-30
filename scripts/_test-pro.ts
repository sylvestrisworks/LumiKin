import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { callGeminiTool, type GeminiTool } from '@/lib/vertex-ai'

const GEMINI_PRO = 'gemini-2.5-pro'

const tool: GeminiTool = {
  name: 'submit_scores',
  description: 'Submit scores.',
  input_schema: {
    type: 'object', required: ['problemSolving', 'variableRewards', 'reasoning'],
    properties: {
      problemSolving:  { type: 'integer', minimum: 0, maximum: 5 },
      variableRewards: { type: 'integer', minimum: 0, maximum: 3 },
      reasoning:       { type: 'string' },
    },
  },
}

async function main() {
  console.log(`Testing ${GEMINI_PRO} at global endpoint...`)
  const start = Date.now()
  try {
    const result = await callGeminiTool<{
      problemSolving: number; variableRewards: number; reasoning: string
    }>(
      'Score Far Cry 3: Blood Dragon on problemSolving (0-5 cognitive benefit) and variableRewards (0-3 addictive mechanics). Call submit_scores.',
      tool,
      GEMINI_PRO,
      0,
      -1, // -1 = omit thinkingConfig entirely (Pro requires thinking on)
    )
    console.log(`Done in ${((Date.now()-start)/1000).toFixed(1)}s`)
    console.log('problemSolving:', result.problemSolving)
    console.log('variableRewards:', result.variableRewards)
    console.log('reasoning:', result.reasoning.slice(0, 300))
  } catch (e) {
    console.error(`FAILED in ${((Date.now()-start)/1000).toFixed(1)}s:`, String(e).slice(0, 200))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
