import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env') })
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false })

  const rows = await sql`
    SELECT g.slug, g.title, g.developer, g.publisher,
           gs.ris, gs.curascore, gs.time_rec_minutes,
           gs.monetization_risk, gs.dopamine_risk,
           g.bundled_online_note
    FROM games g
    JOIN game_scores gs ON gs.game_id = g.id
    WHERE g.title ILIKE '%fifa%'
       OR g.title ILIKE '%ea sports fc%'
       OR g.title ILIKE '%nba 2k%'
       OR g.title ILIKE '%madden%'
    ORDER BY g.title
  `

  console.log(`\nFound ${rows.length} sports titles:\n`)
  for (const r of rows) {
    const note = r.bundled_online_note ? '✓ note set' : '— no note'
    console.log(`  ${r.title.slice(0,50).padEnd(50)}  cura:${String(r.curascore).padStart(3)}  ris:${Number(r.ris).toFixed(2)}  mon:${Number(r.monetization_risk).toFixed(2)}  ${note}`)
  }

  await sql.end()
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
