import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env') })
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false })

  const [nullCount, nonNullCount, sample, zeroCount] = await Promise.all([
    sql`SELECT count(*) FROM game_scores WHERE recommended_min_age IS NULL`,
    sql`SELECT count(*) FROM game_scores WHERE recommended_min_age IS NOT NULL`,
    sql`
      SELECT g.title, gs.recommended_min_age, gs.age_floor_reason,
             r.violence_level, r.sexual_content, r.trivialized,
             gs.calculated_at
      FROM game_scores gs
      JOIN games g ON g.id = gs.game_id
      LEFT JOIN reviews r ON r.id = gs.review_id
      WHERE gs.recommended_min_age IS NOT NULL
      ORDER BY gs.calculated_at DESC
      LIMIT 10
    `,
    sql`SELECT count(*) FROM game_scores WHERE recommended_min_age = 0`,
  ])

  console.log(`\n── recommended_min_age in game_scores ──\n`)
  console.log(`  NULL:     ${nullCount[0].count}`)
  console.log(`  Non-NULL: ${nonNullCount[0].count}`)
  console.log(`  = 0:      ${zeroCount[0].count}`)

  if (sample.length > 0) {
    console.log(`\n── Sample of rows WITH min_age set ──\n`)
    for (const r of sample) {
      console.log(`  ${String(r.title).slice(0, 36).padEnd(36)}  age:${r.recommended_min_age}  v:${r.violence_level}  s:${r.sexual_content}  triv:${r.trivialized}  reason:"${r.age_floor_reason}"`)
    }
  } else {
    console.log(`\n  No rows with non-NULL recommended_min_age found.\n`)
  }

  // Also check if the column even exists in recent inserts
  const recent = await sql`
    SELECT g.title, gs.recommended_min_age, gs.age_floor_reason, gs.methodology_version, gs.calculated_at
    FROM game_scores gs
    JOIN games g ON g.id = gs.game_id
    ORDER BY gs.calculated_at DESC
    LIMIT 10
  `
  console.log(`\n── 10 most recently calculated scores ──\n`)
  for (const r of recent) {
    console.log(`  ${String(r.title).slice(0, 36).padEnd(36)}  min_age:${r.recommended_min_age ?? 'NULL'}  reason:"${r.age_floor_reason ?? 'NULL'}"  calc:${new Date(r.calculated_at).toISOString().slice(0, 10)}`)
  }

  await sql.end()
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
