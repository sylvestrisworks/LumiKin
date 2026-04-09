import { db } from '../src/lib/db'
import { games, gameScores } from '../src/lib/db/schema'
import { eq, or, ilike } from 'drizzle-orm'

async function main() {
  const rows = await db.select({
    title: games.title,
    slug: games.slug,
    curascore: gameScores.curascore,
    bds: gameScores.bds,
    ris: gameScores.ris,
    cognitiveScore: gameScores.cognitiveScore,
    socialEmotionalScore: gameScores.socialEmotionalScore,
    motorScore: gameScores.motorScore,
    dopamineRisk: gameScores.dopamineRisk,
    monetizationRisk: gameScores.monetizationRisk,
    socialRisk: gameScores.socialRisk,
    contentRisk: gameScores.contentRisk,
    timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
    topBenefits: gameScores.topBenefits,
    executiveSummary: gameScores.executiveSummary,
  }).from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(or(ilike(games.title, '%split fiction%'), ilike(games.title, '%it takes two%')))

  for (const r of rows) {
    console.log('\n' + '='.repeat(60))
    console.log(`GAME: ${r.title}`)
    console.log('='.repeat(60))
    console.log(`Curascore: ${r.curascore}  |  BDS: ${r.bds?.toFixed(3)}  |  RIS: ${r.ris?.toFixed(3)}`)
    console.log(`Time rec:  ${r.timeRecommendationMinutes} min/day`)
    console.log('\n--- BDS sub-scores ---')
    console.log(`  Cognitive:        ${r.cognitiveScore?.toFixed(3)}`)
    console.log(`  Social/Emotional: ${r.socialEmotionalScore?.toFixed(3)}`)
    console.log(`  Motor:            ${r.motorScore?.toFixed(3)}`)
    console.log('\n--- RIS sub-scores ---')
    console.log(`  Dopamine risk:    ${r.dopamineRisk?.toFixed(3)}`)
    console.log(`  Monetization:     ${r.monetizationRisk?.toFixed(3)}`)
    console.log(`  Social risk:      ${r.socialRisk?.toFixed(3)}`)
    console.log(`  Content risk:     ${r.contentRisk?.toFixed(3)}`)
    console.log('\n--- Top benefits ---')
    const tb = r.topBenefits as { skill: string; score: number; maxScore: number }[] | null
    if (tb) tb.slice(0, 5).forEach(b => console.log(`  ${b.skill}: ${b.score}/${b.maxScore}`))
    console.log('\n--- Executive summary ---')
    console.log(r.executiveSummary ?? '(none)')
  }
}

main().catch(console.error)
