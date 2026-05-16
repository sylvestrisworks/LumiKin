/**
 * Flushes every platform_experiences row marked needs_rescore=TRUE through
 * the same AI evaluator the cron uses, but without the cron's MAX_PER_RUN
 * cap. Intended for one-shot use after a structured-field re-scrape; the
 * cron handles steady-state.
 *
 *   node node_modules/tsx/dist/cli.cjs scripts/flush-rescore-queue.ts                 # all platforms
 *   node node_modules/tsx/dist/cli.cjs scripts/flush-rescore-queue.ts --platform fortnite-creative
 *   node node_modules/tsx/dist/cli.cjs scripts/flush-rescore-queue.ts --limit 50      # cap for testing
 *
 * Concurrency=4 matches the cron. Run takes ~5–6s/row → ~1.5–2h for 1000 rows.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { buildPrompt, callGemini, saveScore, type ExperienceRow } from '@/lib/scoring/experience-evaluator'

const CONCURRENCY = 4

type Row = {
  exp:          ExperienceRow
  platformSlug: string
  oldCurascore: number | null
}

async function processOne(row: Row): Promise<{ slug: string; old: number | null; next: number; delta: number } | { slug: string; error: string }> {
  try {
    const result = await callGemini(buildPrompt(row.exp, row.platformSlug))
    const saved  = await saveScore(row.exp, result, row.platformSlug)
    await db.update(platformExperiences).set({ needsRescore: false }).where(eq(platformExperiences.id, row.exp.id))
    return { slug: row.exp.slug, old: row.oldCurascore, next: saved.curascore, delta: saved.curascore - (row.oldCurascore ?? 0) }
  } catch (e) {
    return { slug: row.exp.slug, error: (e as Error).message }
  }
}

async function main() {
  const platformIdx = process.argv.indexOf('--platform')
  const platform    = platformIdx >= 0 ? process.argv[platformIdx + 1] : null
  const limitIdx    = process.argv.indexOf('--limit')
  const limit       = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1] ?? '5000', 10) : 5000

  const rows = await db
    .select({
      exp:          platformExperiences,
      platformSlug: games.slug,
      oldCurascore: experienceScores.curascore,
    })
    .from(platformExperiences)
    .innerJoin(games, eq(games.id, platformExperiences.platformId))
    .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .where(and(
      eq(platformExperiences.needsRescore, true),
      ...(platform ? [eq(games.slug, platform)] : []),
    ))
    .orderBy(sql`${platformExperiences.id}`)
    .limit(limit)

  console.log(`Flushing ${rows.length} rows  (concurrency=${CONCURRENCY})\n`)
  if (rows.length === 0) { process.exit(0) }

  const startedAt = Date.now()
  let processed = 0, errors = 0
  const deltas: number[] = []

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY) as Row[]
    const results = await Promise.all(chunk.map(processOne))
    for (const r of results) {
      if ('error' in r) {
        errors++
        console.log(`  ✗ ${r.slug}: ${r.error.slice(0, 100)}`)
      } else {
        processed++
        deltas.push(r.delta)
        const sign = r.delta > 0 ? '+' : ''
        console.log(`  ✓ [${processed + errors}/${rows.length}] ${r.slug.padEnd(50)} ${String(r.old ?? '—').padStart(3)} → ${String(r.next).padStart(3)}  (${sign}${r.delta})`)
      }
    }
  }

  const elapsedMin = ((Date.now() - startedAt) / 60_000).toFixed(1)
  console.log(`\n── Summary (${elapsedMin} min) ──`)
  console.log(`processed=${processed}  errors=${errors}`)
  if (deltas.length > 0) {
    deltas.sort((a, b) => a - b)
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length
    const med  = deltas[Math.floor(deltas.length / 2)]
    const up   = deltas.filter(d => d > 0).length
    const flat = deltas.filter(d => d === 0).length
    const down = deltas.filter(d => d < 0).length
    console.log(`Δ curascore: mean ${mean.toFixed(1)}  median ${med}`)
    console.log(`             up=${up}  flat=${flat}  down=${down}`)
    console.log(`             min=${deltas[0]}  max=${deltas[deltas.length - 1]}`)
  }
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
