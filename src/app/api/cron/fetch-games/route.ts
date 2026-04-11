/**
 * GET /api/cron/fetch-games
 *
 * Steg 1 i ingest-pipeline:
 *   - Hämtar upp till 25 nya spel från RAWG (genre-cursor)
 *   - Laddar upp cover-bild till Vercel Blob
 *   - Sparar spel till DB (utan AI-scores)
 *
 * Körs var 30:e minut via GitHub Actions.
 * Protection: Authorization: Bearer <CRON_SECRET>
 * Max duration: 300s (Vercel Pro)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, ingestCursor } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { rawgGetByGenre, rawgGetDetail, RawgError } from '@/lib/rawg/client'
import { mapDetailToInsert } from '@/lib/rawg/mapper'
import { uploadImageFromUrl } from '@/lib/blob'

export const maxDuration = 300

// ─── Config ───────────────────────────────────────────────────────────────────

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

const MAX_GAMES_PER_RUN   = 25   // Reducerat från 200 för att hålla sig inom 300s timeout
const PAGE_SIZE           = 40
const MAX_PAGES_PER_GENRE = 25
const DELAY_MS            = 400  // Lite längre delay för att undvika RAWG rate limits

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── 1. Läs cursor ─────────────────────────────────────────────────────────
    let [cursor] = await db.select().from(ingestCursor).where(eq(ingestCursor.id, 1))
    if (!cursor) {
      await db.insert(ingestCursor).values({ id: 1, genreIndex: 0, page: 1, sweep: 1, totalImported: 0 })
      cursor = { id: 1, genreIndex: 0, page: 1, sweep: 1, totalImported: 0, lastRunAt: null, updatedAt: new Date() }
    }

    const { genreIndex, page, sweep } = cursor

    // ── 2. Hämta befintliga RAWG-IDs för att undvika dubletter ───────────────
    const existingRawgIds = new Set(
      (await db.select({ rawgId: games.rawgId }).from(games))
        .map(r => r.rawgId)
        .filter(Boolean)
    )

    const inserted: string[] = []
    const skipped:  string[] = []
    const errors:   string[] = []

    let currentPage        = page
    let currentGenreIndex  = genreIndex
    let currentSweep       = sweep
    let hasMore            = true

    // ── 3. Hämta spel tills vi har MAX_GAMES_PER_RUN nya ────────────────────
    while (inserted.length < MAX_GAMES_PER_RUN && hasMore) {
      const currentGenre    = GENRES[currentGenreIndex]
      const currentOrdering = SWEEP_ORDERINGS[currentSweep] ?? '-metacritic'

      let listResponse
      try {
        listResponse = await rawgGetByGenre(currentGenre, currentPage, PAGE_SIZE, currentOrdering)
      } catch (err) {
        const msg = err instanceof RawgError ? err.message : String(err)
        console.error(`[fetch-games] RAWG list failed for ${currentGenre} p${currentPage}: ${msg}`)
        errors.push(`${currentGenre}:p${currentPage}`)
        break
      }

      const candidates = listResponse.results.filter(c =>
        c.esrb_rating?.slug !== 'adults-only' && !existingRawgIds.has(c.id)
      )

      skipped.push(...listResponse.results
        .filter(c => existingRawgIds.has(c.id))
        .map(c => c.slug)
      )

      for (const candidate of candidates) {
        if (inserted.length >= MAX_GAMES_PER_RUN) break
        try {
          await sleep(DELAY_MS)
          const detail = await rawgGetDetail(candidate.id)
          const data   = mapDetailToInsert(detail)

          // Ladda upp cover-bild till Vercel Blob
          if (data.backgroundImage) {
            const blobUrl = await uploadImageFromUrl(data.backgroundImage, `games/${data.slug}`)
            if (blobUrl) data.backgroundImage = blobUrl
          }

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
                updatedAt:          new Date(),
                metadataLastSynced: new Date(),
              },
            })

          existingRawgIds.add(candidate.id)
          inserted.push(data.slug)
          console.log(`[fetch-games] Inserted: ${data.title}`)
        } catch (err) {
          console.error(`[fetch-games] Failed to insert ${candidate.name}:`, err)
          errors.push(candidate.slug)
        }
      }

      // ── Flytta cursor framåt ──────────────────────────────────────────────
      const hasMorePages = !!listResponse.next && currentPage < MAX_PAGES_PER_GENRE
      if (!hasMorePages) {
        currentPage = 1
        currentGenreIndex++
        if (currentGenreIndex >= GENRES.length) {
          currentGenreIndex = 0
          currentSweep++
          if (currentSweep > Object.keys(SWEEP_ORDERINGS).length) {
            currentSweep = 1
          }
        }
      } else {
        currentPage++
      }

      // Stoppa om vi gått ett helt varv utan nya spel
      if (
        currentGenreIndex === genreIndex &&
        currentSweep === sweep &&
        currentPage >= page &&
        inserted.length === 0
      ) {
        hasMore = false
      }
    }

    // ── 4. Spara cursor ───────────────────────────────────────────────────────
    await db.update(ingestCursor).set({
      genreIndex:    currentGenreIndex,
      page:          currentPage,
      sweep:         currentSweep,
      totalImported: (cursor.totalImported ?? 0) + inserted.length,
      lastRunAt:     new Date(),
      updatedAt:     new Date(),
    }).where(eq(ingestCursor.id, 1))

    console.log(`[fetch-games] Done. Inserted: ${inserted.length}, Skipped: ${skipped.length}, Errors: ${errors.length}`)

    return NextResponse.json({
      inserted: inserted.length,
      skipped:  skipped.length,
      errors:   errors.length,
      cursor: {
        nextGenreIndex: currentGenreIndex,
        nextPage:       currentPage,
        nextSweep:      currentSweep,
      },
      totalImported: (cursor.totalImported ?? 0) + inserted.length,
    })

  } catch (err) {
    console.error('[fetch-games] Fatal error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
