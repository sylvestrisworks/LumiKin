/**
 * Fetches thumbnails for Fortnite Creative maps whose thumbnail_url is NULL
 * (or pointing to a dead/placeholder CDN), uploads them to Vercel Blob, and
 * updates the DB.
 *
 *  ⚠️  RUN THIS LOCALLY — REQUIRES CDP-ATTACHED CHROME  ⚠️
 *
 * Cloudflare blocks unattended Chromium. Launch your real Chrome with
 * --remote-debugging-port=9222 first, clear any Cloudflare challenge on
 * fortnite.com by hand, then run this script.
 *
 * Source: fortnite.com renders an `og:image` meta tag on every alive
 * /creative/island-codes/{code} page after redirect to /@creator/code.
 *
 *   node node_modules/tsx/dist/cli.cjs scripts/fix-fortnite-thumbnails.ts
 *
 * Requires: DATABASE_URL, BLOB_READ_WRITE_TOKEN, Chrome on CDP_URL.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'
import { chromium, type BrowserContext } from 'playwright'
import { uploadFromUrl, experienceThumbPath } from '@/lib/gcs'

const CDP_URL = process.env.CDP_URL ?? 'http://localhost:9222'
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

const DELAY_MS    = 900
const NAV_TIMEOUT = 25_000

async function fetchIslandThumb(ctx: BrowserContext, islandCode: string): Promise<string | null> {
  const page = await ctx.newPage()
  try {
    const res = await page.goto(`https://www.fortnite.com/creative/island-codes/${encodeURIComponent(islandCode)}`, {
      waitUntil: 'domcontentloaded',
      timeout:   NAV_TIMEOUT,
    })
    if (!res) return null

    await page.waitForTimeout(1500)
    try {
      await page.waitForSelector('meta[property="og:image"]', { timeout: 8_000 })
    } catch { /* fall through */ }

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
      AND pe.is_public = TRUE
      AND pe.place_id IS NOT NULL
      AND (
        pe.thumbnail_url IS NULL
        OR pe.thumbnail_url LIKE '%fortnitemaps.com%'
        OR pe.thumbnail_url LIKE '%epic-games-badge%'
      )
    ORDER BY pe.id
  `
  console.log(`${rows.length} alive maps need thumbnails`)
  if (rows.length === 0) { await sql.end(); return }

  console.log(`Connecting to Chrome at ${CDP_URL}…`)
  const browser = await chromium.connectOverCDP(CDP_URL)
  const ctx = browser.contexts()[0]
  if (!ctx) { console.error('No browser context. Is Chrome running with --remote-debugging-port=9222?'); process.exit(1) }
  await ctx.addInitScript(() => { (globalThis as { __name?: <T>(fn: T) => T }).__name = (fn) => fn })

  let ok = 0, fail = 0
  try {
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
    await browser.close().catch(() => { /* leave Chrome alive — we only attached */ })
    await sql.end()
  }
}

main().catch(async e => { console.error(e); await sql.end(); process.exit(1) })
