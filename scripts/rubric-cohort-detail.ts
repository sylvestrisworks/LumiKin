/**
 * Supplemental: genre/popularity of early vs late cohorts, plus sample game titles.
 */
import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env') })

import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false })

  const [earlySample, lateSample, earlyMeta, lateMeta] = await Promise.all([
    sql`
      SELECT g.title, g.metacritic_score, g.rawg_added,
             gs.bds, gs.ris, gs.curascore, gs.time_rec_minutes
      FROM games g
      JOIN game_scores gs ON gs.game_id = g.id
      ORDER BY g.id ASC LIMIT 20
    `,
    sql`
      SELECT g.title, g.metacritic_score, g.rawg_added,
             gs.bds, gs.ris, gs.curascore, gs.time_rec_minutes
      FROM games g
      JOIN game_scores gs ON gs.game_id = g.id
      ORDER BY g.id DESC LIMIT 20
    `,
    sql`
      SELECT
        avg(g.metacritic_score) as avg_metacritic,
        count(*) FILTER (WHERE g.metacritic_score IS NULL) as no_metacritic,
        avg(g.rawg_added) as avg_rawg_added,
        count(*) FILTER (WHERE g.rawg_added IS NULL) as no_rawg_added,
        count(*) FILTER (WHERE g.rawg_added < 500) as low_pop,
        count(*) FILTER (WHERE g.rawg_added >= 500 AND g.rawg_added < 5000) as med_pop,
        count(*) FILTER (WHERE g.rawg_added >= 5000) as high_pop
      FROM (
        SELECT g.* FROM games g
        JOIN game_scores gs ON gs.game_id = g.id
        ORDER BY g.id ASC LIMIT 2000
      ) g
    `,
    sql`
      SELECT
        avg(g.metacritic_score) as avg_metacritic,
        count(*) FILTER (WHERE g.metacritic_score IS NULL) as no_metacritic,
        avg(g.rawg_added) as avg_rawg_added,
        count(*) FILTER (WHERE g.rawg_added IS NULL) as no_rawg_added,
        count(*) FILTER (WHERE g.rawg_added < 500) as low_pop,
        count(*) FILTER (WHERE g.rawg_added >= 500 AND g.rawg_added < 5000) as med_pop,
        count(*) FILTER (WHERE g.rawg_added >= 5000) as high_pop
      FROM (
        SELECT g.* FROM games g
        JOIN game_scores gs ON gs.game_id = g.id
        ORDER BY g.id DESC LIMIT 200
      ) g
    `,
  ])

  console.log('\n── POPULARITY (rawg_added = library additions as popularity proxy) ──\n')
  const e = earlyMeta[0], l = lateMeta[0]
  console.log(`  ${''.padEnd(26)} ${'EARLY 2000'.padEnd(18)} ${'LATE 200'.padEnd(18)}`)
  console.log(`  ${'avg metacritic'.padEnd(26)} ${Number(e.avg_metacritic).toFixed(1).padEnd(18)} ${Number(l.avg_metacritic).toFixed(1)}`)
  console.log(`  ${'no metacritic'.padEnd(26)} ${String(e.no_metacritic).padEnd(18)} ${l.no_metacritic}`)
  console.log(`  ${'avg rawg_added'.padEnd(26)} ${Number(e.avg_rawg_added).toFixed(0).padEnd(18)} ${Number(l.avg_rawg_added).toFixed(0)}`)
  console.log(`  ${'no rawg_added'.padEnd(26)} ${String(e.no_rawg_added).padEnd(18)} ${l.no_rawg_added}`)
  console.log(`  ${'low pop (<500)'.padEnd(26)} ${String(e.low_pop).padEnd(18)} ${l.low_pop}`)
  console.log(`  ${'mid pop (500-5k)'.padEnd(26)} ${String(e.med_pop).padEnd(18)} ${l.med_pop}`)
  console.log(`  ${'high pop (5k+)'.padEnd(26)} ${String(e.high_pop).padEnd(18)} ${l.high_pop}`)

  console.log('\n── EARLY COHORT: first 20 games ──\n')
  for (const r of earlySample) {
    console.log(
      `  ${String(r.title).slice(0, 36).padEnd(36)}` +
      `  meta:${String(r.metacritic_score ?? '-').padStart(4)}` +
      `  bds:${Number(r.bds).toFixed(2)}  ris:${Number(r.ris).toFixed(2)}` +
      `  cura:${String(r.curascore ?? '-').padStart(3)}` +
      `  ${r.time_rec_minutes}min`
    )
  }

  console.log('\n── LATE COHORT: most recent 20 games ──\n')
  for (const r of lateSample) {
    console.log(
      `  ${String(r.title).slice(0, 36).padEnd(36)}` +
      `  meta:${String(r.metacritic_score ?? '-').padStart(4)}` +
      `  bds:${Number(r.bds).toFixed(2)}  ris:${Number(r.ris).toFixed(2)}` +
      `  cura:${String(r.curascore ?? '-').padStart(3)}` +
      `  ${r.time_rec_minutes}min`
    )
  }

  await sql.end()
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
