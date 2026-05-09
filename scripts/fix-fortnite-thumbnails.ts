/**
 * Fetches thumbnails for Fortnite Creative maps whose thumbnail_url is NULL
 * (or pointing to the dead fortnitemaps.com CDN), uploads them to Vercel
 * Blob, and updates the DB.
 *
 *  ⚠️  RUN THIS LOCALLY — RESIDENTIAL IP + REAL CHROMIUM ONLY  ⚠️
 *
 * Cloudflare blocks fortnite.com from every datacenter IP we have tried
 * (Vercel functions, GitHub Actions runners). Even from a residential IP,
 * a bare `fetch` gets the JS challenge page — Cloudflare checks browser
 * fingerprint. The only thing that works is a real Chromium driving the
 * page through Playwright.
 *
 * Source: fortnite.com renders an `og:image` meta tag for every Creative
 * island page (the same URL the share-card preview uses). We let Chromium
 * resolve any Cloudflare challenge, then read the meta tag from the DOM.
 *
 *   node node_modules/tsx/dist/cli.cjs scripts/fix-fortnite-thumbnails.ts
 *
 * First run: HEADLESS=0 to watch the browser if anything goes wrong.
 * Default: headless. Polite delay between pages.
 *
 * Requires: DATABASE_URL, BLOB_READ_WRITE_TOKEN
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'
import { chromium, type Browser, type BrowserContext } from 'playwright'
import { uploadFromUrl, experienceThumbPath } from '@/lib/gcs'

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

const DELAY_MS    = 800   // between island fetches — polite + lets us look unrobotic
const NAV_TIMEOUT = 25_000

async function fetchIslandThumb(ctx: BrowserContext, islandCode: string): Promise<string | null> {
  const page = await ctx.newPage()
  try {
    const res = await page.goto(`https://www.fortnite.com/creative/island/${encodeURIComponent(islandCode)}`, {
      waitUntil: 'domcontentloaded',
      timeout:   NAV_TIMEOUT,
    })
    if (!res) return null

    // If Cloudflare challenged, the meta tag won't be there yet. Wait briefly
    // for the real page to render, then read it.
    try {
      await page.waitForSelector('meta[property="og:image"]', { timeout: 8_000 })
    } catch { /* fall through — we'll return null below */ }

    const og = await page.locator('meta[property="og:image"]').first().getAttribute('content').catch(() => null)
    if (og && og.startsWith('http')) return og

    const tw = await page.locator('meta[name="twitter:image"]').first().getAttribute('content').catch(() => null)
    if (tw && tw.startsWith('http')) return tw

    return null
  } finally {
    await page.close().catch(() => { /* ignore */ })
  }
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN not set — needed to upload thumbnails to Vercel Blob.')
    process.exit(1)
  }

  const rows = await sql<{ id: number; place_id: string; title: string }[]>`
    SELECT pe.id, pe.place_id, pe.title
    FROM platform_experiences pe
    JOIN games g ON g.id = pe.platform_id
    WHERE g.slug = 'fortnite-creative'
      AND pe.place_id IS NOT NULL
      AND (
        pe.thumbnail_url IS NULL
        OR pe.thumbnail_url LIKE '%fortnitemaps.com%'
        OR pe.thumbnail_url LIKE '%epic-games-badge%'
      )
    ORDER BY pe.id
  `
  console.log(`${rows.length} maps need thumbnails`)
  if (rows.length === 0) { await sql.end(); return }

  const headless = process.env.HEADLESS !== '0'
  console.log(`Launching Chromium (headless=${headless}) — first navigation may take a few seconds while Cloudflare challenges...`)

  let browser: Browser | null = null
  try {
    browser = await chromium.launch({ headless })
    const ctx = await browser.newContext({
      // Pretend to be a real desktop Chrome on Windows. Playwright's default
      // context already does this, but be explicit so future Playwright
      // version changes don't silently regress.
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                 '(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
    })

    let ok = 0, fail = 0
    for (const row of rows) {
      let thumbUrl: string | null = null
      try {
        thumbUrl = await fetchIslandThumb(ctx, row.place_id)
      } catch (e) {
        console.warn(`  ERR ${row.title} (${row.place_id}): ${(e as Error).message}`)
      }

      if (!thumbUrl) {
        console.warn(`  SKIP ${row.title} (${row.place_id}) — no og:image found`)
        fail++
        await new Promise(r => setTimeout(r, DELAY_MS))
        continue
      }

      const blobUrl = await uploadFromUrl(thumbUrl, experienceThumbPath('fortnite-creative', row.place_id))
      if (!blobUrl) {
        console.warn(`  SKIP ${row.title} — blob upload failed`)
        fail++
        await new Promise(r => setTimeout(r, DELAY_MS))
        continue
      }

      await sql`
        UPDATE platform_experiences
        SET thumbnail_url = ${blobUrl}, updated_at = NOW()
        WHERE id = ${row.id}
      `
      ok++
      console.log(`  ✓ ${row.title}`)

      await new Promise(r => setTimeout(r, DELAY_MS))
    }

    console.log(`\nDone — fixed: ${ok}, failed/skipped: ${fail}`)
  } finally {
    if (browser) await browser.close()
    await sql.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
