/**
 * Scrapes the Fortnite Creative discovery surface using a real Chromium browser
 * (Playwright) to bypass Cloudflare. Captures all panel responses and:
 *
 *   1. Updates thumbnailUrl + activePlayers for existing curated maps
 *   2. Discovers new popular islands and inserts them as unscored entries
 *
 * Run with:
 *   npx playwright install chromium --with-deps
 *   npx tsx scripts/fetch-fortnite-discovery.ts
 *
 * Requires DATABASE_URL in env.
 */

import { chromium } from 'playwright'
import { db } from '@/lib/db'
import { platformExperiences, games } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const CREATIVE_URL = 'https://www.fortnite.com/creative'
const PANEL_PATTERN = /paginated-islands\.data/

// Island code pattern for user-created maps (not Epic's own playlist_ codes)
const USER_ISLAND_CODE = /^\d{4}-\d{4}-\d{4}$/

type DiscoveryIsland = {
  title:       string
  label?:      string
  ccu?:        number
  imgSrc?:     string
  imgAlt?:     string
  islandCode:  string
  islandUrl?:  string
  hasParentalLock?: boolean
  ageRatingTextAbbr?: string
}

// Parse Remix TurboStream / JSON response — extract all objects with islandCode
function extractIslands(raw: string): DiscoveryIsland[] {
  const islands: DiscoveryIsland[] = []
  const seen = new Set<string>()

  // Strategy 1: find JSON objects containing islandCode
  const matches = raw.matchAll(/\{[^{}]*"islandCode"[^{}]*\}/g)
  for (const match of matches) {
    try {
      const obj = JSON.parse(match[0]) as DiscoveryIsland
      if (obj.islandCode && !seen.has(obj.islandCode)) {
        seen.add(obj.islandCode)
        islands.push(obj)
      }
    } catch {
      // partial match — skip
    }
  }

  // Strategy 2: if strategy 1 finds nothing, try parsing full response as JSON
  if (islands.length === 0) {
    try {
      const parsed = JSON.parse(raw)
      const candidates = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of candidates) {
        if (item?.islandCode && !seen.has(item.islandCode)) {
          seen.add(item.islandCode)
          islands.push(item as DiscoveryIsland)
        }
      }
    } catch {
      // not JSON
    }
  }

  return islands
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 255)
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport:  { width: 1920, height: 1080 },
    locale:    'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  // Hide headless signals from JS fingerprinting
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] })
  })

  const page = await context.newPage()

  // Collect all panel responses
  const allIslands: DiscoveryIsland[] = []
  const seen = new Set<string>()

  page.on('response', async (response) => {
    if (!PANEL_PATTERN.test(response.url())) return
    try {
      const text = await response.text()
      const islands = extractIslands(text)
      for (const island of islands) {
        if (!seen.has(island.islandCode)) {
          seen.add(island.islandCode)
          allIslands.push(island)
        }
      }
      console.log(`[panel] ${response.url().split('panelName=')[1]?.split('&')[0] ?? '?'} → ${islands.length} islands`)
    } catch {
      // ignore
    }
  })

  console.log('Launching browser and navigating to Fortnite Creative…')
  await page.goto(CREATIVE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })

  // Wait for Cloudflare challenge to resolve and actual content to appear.
  // The discovery grid has a data attribute or we fall back to a fixed wait.
  try {
    await page.waitForSelector('[data-testid="discovery-panel"], [class*="CreativeDiscovery"], [class*="island-card"]', { timeout: 30_000 })
    console.log('Discovery grid detected')
  } catch {
    console.log('Selector not found — waiting 20s for content to load anyway')
    await page.waitForTimeout(20_000)
  }

  // Scroll to trigger lazy-loaded panels
  console.log('Scrolling to trigger all panels…')
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5))
    await page.waitForTimeout(1500)
  }

  // Wait for any lingering requests
  await page.waitForTimeout(3000)
  await browser.close()

  console.log(`\nTotal unique islands captured: ${allIslands.length}`)
  if (allIslands.length === 0) {
    console.error('No islands found — Cloudflare may have blocked the request. Try running with PWDEBUG=1 to inspect.')
    process.exit(1)
  }

  // Look up the fortnite-creative platform row
  const [platform] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, 'fortnite-creative'))
    .limit(1)

  if (!platform) {
    console.error('fortnite-creative platform row not found')
    process.exit(1)
  }

  // Load existing curated maps keyed by island code
  const existing = await db
    .select({ id: platformExperiences.id, placeId: platformExperiences.placeId, title: platformExperiences.title, thumbnailUrl: platformExperiences.thumbnailUrl })
    .from(platformExperiences)
    .where(eq(platformExperiences.platformId, platform.id))

  const existingByCode = new Map(existing.map(e => [e.placeId, e]))

  let updatedThumbnails = 0
  let updatedCCU        = 0
  let inserted          = 0

  for (const island of allIslands) {
    const existing_ = existingByCode.get(island.islandCode)

    if (existing_) {
      // Update thumbnail + CCU for existing curated maps
      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (island.imgSrc && island.imgSrc !== existing_.thumbnailUrl) {
        updates.thumbnailUrl = island.imgSrc
        updatedThumbnails++
      }
      if (typeof island.ccu === 'number') {
        updates.activePlayers = island.ccu
        updatedCCU++
      }
      await db.update(platformExperiences).set(updates).where(eq(platformExperiences.id, existing_.id))
      console.log(`↻  ${island.title} (${island.islandCode}) — thumbnail + CCU updated`)
    } else if (USER_ISLAND_CODE.test(island.islandCode)) {
      // New user-created island — insert as unscored for the review pipeline
      let slug = slugify(island.title)
      const [collision] = await db
        .select({ id: platformExperiences.id })
        .from(platformExperiences)
        .where(eq(platformExperiences.slug, slug))
        .limit(1)
      if (collision) slug = `${slug}-${island.islandCode.replace(/-/g, '').slice(0, 8)}`

      await db.insert(platformExperiences).values({
        slug,
        platformId:    platform.id,
        placeId:       island.islandCode,
        universeId:    null,
        title:         island.title,
        description:   null,
        creatorName:   null,
        thumbnailUrl:  island.imgSrc ?? null,
        genre:         null,
        isPublic:      true,
        lastFetchedAt: new Date(),
      }).onConflictDoNothing()

      console.log(`+  ${island.title} (${island.islandCode}) — inserted as unscored`)
      inserted++
    } else {
      // Epic-owned playlist (playlist_sprout etc.) — skip, not user-created Creative maps
      console.log(`–  ${island.title} (${island.islandCode}) — Epic playlist, skipping`)
    }
  }

  console.log(`\nDone — thumbnails updated: ${updatedThumbnails}, CCU updated: ${updatedCCU}, new islands inserted: ${inserted}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
