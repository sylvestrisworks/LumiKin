/**
 * Fix Fortnite Creative map thumbnails.
 *
 * For each map in platform_experiences (fortnite-creative platform), fetches
 * the OG image from fortnite.gg (which serves Epic CDN URLs — no hotlink issues)
 * and updates thumbnailUrl in the DB.
 *
 * Falls back to img2.fortnitemaps.com pattern if fortnite.gg returns nothing.
 *
 * Run with:
 *   npx tsx scripts/fix-fortnite-thumbnails.ts
 *
 * Requires DATABASE_URL in env (copy from .env.local).
 */

import { db } from '@/lib/db'
import { platformExperiences, games } from '@/lib/db/schema'
import { eq, isNotNull } from 'drizzle-orm'

const DELAY_MS = 1200   // stay well under any rate limit
const TIMEOUT  = 8_000

async function fetchOgImage(code: string): Promise<string | null> {
  const url = `https://fortnite.gg/island?code=${encodeURIComponent(code)}`
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LumiKin-bot/1.0; +https://lumikin.org)',
        'Accept':     'text/html',
      },
    })
    if (!res.ok) {
      console.warn(`  fortnite.gg ${res.status} for ${code}`)
      return null
    }
    const html = await res.text()

    // Prefer og:image (Epic CDN)
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
              ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (og?.[1] && og[1].startsWith('http') && !og[1].includes('fortnite.gg/static')) {
      return og[1]
    }

    // Fallback: look for the main island image in page body
    const img = html.match(/https:\/\/cdn[^"']+(?:jpg|jpeg|png|webp)/i)
    return img?.[0] ?? null
  } catch (err) {
    console.warn(`  fetch error for ${code}:`, err instanceof Error ? err.message : String(err))
    return null
  }
}

function fortnitemapsUrl(code: string): string {
  return `https://img2.fortnitemaps.com/${code}_1.jpg`
}

async function main() {
  const [platform] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, 'fortnite-creative'))
    .limit(1)

  if (!platform) {
    console.error('fortnite-creative platform row not found — run seed-fortnite.ts first')
    process.exit(1)
  }

  const maps = await db
    .select({
      id:           platformExperiences.id,
      title:        platformExperiences.title,
      placeId:      platformExperiences.placeId,
      thumbnailUrl: platformExperiences.thumbnailUrl,
    })
    .from(platformExperiences)
    .where(eq(platformExperiences.platformId, platform.id))

  console.log(`\nFixing thumbnails for ${maps.length} Fortnite Creative maps\n`)

  let updated = 0
  let skipped = 0
  let failed  = 0

  for (const map of maps) {
    if (!map.placeId) {
      console.log(`⚠  ${map.title}: no island code — skipping`)
      skipped++
      continue
    }

    process.stdout.write(`→  ${map.title} (${map.placeId}) … `)

    const ogUrl = await fetchOgImage(map.placeId)
    const finalUrl = ogUrl ?? fortnitemapsUrl(map.placeId)
    const source   = ogUrl ? 'fortnite.gg' : 'fortnitemaps.com fallback'

    await db
      .update(platformExperiences)
      .set({ thumbnailUrl: finalUrl, updatedAt: new Date() })
      .where(eq(platformExperiences.id, map.id))

    console.log(`✓ ${source}`)
    console.log(`   ${finalUrl.slice(0, 80)}`)
    updated++

    await new Promise(r => setTimeout(r, DELAY_MS))
  }

  console.log(`\nDone — updated: ${updated}, skipped: ${skipped}, failed: ${failed}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
