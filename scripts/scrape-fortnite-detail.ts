/**
 * Backfills description, creator, and play-count metadata for Fortnite
 * Creative experiences by visiting each island's public page on fortnite.com
 * via Chrome CDP-attach (same pattern as scrape-fortnite-discover.ts).
 *
 * Headless / Node fetch is Cloudflare-blocked. This script connects to
 * YOUR running Chrome.
 *
 *  ⚠️  RUN THIS LOCALLY  ⚠️
 *
 * SETUP:
 *  1. Quit Chrome fully.
 *  2. Launch Chrome with the debugging port (PowerShell):
 *       & "C:\Program Files\Google\Chrome\Application\chrome.exe" `
 *         --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-cdp"
 *  3. Open https://www.fortnite.com/ once and clear any Cloudflare check.
 *  4. Run probe mode first to confirm what fields the page exposes:
 *       node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/scrape-fortnite-detail.ts --probe 9510-8463-0252
 *  5. Then bulk-backfill:
 *       node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/scrape-fortnite-detail.ts
 *       node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/scrape-fortnite-detail.ts --limit 50
 *       node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/scrape-fortnite-detail.ts --dry-run --limit 5
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'
import { chromium, type Page } from 'playwright'

const CDP_URL = process.env.CDP_URL ?? 'http://localhost:9222'
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

// fortnite.com uses /creative/island-codes/{code} as the canonical code-only URL
// (the existing discover scraper picks up both this and /@creator/{code}).
const islandUrl = (code: string) => `https://www.fortnite.com/creative/island-codes/${code}`

type Detail = {
  code:         string
  description:  string | null
  creator:      string | null
  playCount:    number | null
  favourites:   number | null
  ogTitle:      string | null
  ogImage:      string | null
  raw:          Record<string, string | null>   // every meta we found, for probe
}

// Runs in the page context — keep self-contained, no closures.
async function extractDetail(page: Page, code: string): Promise<Detail> {
  // Wait for SPA to mount; meta tags are SSR'd but client-side hydration
  // populates the visible play count / creator block.
  await page.waitForLoadState('domcontentloaded')
  // Try to wait for SOME meta description, but don't fail hard if missing.
  await page.waitForTimeout(2500)

  const data = await page.evaluate(() => {
    const metaContent = (name: string): string | null => {
      const el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`)
      return el?.getAttribute('content')?.trim() || null
    }

    // Visible play / favourite counts vary by page version; grab anything
    // that looks like "Plays" or "Favourites" with an adjacent number.
    const visibleNumber = (labelRegex: RegExp): number | null => {
      const labels = Array.from(document.querySelectorAll<HTMLElement>('*'))
        .filter(e => labelRegex.test((e.textContent ?? '').trim()) && e.children.length === 0)
      for (const lab of labels) {
        const sib = lab.parentElement?.querySelector<HTMLElement>('span, strong, b')
        const txt = (sib?.textContent ?? lab.parentElement?.textContent ?? '').trim()
        const m = txt.match(/([\d,.]+)\s*([KMB]?)/i)
        if (!m) continue
        let n = parseFloat(m[1].replace(/,/g, ''))
        const suffix = m[2]?.toUpperCase()
        if (suffix === 'K') n *= 1_000
        else if (suffix === 'M') n *= 1_000_000
        else if (suffix === 'B') n *= 1_000_000_000
        if (Number.isFinite(n)) return Math.round(n)
      }
      return null
    }

    const raw: Record<string, string | null> = {
      'og:title':        metaContent('og:title'),
      'og:description':  metaContent('og:description'),
      'og:image':        metaContent('og:image'),
      'og:url':          metaContent('og:url'),
      'description':     metaContent('description'),
      'twitter:title':   metaContent('twitter:title'),
      'twitter:description': metaContent('twitter:description'),
      'twitter:image':   metaContent('twitter:image'),
    }

    // Creator: usually in an <a href="/@creator/CODE"> link near the title
    let creator: string | null = null
    const creatorLink = document.querySelector<HTMLAnchorElement>('a[href^="/@"]')
    if (creatorLink) {
      const m = creatorLink.getAttribute('href')?.match(/^\/@([^/?#]+)/)
      creator = m?.[1] ?? null
    }

    return {
      description: raw['og:description'] || raw['description'] || raw['twitter:description'] || null,
      creator,
      playCount:  visibleNumber(/^plays?$/i) ?? visibleNumber(/total\s*plays?/i),
      favourites: visibleNumber(/^favorites?$|^favourites?$/i),
      ogTitle:    raw['og:title'],
      ogImage:    raw['og:image'],
      raw,
    }
  })

  return { code, ...data }
}

async function navigateTo(page: Page, code: string): Promise<boolean> {
  try {
    const res = await page.goto(islandUrl(code), { waitUntil: 'domcontentloaded', timeout: 30_000 })
    if (!res) return false
    if (res.status() >= 400) {
      console.warn(`  ${code}: HTTP ${res.status()}`)
      return false
    }
    // Detect Cloudflare challenge — if it shows up, bail loudly.
    const title = await page.title()
    if (/just a moment|cloudflare/i.test(title)) {
      console.error(`  ${code}: Cloudflare challenge active in your Chrome session. Open fortnite.com manually and clear it.`)
      return false
    }
    return true
  } catch (e) {
    console.warn(`  ${code}: navigation error — ${(e as Error).message}`)
    return false
  }
}

async function probeOne(code: string) {
  console.log(`Connecting to Chrome at ${CDP_URL}…`)
  const browser = await chromium.connectOverCDP(CDP_URL)
  const ctx = browser.contexts()[0]
  if (!ctx) throw new Error('No browser context — is Chrome open with --remote-debugging-port=9222?')

  const page = await ctx.newPage()
  await page.addInitScript(() => { (globalThis as { __name?: <T>(fn: T) => T }).__name = (fn) => fn })

  console.log(`\n→ ${islandUrl(code)}`)
  if (!(await navigateTo(page, code))) { await page.close(); await browser.close(); process.exit(1) }

  const detail = await extractDetail(page, code)
  console.log('\n── Extracted fields ──')
  console.log(JSON.stringify(detail, null, 2))

  await page.close()
  await browser.close()
  await sql.end()
}

async function bulkBackfill(opts: { limit: number; dryRun: boolean }) {
  console.log(`Connecting to Chrome at ${CDP_URL}…`)
  const browser = await chromium.connectOverCDP(CDP_URL)
  const ctx = browser.contexts()[0]
  if (!ctx) throw new Error('No browser context — is Chrome open with --remote-debugging-port=9222?')

  const page = await ctx.newPage()
  await page.addInitScript(() => { (globalThis as { __name?: <T>(fn: T) => T }).__name = (fn) => fn })

  const rows = await sql<{ id: number; place_id: string; title: string }[]>`
    SELECT pe.id, pe.place_id, pe.title
    FROM platform_experiences pe
    JOIN games g ON g.id = pe.platform_id
    WHERE g.slug = 'fortnite-creative'
      AND pe.is_public = TRUE
      AND (pe.description IS NULL OR length(pe.description) < 20)
      AND pe.place_id ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}$'
    ORDER BY pe.id
    LIMIT ${opts.limit}
  `

  console.log(`Targets: ${rows.length} (limit=${opts.limit}, dryRun=${opts.dryRun})\n`)

  let ok = 0, fail = 0, withDesc = 0, withCreator = 0, withPlays = 0

  for (const row of rows) {
    process.stdout.write(`  [${row.place_id}] ${row.title.slice(0, 50).padEnd(50)} `)
    if (!(await navigateTo(page, row.place_id))) { fail++; console.log(''); continue }

    let detail: Detail
    try {
      detail = await extractDetail(page, row.place_id)
    } catch (e) {
      console.log(`extract error: ${(e as Error).message}`)
      fail++
      continue
    }

    const updates: string[] = []
    if (detail.description) { withDesc++; updates.push(`desc=${detail.description.slice(0, 40)}…`) }
    if (detail.creator)     { withCreator++; updates.push(`creator=${detail.creator}`) }
    if (detail.playCount)   { withPlays++; updates.push(`plays=${detail.playCount}`) }

    console.log(updates.length ? updates.join('  ') : 'no new data')

    if (!opts.dryRun && (detail.description || detail.creator || detail.playCount)) {
      await sql`
        UPDATE platform_experiences
        SET description   = COALESCE(${detail.description}, description),
            creator_name  = COALESCE(${detail.creator},      creator_name),
            visit_count   = COALESCE(${detail.playCount},    visit_count),
            needs_rescore = TRUE,
            updated_at    = NOW()
        WHERE id = ${row.id}
      `
    }
    ok++

    // Throttle so we don't hammer Cloudflare
    await page.waitForTimeout(1200)
  }

  console.log(`\nDone — processed=${ok} fail=${fail}  fields: desc=${withDesc} creator=${withCreator} plays=${withPlays}`)
  if (!opts.dryRun && ok > 0) console.log('Updated rows are marked needs_rescore=TRUE — the review-experiences cron will reprocess them.')

  await page.close()
  await browser.close()
  await sql.end()
}

async function main() {
  const probeIdx = process.argv.indexOf('--probe')
  if (probeIdx >= 0) {
    const code = process.argv[probeIdx + 1]
    if (!code) { console.error('--probe requires an island code'); process.exit(1) }
    await probeOne(code)
    return
  }

  const limitIdx = process.argv.indexOf('--limit')
  const limit    = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1] ?? '50', 10) : 1200
  const dryRun   = process.argv.includes('--dry-run')

  await bulkBackfill({ limit, dryRun })
}

main().catch(async e => { console.error(e); await sql.end(); process.exit(1) })
