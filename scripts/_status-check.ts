import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)

  const [games]           = await sql`SELECT COUNT(*) FROM games WHERE content_type = 'standalone_game'`
  const [platforms]       = await sql`SELECT COUNT(*) FROM games WHERE content_type = 'platform'`
  const [unreviewed]      = await sql`SELECT COUNT(*) FROM games g LEFT JOIN game_scores gs ON g.id = gs.game_id WHERE gs.curascore IS NULL AND g.content_type = 'standalone_game'`
  const [undebated]       = await sql`SELECT COUNT(*) FROM game_scores WHERE curascore IS NOT NULL AND debate_rounds IS NULL`
  const [scored]          = await sql`SELECT COUNT(*) FROM game_scores WHERE curascore IS NOT NULL`
  const [needsRescore]    = await sql`SELECT COUNT(*) FROM games WHERE needs_rescore = true`

  const translations      = await sql`SELECT locale, COUNT(*) FROM game_translations GROUP BY locale ORDER BY locale`
  const [experiences]     = await sql`SELECT COUNT(*) FROM platform_experiences`
  const [expUnreviewed]   = await sql`SELECT COUNT(*) FROM platform_experiences pe LEFT JOIN experience_scores es ON pe.id = es.experience_id WHERE es.curascore IS NULL`

  const recentRuns        = await sql`
    SELECT job_name, status, items_processed, errors, duration_ms, finished_at
    FROM cron_runs
    WHERE finished_at > NOW() - INTERVAL '24 hours'
    ORDER BY finished_at DESC
    LIMIT 30
  `

  const scoredTotal = Number(scored.count)

  console.log('\n── Games ─────────────────────────────────')
  console.log(`  Standalone games:   ${games.count}`)
  console.log(`  Platform rows:      ${platforms.count}`)
  console.log(`  Scored:             ${scoredTotal}`)
  console.log(`  Unreviewed:         ${unreviewed.count}`)
  console.log(`  Needs rescore:      ${needsRescore.count}`)
  console.log(`  Undebated:          ${undebated.count}`)

  console.log('\n── Translations ──────────────────────────')
  for (const row of translations) {
    const pct = scoredTotal > 0 ? Math.round((Number(row.count) / scoredTotal) * 100) : 0
    console.log(`  ${row.locale}:  ${row.count} / ${scoredTotal}  (${pct}%)`)
  }

  console.log('\n── Platform experiences ──────────────────')
  console.log(`  Total:              ${experiences.count}`)
  console.log(`  Unreviewed:         ${expUnreviewed.count}`)

  if (recentRuns.length > 0) {
    console.log('\n── Cron runs (last 24h) ──────────────────')
    for (const r of recentRuns) {
      const dur = r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'
      const age = r.finished_at ? `${Math.round((Date.now() - new Date(r.finished_at).getTime()) / 60000)}m ago` : '?'
      const flag = r.errors > 0 ? ` ⚠ ${r.errors} errors` : ''
      console.log(`  ${r.status.padEnd(8)} ${r.job_name.padEnd(28)} +${r.items_processed} in ${dur}  (${age})${flag}`)
    }
  } else {
    console.log('\n── Cron runs (last 24h) ──────────────────')
    console.log('  No runs recorded yet')
  }

  console.log('')
  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
