import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { eq, gte, lte, isNull, isNotNull, and } from 'drizzle-orm'
import { callGeminiTool, GEMINI_FLASH, type GeminiTool } from '@/lib/vertex-ai'

const B1_FIELDS = ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge']
const R1_FIELDS = ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq']

function scoreGroup(fields: string[], max: number) {
  return {
    type: 'object', required: fields,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer', minimum: 0, maximum: max }])),
  }
}

const TOOL: GeminiTool = {
  name: 'submit_scores',
  description: 'Submit scores for this debate round.',
  input_schema: {
    type: 'object',
    required: ['b1', 'r1', 'reasoning'],
    properties: {
      b1: scoreGroup(B1_FIELDS, 5),
      r1: scoreGroup(R1_FIELDS, 3),
      reasoning: { type: 'string' },
    },
  },
}

async function main() {
  const [row] = await db
    .select({ game: games, curascore: gameScores.curascore })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      isNotNull(gameScores.curascore),
      gte(gameScores.curascore, 35),
      lte(gameScores.curascore, 60),
      isNull(gameScores.debateRounds),
    ))
    .limit(1)

  if (!row) { console.log('No debate candidates found'); process.exit(0) }

  console.log(`Debating: ${row.game.title} (curascore ${row.curascore})`)

  const prompt = `You are the ADVOCATE. Score this game on B1 cognitive benefits and R1 dopamine risks.

Game: ${row.game.title}
Description: ${row.game.description?.slice(0, 300) ?? 'N/A'}
Metacritic: ${row.game.metacriticScore ?? 'N/A'}

B1 fields (0-5 each): ${B1_FIELDS.join(', ')}
R1 fields (0-3 each): ${R1_FIELDS.join(', ')}

Call submit_scores with your assessment.`

  console.log('Calling Gemini with thinkingBudget=2048...')
  const start = Date.now()
  const result = await callGeminiTool<{ b1: Record<string,number>; r1: Record<string,number>; reasoning: string }>(
    prompt, TOOL, 'gemini-2.5-pro', 0, -1
  )
  console.log(`Done in ${((Date.now()-start)/1000).toFixed(1)}s`)
  console.log('B1 sample:', Object.entries(result.b1).slice(0,3).map(([k,v]) => `${k}=${v}`).join(', '))
  console.log('R1 sample:', Object.entries(result.r1).slice(0,3).map(([k,v]) => `${k}=${v}`).join(', '))
  console.log('Reasoning:', result.reasoning.slice(0, 300))

  await db.end?.()
}

main().catch(e => { console.error(e); process.exit(1) })
