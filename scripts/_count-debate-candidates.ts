import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)

  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE ABS(gs.curascore - g.metacritic_score) >= 25) AS div25,
      COUNT(*) FILTER (WHERE ABS(gs.curascore - g.metacritic_score) >= 20) AS div20,
      COUNT(*) FILTER (WHERE ABS(gs.curascore - g.metacritic_score) >= 30) AS div30,
      COUNT(*) FILTER (WHERE ABS(gs.curascore - g.metacritic_score) >= 25 AND gs.curascore > g.metacritic_score) AS we_rate_higher,
      COUNT(*) FILTER (WHERE ABS(gs.curascore - g.metacritic_score) >= 25 AND gs.curascore < g.metacritic_score) AS we_rate_lower
    FROM games g
    INNER JOIN game_scores gs ON gs.game_id = g.id
    WHERE gs.curascore IS NOT NULL
      AND g.metacritic_score IS NOT NULL
      AND g.metacritic_score >= 50
      AND gs.debate_rounds IS NULL
  `

  const r = rows[0]
  console.log('Debate candidates by divergence threshold:')
  console.log(`  ≥20 pts:  ${r.div20}`)
  console.log(`  ≥25 pts:  ${r.div25}  (default)`)
  console.log(`  ≥30 pts:  ${r.div30}`)
  console.log('')
  console.log('Direction breakdown (≥25):')
  console.log(`  We rate HIGHER than critics:  ${r.we_rate_higher}`)
  console.log(`  We rate LOWER than critics:   ${r.we_rate_lower}`)

  const top = await sql`
    SELECT g.title, gs.curascore, g.metacritic_score,
      (gs.curascore - g.metacritic_score) AS gap
    FROM games g
    INNER JOIN game_scores gs ON gs.game_id = g.id
    WHERE gs.curascore IS NOT NULL
      AND g.metacritic_score IS NOT NULL
      AND g.metacritic_score >= 50
      AND gs.debate_rounds IS NULL
      AND ABS(gs.curascore - g.metacritic_score) >= 25
    ORDER BY ABS(gs.curascore - g.metacritic_score) DESC
    LIMIT 10
  `
  console.log('\nTop 10 most divergent:')
  for (const row of top) {
    const dir = Number(row.gap) > 0 ? `+${row.gap}` : String(row.gap)
    console.log(`  ${String(row.title).padEnd(40)} curascore=${row.curascore}  metacritic=${row.metacritic_score}  gap=${dir}`)
  }

  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
