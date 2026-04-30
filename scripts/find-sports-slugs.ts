import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false })
  const rows = await sql`
    SELECT g.slug, g.title, gs.ris, gs.monetization_risk, gs.curascore,
           (g.bundled_online_note IS NOT NULL) as has_note
    FROM games g
    JOIN game_scores gs ON gs.game_id = g.id
    WHERE g.title ILIKE '%fifa%'
       OR g.title ILIKE '%ea sports fc%'
       OR g.title ILIKE '%nba 2k%'
       OR g.title ILIKE '%madden%'
    ORDER BY g.title, g.slug
  `
  for (const r of rows) {
    const note = r.has_note ? '✓' : '✗'
    console.log(`${note}  ${String(r.slug).padEnd(50)} ${String(r.title).slice(0,35).padEnd(36)} ris:${Number(r.ris).toFixed(2)} mon:${Number(r.monetization_risk).toFixed(2)} cura:${r.curascore}`)
  }
  await sql.end()
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
