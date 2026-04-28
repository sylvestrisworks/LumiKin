/**
 * Continuous RAWG game fetcher — runs in GitHub Actions (non-Vercel IP).
 *
 * Replicates the logic from /api/cron/fetch-games but executed directly from
 * the GH Actions runner so RAWG doesn't see a datacenter/cloud IP.
 *
 * Reads cursor from ingest_cursor table, fetches up to MAX_GAMES_PER_RUN new
 * games, inserts to DB, advances cursor. Identical sweep/pagination logic to
 * the original Vercel route.
 *
 * Run locally:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/fetch-games-cron.ts
 *
 * In CI, DATABASE_URL and RAWG_API_KEY must be set as environment variables.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { games, ingestCursor } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { rawgGetByGenre, rawgGetDetail, RawgError } from '@/lib/rawg/client'
import { mapDetailToInsert } from '@/lib/rawg/mapper'

// ─── Config (mirrors Vercel route) ────────────────────────────────────────────

const GENRES = [
  'action', 'adventure', 'puzzle', 'role-playing-games-rpg', 'platformer',
  'strategy', 'sports', 'simulation', 'shooter', 'racing', 'family',
  'casual', 'indie', 'fighting', 'educational', 'arcade', 'card',
]

const SWEEP_ORDERINGS: Record<number, string> = {
  1: '-metacritic',
  2: '-added',
  3: '-released',
}

const MAX_GAMES_PER_RUN   = 25
const PAGE_SIZE           = 40
const MAX_PAGES_PER_GENRE = 25
const DELAY_MS            = 400

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.RAWG_API_KEY)   { console.error('RAWG_API_KEY not set');   process.exit(1) }
  if (!process.env.DATABASE_URL)   { console.error('DATABASE_URL not set');    process.exit(1) }

  // Read cursor
  let [cursor] = await db.select().from(ingestCursor).where(eq(ingestCursor.id, 1))
  if (!cursor) {
    await db.insert(ingestCursor).values({ id: 1, genreIndex: 0, page: 1, sweep: 1, totalImported: 0 })
    cursor = { id: 1, genreIndex: 0, page: 1, sweep: 1, totalImported: 0, lastRunAt: null, updatedAt: new Date() }
  }

  let { genreIndex, page, sweep } = cursor
  console.log(`Starting at genre[${genreIndex}]=${GENRES[genreIndex]} page=${page} sweep=${sweep}`)

  // Load existing rawg IDs to skip duplicates
  const existingRawgIds = new Set(
    (await db.select({ rawgId: games.rawgId }).from(games))
      .map(r => r.rawgId)
      .filter(Boolean)
  )
  console.log(`${existingRawgIds.size} games already in DB`)

  const inserted: string[] = []
  const errors:   string[] = []
  const MAX_ITERATIONS = GENRES.length * MAX_PAGES_PER_GENRE
  let iterations = 0

  while (inserted.length < MAX_GAMES_PER_RUN && iterations < MAX_ITERATIONS) {
    iterations++
    const genre    = GENRES[genreIndex]
    const ordering = SWEEP_ORDERINGS[sweep] ?? '-metacritic'

    let listResponse
    try {
      listResponse = await rawgGetByGenre(genre, page, PAGE_SIZE, ordering)
    } catch (err) {
      const msg = err instanceof RawgError ? err.message : String(err)
      console.error(`RAWG list failed [${genre} p${page} sweep${sweep}]: ${msg}`)
      errors.push(`${genre}:p${page}`)
      page = 1
      genreIndex++
      if (genreIndex >= GENRES.length) {
        genreIndex = 0
        sweep++
        if (sweep > Object.keys(SWEEP_ORDERINGS).length) sweep = 1
      }
      break
    }

    const candidates = listResponse.results.filter(c =>
      c.esrb_rating?.slug !== 'adults-only' && !existingRawgIds.has(c.id)
    )
    const skippedCount = listResponse.results.length - candidates.length
    console.log(`[${genre} p${page}] ${candidates.length} new, ${skippedCount} already in DB`)

    for (const candidate of candidates) {
      if (inserted.length >= MAX_GAMES_PER_RUN) break
      await sleep(DELAY_MS)
      try {
        const detail = await rawgGetDetail(candidate.id)
        const data   = mapDetailToInsert(detail)
        await db.insert(games)
          .values(data)
          .onConflictDoUpdate({
            target: games.slug,
            set: {
              rawgId:             data.rawgId,
              title:              data.title,
              description:        data.description,
              developer:          data.developer,
              publisher:          data.publisher,
              backgroundImage:    data.backgroundImage,
              rawgAdded:          data.rawgAdded,
              updatedAt:          new Date(),
              metadataLastSynced: new Date(),
            },
          })
        existingRawgIds.add(candidate.id)
        inserted.push(data.slug)
        console.log(`  ✓ ${data.title}`)
      } catch (err) {
        console.error(`  ✗ ${candidate.slug}:`, err)
        errors.push(candidate.slug)
      }
    }

    // Advance cursor
    const hasMorePages = !!listResponse.next && page < MAX_PAGES_PER_GENRE
    if (!hasMorePages) {
      page = 1
      genreIndex++
      if (genreIndex >= GENRES.length) {
        genreIndex = 0
        sweep++
        if (sweep > Object.keys(SWEEP_ORDERINGS).length) sweep = 1
      }
    } else {
      page++
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    console.log('Max iterations reached — full sweep with no new games')
  }

  // Save cursor
  await db.update(ingestCursor).set({
    genreIndex,
    page,
    sweep,
    totalImported: (cursor.totalImported ?? 0) + inserted.length,
    lastRunAt:     new Date(),
    updatedAt:     new Date(),
  }).where(eq(ingestCursor.id, 1))

  const total = (cursor.totalImported ?? 0) + inserted.length
  console.log(`Done — inserted: ${inserted.length}, errors: ${errors.length}, total: ${total}`)

  process.exit(errors.length > 0 && inserted.length === 0 ? 1 : 0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
