/**
 * Developer-attribution spot check (P1-8).
 *
 * Read-only. Compares each top-traffic game's stored `developer` against the
 * value the corrected RAWG mapping (pickPrimaryDeveloper, which skips porting
 * houses) would produce from the live RAWG record. Writes a diff for human
 * review — it does NOT rewrite the database.
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/audit-developer-attribution.ts
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/audit-developer-attribution.ts --limit 100
 */

import { config } from 'dotenv'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
config({ path: join(process.cwd(), '.env') })

import postgres from 'postgres'
import { rawgGetDetail } from '../src/lib/rawg/client'
import { pickPrimaryDeveloper } from '../src/lib/rawg/mapper'

function arg(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? Number(process.argv[i + 1]) : fallback
}

type Row = { slug: string; title: string; developer: string | null; rawg_id: number | null; rawg_added: number | null }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const limit = arg('--limit', 100)
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

  const rows = (await sql<Row[]>`
    SELECT slug, title, developer, rawg_id, rawg_added
    FROM games
    WHERE rawg_id IS NOT NULL
    ORDER BY rawg_added DESC NULLS LAST
    LIMIT ${limit}
  `) as unknown as Row[]

  const diffs: Array<{ slug: string; title: string; stored: string | null; canonical: string | null }> = []
  let checked = 0, errors = 0

  for (const r of rows) {
    try {
      const detail = await rawgGetDetail(r.rawg_id!)
      const canonical = pickPrimaryDeveloper(detail.developers, detail.publishers)
      checked++
      if ((canonical ?? '') !== (r.developer ?? '')) {
        diffs.push({ slug: r.slug, title: r.title, stored: r.developer, canonical })
      }
    } catch (e) {
      errors++
      console.error(`  ! ${r.slug}: ${e instanceof Error ? e.message : String(e)}`)
    }
    await sleep(150) // be polite to RAWG
  }

  const date = new Date().toISOString().slice(0, 10)
  const lines: string[] = []
  lines.push(`# Developer-attribution spot check — ${date}`)
  lines.push('')
  lines.push('Read-only (P1-8). Compares stored `developer` vs the corrected RAWG mapping')
  lines.push('(`pickPrimaryDeveloper`, which skips known porting / co-development houses).')
  lines.push('Nothing was rewritten — a reviewer should confirm and re-ingest as needed.')
  lines.push('')
  lines.push(`- Top games checked (by RAWG "added"): **${checked}**`)
  lines.push(`- Fetch errors: **${errors}**`)
  lines.push(`- Attribution diffs: **${diffs.length}**`)
  lines.push('')
  if (diffs.length === 0) {
    lines.push('_No differences — stored developers match the corrected mapping._')
  } else {
    lines.push('| Title | slug | Stored | RAWG canonical (corrected) |')
    lines.push('|---|---|---|---|')
    for (const d of diffs) {
      lines.push(`| ${d.title.replace(/\|/g, '\\|')} | ${d.slug} | ${d.stored ?? '—'} | ${d.canonical ?? '—'} |`)
    }
  }
  lines.push('')

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  const out = join(process.cwd(), 'reports', `developer-attribution-diff-${date.replace(/-/g, '')}.md`)
  writeFileSync(out, lines.join('\n'), 'utf8')
  console.log(`Wrote ${out}`)
  console.log(`  checked ${checked}, ${diffs.length} diffs, ${errors} errors`)

  await sql.end()
}

main().catch((err) => {
  console.error('Spot check failed:', err)
  process.exit(1)
})
