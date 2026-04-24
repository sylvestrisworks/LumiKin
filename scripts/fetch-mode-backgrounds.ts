/**
 * Fetches background images from RAWG for Fortnite game modes
 * that are missing backgroundImage in the DB.
 *
 * Run with:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/fetch-mode-backgrounds.ts
 */
import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'
import { eq } from 'drizzle-orm'

const RAWG_KEY = process.env.RAWG_API_KEY
const SLUGS = ['lego-fortnite', 'fortnite-festival', 'fortnite-rocket-racing']

// RAWG slug mappings (RAWG may use different slugs)
const RAWG_SLUGS: Record<string, string> = {
  'lego-fortnite':          'lego-fortnite',
  'fortnite-festival':      'fortnite-festival',
  'fortnite-rocket-racing': 'fortnite-rocket-racing',
}

async function fetchRawgBackground(rawgSlug: string): Promise<string | null> {
  const url = `https://api.rawg.io/api/games/${rawgSlug}?key=${RAWG_KEY}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) return null
  const data = await res.json()
  return data.background_image ?? null
}

async function main() {
  if (!RAWG_KEY) { console.error('RAWG_API_KEY not set'); process.exit(1) }

  const rows = await db
    .select({ id: games.id, slug: games.slug, title: games.title, backgroundImage: games.backgroundImage })
    .from(games)
    .where(inArray(games.slug, SLUGS))

  for (const row of rows) {
    process.stdout.write(`${row.title} ... `)

    if (row.backgroundImage) {
      console.log(`already has image, skipping`)
      continue
    }

    const rawgSlug = RAWG_SLUGS[row.slug] ?? row.slug
    const bg = await fetchRawgBackground(rawgSlug)

    if (bg) {
      await db.update(games).set({ backgroundImage: bg }).where(eq(games.id, row.id))
      console.log(`✓ ${bg.slice(0, 70)}`)
    } else {
      console.log(`✗ not found on RAWG`)
    }
  }

  console.log('\nDone.')
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
