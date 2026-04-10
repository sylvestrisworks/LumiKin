/**
 * Import ~500 popular games from RAWG as the initial PlaySmart catalog.
 *
 * Strategy:
 *   1. For each of 6 genres, fetch up to 3 pages (40 games/page = 120/genre)
 *   2. Deduplicate across genres by RAWG ID
 *   3. Skip games rated AO (Adults Only) — include E, E10+, T, M, and unrated
 *   4. For each unique qualifying game, fetch full details from RAWG
 *   5. Upsert into the games table
 *   6. Log progress throughout
 *
 * Runtime: ~3–5 minutes (500 detail requests + list requests, 150ms apart)
 *
 * Usage: npx tsx scripts/import-rawg.ts
 */

// Load env vars before ANY other imports — must be first
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

import { rawgGetByGenre, rawgGetByTag, rawgGetDetail, RawgError } from '../src/lib/rawg/client'
import { mapDetailToInsert } from '../src/lib/rawg/mapper'
import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { RawgGameSummary } from '../src/lib/rawg/types'
import { uploadImageFromUrl } from '../src/lib/blob'

// ─── Configuration ────────────────────────────────────────────────────────────

const GENRES: Array<{ slug: string; label: string }> = [
  { slug: 'action',                    label: 'Action'     },
  { slug: 'adventure',                 label: 'Adventure'  },
  { slug: 'puzzle',                    label: 'Puzzle'     },
  { slug: 'role-playing-games-rpg',    label: 'RPG'        },
  { slug: 'platformer',                label: 'Platformer' },
  { slug: 'strategy',                  label: 'Strategy'   },
]

const TAGS: Array<{ slug: string; label: string }> = [
  { slug: 'virtual-reality',           label: 'VR'         },
]

const PAGES_PER_GENRE = 3      // 3 × 40 = 120 candidates per genre
const PAGES_PER_TAG   = 5      // 5 × 40 = 200 VR candidates
const PAGE_SIZE = 40           // RAWG max
const REQUEST_DELAY_MS = 150   // ~6 req/s — well within RAWG limits
const TARGET_GAME_COUNT = 650  // 500 genre + ~150 VR tag

// Include E, E10+, T, M, and unrated (null). Exclude Adults Only.
const EXCLUDED_RATINGS = new Set(['AO'])

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function isQualifyingRating(esrbSlug: string | null | undefined): boolean {
  if (!esrbSlug) return true // unrated games are included
  const ESRB_AO_SLUG = 'adults-only'
  return esrbSlug !== ESRB_AO_SLUG
}

function formatElapsed(startMs: number): string {
  const secs = Math.round((Date.now() - startMs) / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ─── DB upsert (duplicated from rawg/index.ts to avoid DB singleton conflicts) ──

type GameInsert = typeof games.$inferInsert

async function upsertGame(data: GameInsert): Promise<void> {
  if (data.rawgId == null) return

  const [existing] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.rawgId, data.rawgId))
    .limit(1)

  if (existing) {
    await db.update(games)
      .set({
        title:              data.title,
        description:        data.description,
        developer:          data.developer,
        publisher:          data.publisher,
        releaseDate:        data.releaseDate,
        genres:             data.genres,
        platforms:          data.platforms,
        esrbRating:         data.esrbRating,
        metacriticScore:    data.metacriticScore,
        avgPlaytimeHours:   data.avgPlaytimeHours,
        backgroundImage:    data.backgroundImage,
        hasMicrotransactions: data.hasMicrotransactions,
        hasLootBoxes:       data.hasLootBoxes,
        hasSubscription:    data.hasSubscription,
        hasBattlePass:      data.hasBattlePass,
        updatedAt:          new Date(),
        metadataLastSynced: new Date(),
      })
      .where(eq(games.id, existing.id))
  } else {
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
          updatedAt:          new Date(),
          metadataLastSynced: new Date(),
        },
      })
  }
}

// ─── Step 1: Collect candidates ───────────────────────────────────────────────

async function collectCandidates(): Promise<Map<number, RawgGameSummary>> {
  const candidates = new Map<number, RawgGameSummary>()

  for (const genre of GENRES) {
    console.log(`\n  Genre: ${genre.label}`)

    for (let page = 1; page <= PAGES_PER_GENRE; page++) {
      process.stdout.write(`    Page ${page}/${PAGES_PER_GENRE}… `)

      try {
        const response = await rawgGetByGenre(genre.slug, page, PAGE_SIZE)
        let added = 0

        for (const game of response.results) {
          if (!candidates.has(game.id) && isQualifyingRating(game.esrb_rating?.slug)) {
            candidates.set(game.id, game)
            added++
          }
        }

        console.log(`+${added} games (${candidates.size} unique so far)`)

        if (!response.next) {
          console.log(`    No more pages for ${genre.label}`)
          break
        }
      } catch (err) {
        const msg = err instanceof RawgError ? err.message : String(err)
        console.error(`    ERROR: ${msg}`)
      }

      await sleep(REQUEST_DELAY_MS)

      if (candidates.size >= TARGET_GAME_COUNT * 1.5) {
        console.log(`    Reached collection ceiling — stopping early`)
        break
      }
    }
  }

  for (const tag of TAGS) {
    console.log(`\n  Tag: ${tag.label}`)

    for (let page = 1; page <= PAGES_PER_TAG; page++) {
      process.stdout.write(`    Page ${page}/${PAGES_PER_TAG}… `)

      try {
        const response = await rawgGetByTag(tag.slug, page, PAGE_SIZE)
        let added = 0

        for (const game of response.results) {
          if (!candidates.has(game.id) && isQualifyingRating(game.esrb_rating?.slug)) {
            candidates.set(game.id, game)
            added++
          }
        }

        console.log(`+${added} games (${candidates.size} unique so far)`)

        if (!response.next) {
          console.log(`    No more pages for ${tag.label}`)
          break
        }
      } catch (err) {
        const msg = err instanceof RawgError ? err.message : String(err)
        console.error(`    ERROR: ${msg}`)
      }

      await sleep(REQUEST_DELAY_MS)
    }
  }

  return candidates
}

// ─── Step 2: Fetch details and import ────────────────────────────────────────

async function importGames(candidates: Map<number, RawgGameSummary>): Promise<{
  imported: number
  skipped: number
  errors: number
}> {
  // Trim to target count, ordered by ratings_count (most popular first)
  const sorted = Array.from(candidates.values())
    .sort((a, b) => b.ratings_count - a.ratings_count)
    .slice(0, TARGET_GAME_COUNT)

  let imported = 0
  let skipped = 0
  let errors = 0
  const startMs = Date.now()

  console.log(`\n  Importing ${sorted.length} games…\n`)

  for (let i = 0; i < sorted.length; i++) {
    const summary = sorted[i]
    const progress = `[${String(i + 1).padStart(3)}/${sorted.length}]`
    const esrb = summary.esrb_rating?.name ?? 'Unrated'

    process.stdout.write(`  ${progress} ${summary.name} (${esrb})… `)

    try {
      const detail = await rawgGetDetail(summary.id)
      const data = mapDetailToInsert(detail)
      // Upload image to Vercel Blob (no-op if BLOB_READ_WRITE_TOKEN not set)
      if (data.backgroundImage) {
        const blobUrl = await uploadImageFromUrl(data.backgroundImage, `games/${data.slug}`)
        if (blobUrl) data.backgroundImage = blobUrl
      }
      await upsertGame(data)
      imported++
      console.log(`✓  (${formatElapsed(startMs)} elapsed)`)
    } catch (err) {
      errors++
      const msg = err instanceof RawgError
        ? `RAWG ${err.status}: ${err.message}`
        : String(err)
      console.error(`✗  ${msg}`)
    }

    // Progress summary every 50 games
    if ((i + 1) % 50 === 0) {
      console.log(
        `\n  ── ${i + 1}/${sorted.length} processed │ ${imported} imported, ${errors} errors ──\n`
      )
    }

    await sleep(REQUEST_DELAY_MS)
  }

  return { imported, skipped, errors }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║       PlaySmart — RAWG Import Script             ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Target: ~${TARGET_GAME_COUNT} games across ${GENRES.length} genres + ${TAGS.length} tag(s) (incl. VR)`)
  console.log(`  ESRB filter: E, E10+, T, M (AO excluded; unrated included)`)
  console.log(`  Request delay: ${REQUEST_DELAY_MS}ms\n`)

  if (!process.env.RAWG_API_KEY) {
    console.error('ERROR: RAWG_API_KEY is not set in .env.local')
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set in .env.local')
    process.exit(1)
  }

  const collectStart = Date.now()
  console.log('Step 1: Collecting game candidates from RAWG…')
  const candidates = await collectCandidates()
  console.log(
    `\n  Collected ${candidates.size} unique qualifying games in ${formatElapsed(collectStart)}`
  )

  const importStart = Date.now()
  console.log('\nStep 2: Fetching full details and importing to database…')
  const { imported, skipped, errors } = await importGames(candidates)

  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║                   Import complete                ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Imported : ${imported}`)
  console.log(`  Skipped  : ${skipped}`)
  console.log(`  Errors   : ${errors}`)
  console.log(`  Duration : ${formatElapsed(importStart)}`)
  console.log()

  process.exit(errors > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
