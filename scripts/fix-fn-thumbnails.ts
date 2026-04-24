/**
 * Re-fetches thumbnails for Fortnite Creative maps whose thumbnailUrl is
 * from img2.fortnitemaps.com (dead CDN). Extracts the island code from the
 * old URL, fetches the OG image from fortnite.gg, and updates the DB.
 * Falls back to nulling the URL if fortnite.gg has no image.
 *
 * Run with:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/fix-fn-thumbnails.ts
 */
import { db } from '@/lib/db'
import { platformExperiences, games } from '@/lib/db/schema'
import { eq, like } from 'drizzle-orm'

async function fetchOgImage(islandCode: string): Promise<string | null> {
  try {
    const res = await fetch(`https://fortnite.gg/island?code=${islandCode}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LumiKinBot/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

async function main() {
  const [fn] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, 'fortnite-creative'))
    .limit(1)

  if (!fn) { console.error('fortnite-creative not found'); process.exit(1) }

  const rows = await db
    .select({ id: platformExperiences.id, slug: platformExperiences.slug, title: platformExperiences.title, thumbnailUrl: platformExperiences.thumbnailUrl })
    .from(platformExperiences)
    .where(eq(platformExperiences.platformId, fn.id))
    .then(r => r.filter(e => e.thumbnailUrl?.includes('fortnitemaps.com')))

  console.log(`Found ${rows.length} maps with broken fortnitemaps.com thumbnails\n`)

  for (const row of rows) {
    // Extract island code: https://img2.fortnitemaps.com/6006-1872-8972_1.jpg → 6006-1872-8972
    const match = row.thumbnailUrl?.match(/\/(\d{4}-\d{4}-\d{4})_/)
    const islandCode = match?.[1]

    if (!islandCode) {
      console.log(`  ✗ ${row.title} — could not extract island code, nulling`)
      await db.update(platformExperiences).set({ thumbnailUrl: null }).where(eq(platformExperiences.id, row.id))
      continue
    }

    process.stdout.write(`  ${row.title} (${islandCode}) ... `)
    const newUrl = await fetchOgImage(islandCode)

    if (newUrl) {
      await db.update(platformExperiences).set({ thumbnailUrl: newUrl }).where(eq(platformExperiences.id, row.id))
      console.log(`✓ ${newUrl.slice(0, 60)}`)
    } else {
      await db.update(platformExperiences).set({ thumbnailUrl: null }).where(eq(platformExperiences.id, row.id))
      console.log('✗ not found, nulled')
    }
  }

  console.log('\nDone.')
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
