import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env') })
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false })

  const rows = await sql`
    SELECT g.slug, g.title, g.developer, g.bundled_online_note,
           gs.ris, gs.bds, gs.curascore, gs.time_rec_minutes,
           gs.dopamine_risk, gs.monetization_risk, gs.social_risk,
           r.variable_rewards, r.fomo_events, r.infinite_play,
           r.escalating_commitment, r.spending_ceiling, r.pay_to_win,
           r.stranger_risk, r.social_obligation, r.competitive_toxicity
    FROM games g
    JOIN game_scores gs ON gs.game_id = g.id
    LEFT JOIN reviews r ON r.id = gs.review_id
    WHERE g.bundled_online_note IS NOT NULL
    ORDER BY g.title
  `

  console.log(`\nGames with bundledOnlineNote set: ${rows.length}\n`)
  for (const r of rows) {
    console.log(`${r.title} (${r.developer})`)
    console.log(`  slug: ${r.slug}`)
    console.log(`  bds:${Number(r.bds).toFixed(2)}  ris:${Number(r.ris).toFixed(2)}  cura:${r.curascore}  time:${r.time_rec_minutes}min`)
    console.log(`  dopamine:${Number(r.dopamine_risk).toFixed(2)}  monetiz:${Number(r.monetization_risk).toFixed(2)}  social:${Number(r.social_risk).toFixed(2)}`)
    console.log(`  note: ${String(r.bundled_online_note).slice(0, 100)}...`)
    console.log()
  }

  await sql.end()
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
