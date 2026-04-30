import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env') })
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false })

  const rows = await sql`
    SELECT
      g.title,
      g.slug,
      g.developer,
      g.bundled_online_note,
      g.has_stranger_chat,
      g.requires_internet,
      gs.bds, gs.ris, gs.curascore,
      gs.dopamine_risk, gs.monetization_risk, gs.social_risk,
      gs.time_rec_minutes,
      r.variable_rewards, r.infinite_play, r.escalating_commitment,
      r.stopping_barriers, r.fomo_events,
      r.spending_ceiling, r.pay_to_win,
      gs.calculated_at
    FROM games g
    JOIN game_scores gs ON gs.game_id = g.id
    LEFT JOIN reviews r ON r.id = gs.review_id
    WHERE g.developer ILIKE '%rockstar%'
       OR g.title ILIKE '%grand theft auto%'
       OR g.title ILIKE '%red dead%'
       OR g.slug ILIKE '%gta%'
       OR g.slug ILIKE '%red-dead%'
    ORDER BY g.title
  `

  console.log(`\n── Rockstar / GTA / RDR games (${rows.length} found) ──\n`)
  for (const r of rows) {
    console.log(`${r.title}`)
    console.log(`  slug: ${r.slug}  dev: ${r.developer}`)
    console.log(`  bds:${Number(r.bds).toFixed(2)}  ris:${Number(r.ris).toFixed(2)}  cura:${r.curascore}  time:${r.time_rec_minutes}min`)
    console.log(`  dopamine:${Number(r.dopamine_risk).toFixed(2)}  monetiz:${Number(r.monetization_risk).toFixed(2)}  social:${Number(r.social_risk).toFixed(2)}`)
    console.log(`  R1: varRew:${r.variable_rewards} infPlay:${r.infinite_play} escComm:${r.escalating_commitment} stopBarr:${r.stopping_barriers} fomo:${r.fomo_events}`)
    console.log(`  R2: spendCeil:${r.spending_ceiling} p2w:${r.pay_to_win}`)
    console.log(`  internet:${r.requires_internet}  strangerChat:${r.has_stranger_chat}`)
    console.log(`  bundledOnlineNote: ${r.bundled_online_note ?? '(none)'}`)
    console.log(`  scored: ${new Date(r.calculated_at).toISOString().slice(0,10)}`)
    console.log()
  }

  await sql.end()
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
