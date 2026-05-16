/**
 * Computes and persists input_confidence for every experience_scores row.
 * No AI calls — pure derivation from platformExperiences metadata using
 * the same formula as computeInputConfidence() in the scoring lib.
 *
 *   node node_modules/tsx/dist/cli.cjs scripts/backfill-input-confidence.ts            # writes + prints histogram
 *   node node_modules/tsx/dist/cli.cjs scripts/backfill-input-confidence.ts --dry-run  # histogram only
 *
 * The histogram shows how many alive rows fall below CONFIDENCE_THRESHOLD per
 * platform — that's the inventory impact of adding the "not enough info" pill.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'
import { computeInputConfidence, CONFIDENCE_THRESHOLD } from '@/lib/scoring/experience-risk'

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

type Row = {
  score_id:            number
  platform:            string
  is_public:           boolean
  description:         string | null
  tagline:             string | null
  content_descriptors: string[] | null
  tags:                string[] | null
  age_rating:          string | null
  visit_count:         number | null
  active_players:      number | null
  creator_name:        string | null
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const rows = await sql<Row[]>`
    SELECT es.id AS score_id, g.slug AS platform, pe.is_public,
           pe.description, pe.tagline, pe.content_descriptors, pe.tags,
           pe.age_rating, pe.visit_count, pe.active_players, pe.creator_name
    FROM experience_scores es
    JOIN platform_experiences pe ON pe.id = es.experience_id
    JOIN games g ON g.id = pe.platform_id
  `
  console.log(`Computing confidence for ${rows.length} scored rows${dryRun ? ' (DRY RUN)' : ''}`)

  type Bucket = { lo: number; hi: number; label: string; alive: number; total: number }
  const buckets: Bucket[] = [
    { lo: 0,    hi: 0.30, label: '[0.00–0.30)', alive: 0, total: 0 },
    { lo: 0.30, hi: 0.50, label: '[0.30–0.50)', alive: 0, total: 0 },
    { lo: 0.50, hi: 0.70, label: '[0.50–0.70)', alive: 0, total: 0 },
    { lo: 0.70, hi: 1.01, label: '[0.70–1.00]', alive: 0, total: 0 },
  ]
  const perPlatform = new Map<string, { aliveBelow: number; aliveTotal: number }>()

  for (const r of rows) {
    const conf = computeInputConfidence({
      description:        r.description,
      tagline:            r.tagline,
      contentDescriptors: r.content_descriptors,
      tags:               r.tags,
      ageRating:          r.age_rating,
      visitCount:         r.visit_count,
      activePlayers:      r.active_players,
      creatorName:        r.creator_name,
    })

    for (const b of buckets) {
      if (conf >= b.lo && conf < b.hi) {
        b.total++
        if (r.is_public) b.alive++
        break
      }
    }

    if (r.is_public) {
      const p = perPlatform.get(r.platform) ?? { aliveBelow: 0, aliveTotal: 0 }
      p.aliveTotal++
      if (conf < CONFIDENCE_THRESHOLD) p.aliveBelow++
      perPlatform.set(r.platform, p)
    }

    if (!dryRun) {
      await sql`UPDATE experience_scores SET input_confidence = ${conf} WHERE id = ${r.score_id}`
    }
  }

  console.log(`\nHistogram (alive only / total):`)
  for (const b of buckets) console.log(`  ${b.label.padEnd(14)} ${String(b.alive).padStart(5)} / ${b.total}`)

  console.log(`\nAlive rows below threshold (${CONFIDENCE_THRESHOLD}) per platform:`)
  for (const [platform, p] of [...perPlatform.entries()].sort()) {
    const pct = p.aliveTotal ? ((p.aliveBelow / p.aliveTotal) * 100).toFixed(1) : '—'
    console.log(`  ${platform.padEnd(20)} ${p.aliveBelow} / ${p.aliveTotal}  (${pct}%)`)
  }

  await sql.end()
}

main().catch(async e => { console.error(e); await sql.end(); process.exit(1) })
