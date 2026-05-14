import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games } from '@/lib/db/schema'
import { and, eq, desc, isNotNull } from 'drizzle-orm'

async function main() {
  const [platform] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, 'fortnite-creative'))
    .limit(1)

  if (!platform) { console.error('platform not found'); process.exit(1) }

  const rows = await db
    .select({
      id: platformExperiences.id,
      title: platformExperiences.title,
      creator: platformExperiences.creatorName,
      genre: platformExperiences.genre,
      placeId: platformExperiences.placeId,
      visits: platformExperiences.visitCount,
      active: platformExperiences.activePlayers,
      description: platformExperiences.description,
      curascore: experienceScores.curascore,
      dopamine: experienceScores.dopamineTrapScore,
      tox: experienceScores.toxicityScore,
      ugc: experienceScores.ugcContentRisk,
      stranger: experienceScores.strangerRisk,
      monetization: experienceScores.monetizationScore,
      privacy: experienceScores.privacyRisk,
      creativity: experienceScores.creativityScore,
      social: experienceScores.socialScore,
      learning: experienceScores.learningScore,
      ris: experienceScores.riskScore,
      bds: experienceScores.benefitScore,
      timeMin: experienceScores.timeRecommendationMinutes,
      method: experienceScores.scoringMethod,
      version: experienceScores.methodologyVersion,
    })
    .from(experienceScores)
    .innerJoin(platformExperiences, eq(experienceScores.experienceId, platformExperiences.id))
    .where(and(eq(platformExperiences.platformId, platform.id), isNotNull(experienceScores.curascore)))
    .orderBy(desc(experienceScores.curascore))
    .limit(10)

  for (const r of rows) {
    console.log('───────────────────────────────')
    console.log(`#${r.curascore}  ${r.title}`)
    console.log(`  creator=${r.creator}  genre=${r.genre}  placeId=${r.placeId}`)
    console.log(`  visits=${r.visits?.toLocaleString?.() ?? r.visits}  active=${r.active}`)
    console.log(`  Benefits: creativity=${r.creativity} social=${r.social} learning=${r.learning}  BDS=${r.bds?.toFixed(3)}`)
    console.log(`  Risks:    dopamine=${r.dopamine} tox=${r.tox} ugc=${r.ugc} stranger=${r.stranger} money=${r.monetization} privacy=${r.privacy}  RIS=${r.ris?.toFixed(3)}`)
    console.log(`  Time: ${r.timeMin}min  method=${r.method} v=${r.version}`)
    console.log(`  Desc: ${(r.description ?? '').slice(0, 180)}`)
  }
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
