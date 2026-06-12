/**
 * Roblox catalogue outlier audit (P0-3).
 *
 * Read-only. No DB writes, no LLM calls, no silent rescoring — it only reports.
 *
 * Scans every Roblox experience that currently carries a score and flags:
 *   1. Quality-floor violations — exploit tooling, junk titles, junk creators,
 *      and below-visit-floor entries (per src/lib/scoring/quality-floor.ts).
 *   2. Score↔engagement outliers — the "very high LumiScore + very low
 *      engagement" smell that surfaced "[Place 1] Lua Script Execution" at 80.
 *
 * Output: reports/roblox-outlier-audit-{YYYYMMDD}.md  (committed for review).
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/audit-roblox-outliers.ts
 */

import { config } from 'dotenv'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
config({ path: join(process.cwd(), '.env') })

import postgres from 'postgres'
import { passesListingQualityFloor, MIN_VISITS_FOR_LISTING } from '../src/lib/scoring/quality-floor'

// A scored experience this popular-or-less, yet rated this highly, is suspicious.
const HIGH_SCORE = 70
const LOW_VISITS = 50_000

type Row = {
  slug: string
  title: string
  creator_name: string | null
  visit_count: number | null
  active_players: number | null
  curascore: number | null
  input_confidence: number | null
  scoring_method: string | null
  time_rec_minutes: number | null
}

const fmt = (n: number | null | undefined): string =>
  n == null ? '—' : n.toLocaleString('en')

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

  const rows = (await sql<Row[]>`
    SELECT pe.slug, pe.title, pe.creator_name, pe.visit_count, pe.active_players,
           es.curascore, es.input_confidence, es.scoring_method, es.time_rec_minutes
    FROM platform_experiences pe
    JOIN games g ON g.id = pe.platform_id AND g.slug = 'roblox'
    LEFT JOIN experience_scores es ON es.experience_id = pe.id
    ORDER BY es.curascore DESC NULLS LAST, pe.visit_count DESC NULLS LAST
  `) as unknown as Row[]

  const scored = rows.filter(r => r.curascore != null)

  const floorViolations = rows
    .map(r => ({ r, res: passesListingQualityFloor({
      title: r.title, creatorName: r.creator_name, visitCount: r.visit_count, activePlayers: r.active_players,
    }) }))
    .filter(x => !x.res.ok) as Array<{ r: Row; res: { ok: false; reason: string } }>

  const engagementOutliers = scored.filter(r =>
    (r.curascore ?? 0) >= HIGH_SCORE
    && r.visit_count != null
    && r.visit_count < LOW_VISITS
    // don't double-report things the floor already removes
    && passesListingQualityFloor({ title: r.title, creatorName: r.creator_name, visitCount: r.visit_count, activePlayers: r.active_players }).ok,
  )

  const byReason = (reason: string) => floorViolations.filter(x => x.res.reason === reason)

  const date = new Date().toISOString().slice(0, 10)
  const lines: string[] = []
  lines.push(`# Roblox catalogue outlier audit — ${date}`)
  lines.push('')
  lines.push('Read-only audit (P0-3). No rows were rescored or modified. Each section')
  lines.push('lists experiences a human reviewer should action.')
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Total Roblox experiences: **${rows.length}**`)
  lines.push(`- Scored experiences: **${scored.length}**`)
  lines.push(`- Quality-floor violations (hidden from listing): **${floorViolations.length}**`)
  lines.push(`  - exploit tooling: ${byReason('exploit_tooling').length}`)
  lines.push(`  - junk title: ${byReason('junk_title').length}`)
  lines.push(`  - junk creator: ${byReason('junk_creator').length}`)
  lines.push(`  - below ${MIN_VISITS_FOR_LISTING.toLocaleString('en')} visits: ${byReason('below_visit_floor').length}`)
  lines.push(`- Score↔engagement outliers (LumiScore ≥ ${HIGH_SCORE} with < ${LOW_VISITS.toLocaleString('en')} visits, not already floored): **${engagementOutliers.length}**`)
  lines.push('')

  const table = (title: string, rs: Row[]) => {
    lines.push(`## ${title} (${rs.length})`)
    lines.push('')
    if (rs.length === 0) { lines.push('_None._'); lines.push(''); return }
    lines.push('| LumiScore | Visits | Active | Title | Creator | Method | slug |')
    lines.push('|---:|---:|---:|---|---|---|---|')
    for (const r of rs) {
      lines.push(`| ${fmt(r.curascore)} | ${fmt(r.visit_count)} | ${fmt(r.active_players)} | ${r.title.replace(/\|/g, '\\|')} | ${(r.creator_name ?? '—').replace(/\|/g, '\\|')} | ${r.scoring_method ?? '—'} | ${r.slug} |`)
    }
    lines.push('')
  }

  table('Exploit tooling (denylist — must be quarantined)', byReason('exploit_tooling').map(x => x.r))
  table('Junk titles', byReason('junk_title').map(x => x.r))
  table('Junk creators', byReason('junk_creator').map(x => x.r))
  table(`Below visit floor (< ${MIN_VISITS_FOR_LISTING.toLocaleString('en')})`, byReason('below_visit_floor').map(x => x.r))
  table('Score↔engagement outliers (review scores)', engagementOutliers)

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  const outPath = join(process.cwd(), 'reports', `roblox-outlier-audit-${date.replace(/-/g, '')}.md`)
  writeFileSync(outPath, lines.join('\n'), 'utf8')

  console.log(`Wrote ${outPath}`)
  console.log(`  ${rows.length} experiences, ${floorViolations.length} floor violations, ${engagementOutliers.length} engagement outliers`)

  await sql.end()
}

main().catch((err) => {
  console.error('Audit failed:', err)
  process.exit(1)
})
