/**
 * Audits every fortnite-creative platform_experiences row against the live
 * fortnite.com site to find synthetic / dead island codes. Also opportunistically
 * extracts creator_name where missing.
 *
 * A real map redirects /creative/island-codes/{code} → /@{creator}/{code}
 * and renders an H1 with the title. A dead code stays on the original URL
 * (or a 404 path) and shows Fortnite's "These are not the llamas..." page.
 *
 * Requires Chrome running with CDP (see scrape-fortnite-detail.ts header).
 *
 * Modes:
 *   default       — audit only, write a CSV report; no DB changes
 *   --backfill    — also fill in creator_name where the page exposes one
 *   --mark-dead   — set is_public = false on confirmed dead rows (reversible)
 *   --limit N     — stop after N rows (default 1300)
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { writeFileSync } from 'fs'
import postgres from 'postgres'
import { chromium, type Page } from 'playwright'

const CDP_URL = process.env.CDP_URL ?? 'http://localhost:9222'
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

type Audit = {
  id:        number
  placeId:   string
  title:     string
  status:   'alive' | 'dead' | 'unknown'
  creator:   string | null
  finalUrl:  string | null
  reason:    string
}

async function classify(page: Page, code: string): Promise<{ status: Audit['status']; creator: string | null; finalUrl: string | null; reason: string }> {
  try {
    const res = await page.goto(`https://www.fortnite.com/creative/island-codes/${code}`, { waitUntil: 'domcontentloaded', timeout: 25_000 })
    if (!res) return { status: 'unknown', creator: null, finalUrl: null, reason: 'no response' }
    if (res.status() >= 500) return { status: 'unknown', creator: null, finalUrl: res.url(), reason: `HTTP ${res.status()}` }

    // Wait briefly for SPA to settle / redirect
    await page.waitForTimeout(1500)

    const probe = await page.evaluate((expected) => {
      const finalUrl = location.href
      const bodyText = document.body?.innerText ?? ''
      const llamas   = /These are not the llamas/i.test(bodyText)
      const redirectMatch = finalUrl.match(/\/@([^/?#]+)\/(\d{4}-\d{4}-\d{4})/)
      return {
        finalUrl,
        title:    document.title,
        llamas,
        creator:  redirectMatch?.[1] ?? null,
        redirectCode: redirectMatch?.[2] ?? null,
        expected,
      }
    }, code)

    if (probe.llamas) return { status: 'dead', creator: null, finalUrl: probe.finalUrl, reason: '404 llamas page' }
    if (probe.creator && probe.redirectCode === code) {
      return { status: 'alive', creator: probe.creator, finalUrl: probe.finalUrl, reason: 'redirected to /@creator/code' }
    }
    // No redirect, no llamas — title contains the code => probably alive, just no creator handle (e.g., Epic-owned)
    if (probe.title?.includes(code)) {
      return { status: 'alive', creator: null, finalUrl: probe.finalUrl, reason: 'title contains code, no creator handle' }
    }
    return { status: 'unknown', creator: null, finalUrl: probe.finalUrl, reason: `title=${probe.title?.slice(0, 60)}` }
  } catch (e) {
    return { status: 'unknown', creator: null, finalUrl: null, reason: `error: ${(e as Error).message}` }
  }
}

async function main() {
  const backfill  = process.argv.includes('--backfill')
  const markDead  = process.argv.includes('--mark-dead')
  const limitIdx  = process.argv.indexOf('--limit')
  const limit     = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1] ?? '1300', 10) : 1300

  console.log(`Mode: audit${backfill ? ' + backfill creator' : ''}${markDead ? ' + mark dead (isPublic=false)' : ''}  limit=${limit}`)

  const browser = await chromium.connectOverCDP(CDP_URL)
  const ctx = browser.contexts()[0]
  if (!ctx) { console.error('No browser context'); process.exit(1) }
  const page = await ctx.newPage()
  await page.addInitScript(() => { (globalThis as { __name?: <T>(fn: T) => T }).__name = (fn) => fn })

  const rows = await sql<{ id: number; place_id: string; title: string; creator_name: string | null }[]>`
    SELECT pe.id, pe.place_id, pe.title, pe.creator_name
    FROM platform_experiences pe
    JOIN games g ON g.id = pe.platform_id
    WHERE g.slug = 'fortnite-creative'
      AND pe.place_id ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}$'
    ORDER BY pe.id
    LIMIT ${limit}
  `
  console.log(`Auditing ${rows.length} rows…\n`)

  const results: Audit[] = []
  let alive = 0, dead = 0, unknown = 0, creatorsFilled = 0, markedDead = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const c = await classify(page, r.place_id)
    const audit: Audit = { id: r.id, placeId: r.place_id, title: r.title, status: c.status, creator: c.creator, finalUrl: c.finalUrl, reason: c.reason }
    results.push(audit)

    if (c.status === 'alive') alive++
    else if (c.status === 'dead') dead++
    else unknown++

    if (backfill && c.creator && !r.creator_name) {
      await sql`UPDATE platform_experiences SET creator_name = ${c.creator}, updated_at = NOW() WHERE id = ${r.id}`
      creatorsFilled++
    }

    if (markDead && c.status === 'dead') {
      await sql`UPDATE platform_experiences SET is_public = FALSE, updated_at = NOW() WHERE id = ${r.id}`
      markedDead++
    }

    const symbol = c.status === 'alive' ? '✓' : c.status === 'dead' ? '✗' : '?'
    if ((i + 1) % 25 === 0 || c.status !== 'alive') {
      console.log(`  ${symbol} [${i + 1}/${rows.length}] ${r.place_id} ${r.title.slice(0, 45).padEnd(45)} ${c.reason}`)
    }

    await page.waitForTimeout(900)
  }

  console.log(`\n── Summary ──`)
  console.log(`  alive:   ${alive}`)
  console.log(`  dead:    ${dead}`)
  console.log(`  unknown: ${unknown}`)
  if (backfill) console.log(`  creators backfilled: ${creatorsFilled}`)
  if (markDead) console.log(`  marked is_public=FALSE: ${markedDead}`)

  const csvPath = `fortnite-audit-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`
  const header = 'id,place_id,status,creator,title,reason\n'
  const body = results.map(r => `${r.id},${r.placeId},${r.status},${r.creator ?? ''},"${r.title.replace(/"/g, '""')}","${r.reason.replace(/"/g, '""')}"`).join('\n')
  writeFileSync(csvPath, header + body)
  console.log(`  report: ${csvPath}`)

  await page.close()
  await browser.close()
  await sql.end()
}

main().catch(async e => { console.error(e); await sql.end(); process.exit(1) })
