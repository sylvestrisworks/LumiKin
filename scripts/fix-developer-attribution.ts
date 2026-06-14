/**
 * Bulk developer-attribution correction (P1-8 follow-up).
 *
 * The old ingestion mapper stored RAWG `developers[0]` verbatim, so any title
 * whose first credited studio is a porting / co-development house was
 * mis-attributed (e.g. Minecraft → "4J Studios"). Those games are exactly the
 * ones whose STORED developer is a known porting house — found with a DB query,
 * no RAWG calls needed to enumerate them.
 *
 * For each candidate this re-fetches the live RAWG record and recomputes the
 * developer with the corrected `pickPrimaryDeveloper` (skips porting houses,
 * falls back to publisher). Genuine single-developer porting-house titles are
 * left unchanged — only real mis-attributions are corrected.
 *
 * Dry-run by default (writes a report, no DB changes). Pass --apply to update.
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/fix-developer-attribution.ts          # dry run
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/fix-developer-attribution.ts --apply  # write
 */

import { config } from 'dotenv'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
config({ path: join(process.cwd(), '.env') })

import postgres from 'postgres'
import { rawgGetDetail } from '../src/lib/rawg/client'
import { pickPrimaryDeveloper, isPortingStudio } from '../src/lib/rawg/mapper'

const APPLY = process.argv.includes('--apply')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Row = { id: number; slug: string; developer: string | null; rawg_id: number | null }

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

  const all = (await sql<Row[]>`
    SELECT id, slug, developer, rawg_id
    FROM games
    WHERE developer IS NOT NULL AND rawg_id IS NOT NULL
  `) as unknown as Row[]

  const candidates = all.filter((r) => isPortingStudio(r.developer))
  console.log(`${candidates.length} porting-house candidates of ${all.length} games`)

  const corrections: Array<{ slug: string; from: string; to: string }> = []
  const unchanged: string[] = []
  let errors = 0

  for (const r of candidates) {
    try {
      const detail = await rawgGetDetail(r.rawg_id!)
      const canonical = pickPrimaryDeveloper(detail.developers, detail.publishers)
      if (canonical && canonical !== r.developer) {
        corrections.push({ slug: r.slug, from: r.developer!, to: canonical })
        if (APPLY) {
          await sql`UPDATE games SET developer = ${canonical}, updated_at = now() WHERE id = ${r.id}`
        }
      } else {
        unchanged.push(r.slug)
      }
    } catch (e) {
      errors++
      console.error(`  ! ${r.slug}: ${e instanceof Error ? e.message : String(e)}`)
    }
    await sleep(150) // be polite to RAWG
  }

  const date = new Date().toISOString().slice(0, 10)
  const lines: string[] = []
  lines.push(`# Developer-attribution bulk correction — ${date}${APPLY ? ' (APPLIED)' : ' (dry run)'}`)
  lines.push('')
  lines.push(`- Candidates (stored developer is a porting house): **${candidates.length}**`)
  lines.push(`- Corrections ${APPLY ? 'applied' : 'proposed'}: **${corrections.length}**`)
  lines.push(`- Left unchanged (genuine single-developer porting-house titles): **${unchanged.length}**`)
  lines.push(`- RAWG fetch errors: **${errors}**`)
  lines.push('')
  if (corrections.length) {
    lines.push('| slug | From (porting house) | To (corrected) |')
    lines.push('|---|---|---|')
    for (const c of corrections) lines.push(`| ${c.slug} | ${c.from} | ${c.to} |`)
  } else {
    lines.push('_No corrections needed._')
  }
  lines.push('')

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  const out = join(process.cwd(), 'reports', `developer-attribution-fix-${date.replace(/-/g, '')}${APPLY ? '-applied' : '-dryrun'}.md`)
  writeFileSync(out, lines.join('\n'), 'utf8')
  console.log(`Wrote ${out}`)
  console.log(`${APPLY ? 'Applied' : 'Proposed'} ${corrections.length} corrections, ${unchanged.length} unchanged, ${errors} errors`)
  if (!APPLY && corrections.length) console.log('Re-run with --apply to write these changes.')

  await sql.end()
}

main().catch((err) => {
  console.error('Fix failed:', err)
  process.exit(1)
})
