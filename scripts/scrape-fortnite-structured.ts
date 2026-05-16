/**
 * Bulk-scrapes structured fields from fortnite.com /creative/island-codes/{code}
 * for every alive fortnite-creative platform_experiences row, persists them,
 * and marks rows needs_rescore=TRUE so the review-experiences cron reprocesses
 * them with the new inputs.
 *
 * Fortnite does NOT expose a real freeform description publicly — but the
 * page does surface: creator-written tagline, genre/feature tags, content
 * descriptors ("Moderate Violence", "Users Interact"), age rating, active
 * player count, creator follower count. These structured fields are better
 * AI-scoring inputs than the freeform description ever was.
 *
 *  ⚠️  RUN LOCALLY — REQUIRES CDP-ATTACHED CHROME  ⚠️
 *
 * SETUP:
 *   1. Quit Chrome fully.
 *   2. Launch Chrome with debugging port:
 *        & "C:\Program Files\Google\Chrome\Application\chrome.exe" `
 *          --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-cdp"
 *   3. Open https://www.fortnite.com/ once and clear any Cloudflare check.
 *
 *   node node_modules/tsx/dist/cli.cjs scripts/scrape-fortnite-structured.ts             # full alive cohort
 *   node node_modules/tsx/dist/cli.cjs scripts/scrape-fortnite-structured.ts --limit 50  # sample
 *   node node_modules/tsx/dist/cli.cjs scripts/scrape-fortnite-structured.ts --dry-run --limit 10
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'
import { chromium, type Page } from 'playwright'

const CDP_URL = process.env.CDP_URL ?? 'http://localhost:9222'
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

// Cloudflare rate-limits aggressive scraping. Empirically a fixed 1.1s delay
// burns out around row 240. Use jittered 1.5–3.5s delays plus a long cool-down
// every 100 rows and the run holds.
const DELAY_MS_MIN = 1500
const DELAY_MS_MAX = 3500
const COOLDOWN_EVERY = 100
const COOLDOWN_MS = 60_000
const MAX_CONSECUTIVE_CF = 5
const NAV_TIMEOUT = 30_000
const HYDRATE_MS  = 4500

type Structured = {
  title:              string | null
  creator:            string | null
  tagline:            string | null
  tags:               string[]
  activePlayers:      number | null
  ageRating:          string | null
  contentDescriptors: string[]
  creatorFollowers:   number | null
}

function parseAbbrevNumber(s: string): number | null {
  const m = s.match(/([\d.,]+)\s*([KMB]?)/i)
  if (!m) return null
  let n = parseFloat(m[1].replace(/,/g, ''))
  const suf = m[2]?.toUpperCase()
  if (suf === 'K') n *= 1_000
  else if (suf === 'M') n *= 1_000_000
  else if (suf === 'B') n *= 1_000_000_000
  return Number.isFinite(n) ? Math.round(n) : null
}

async function extract(page: Page, code: string): Promise<Structured | null> {
  try {
    const res = await page.goto(`https://www.fortnite.com/creative/island-codes/${code}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
    if (!res || res.status() >= 400) return null
    const t = await page.title()
    if (/just a moment|cloudflare/i.test(t)) return null
    await page.waitForTimeout(HYDRATE_MS)
  } catch { return null }

  const raw = await page.evaluate(() => {
    const bodyText = (document.body?.innerText ?? '')
    const h1 = document.querySelector('h1')?.textContent?.trim() ?? null
    const creatorLink = document.querySelector<HTMLAnchorElement>('a[href^="/@"]')
    const creator = creatorLink?.getAttribute('href')?.match(/^\/@([^/?#]+)/)?.[1] ?? null

    // Pull all quoted strings from the React Router streamed payload.
    // The outer enqueue("...") wraps the JSON, so inner JSON quotes appear
    // as \" in the source text. Match both escaped and unescaped forms so
    // we catch flat-string values regardless of nesting depth.
    const streamScript = Array.from(document.querySelectorAll('script'))
      .map(s => s.textContent ?? '')
      .filter(t => /streamController\.enqueue/.test(t))
      .join('\n')
    const unescaped = (streamScript.match(/"([^"\\\n]{2,400})"/g) || []).map(s => s.slice(1, -1))
    const escaped   = (streamScript.match(/\\"([^"\\\n]{2,400})\\"/g) || []).map(s => s.slice(2, -2))
    const streamStrings = [...unescaped, ...escaped]

    return { bodyText, h1, creator, streamStrings }
  })

  const { bodyText, h1, creator, streamStrings } = raw
  const lines = bodyText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const idxOf = (predicate: (l: string, i: number) => boolean) => lines.findIndex(predicate)

  // Descriptors block sits between "BY <creator>" and "PLAY NOW"
  const byIdx = idxOf(l => /^BY\b/i.test(l))
  const playIdx = idxOf(l => /^PLAY NOW$/i.test(l))
  const visibleDescriptors = (byIdx >= 0 && playIdx > byIdx)
    ? lines.slice(byIdx + 1, playIdx).filter(l => l.length > 0 && l.length <= 60)
    : []

  // About-block: between "About this island" and the line equal to the code
  const aboutIdx = idxOf(l => /^About this island$/i.test(l))
  const codeLineIdx = idxOf((l, i) => l === code && i > (aboutIdx ?? 0))
  const aboutBlock = (aboutIdx >= 0 && codeLineIdx > aboutIdx) ? lines.slice(aboutIdx + 1, codeLineIdx) : []

  // Tagline vs tags split. A "tag" is short, single-phrase, no terminal
  // punctuation, no leading marketing glyph. Everything else is tagline copy.
  const TAG_GLYPHS = /^[🔸✔✅✨🟢🔴🟡🟠🟣⭐💎🎯🔑🏆🎶📚👥🥳🌟🚗💾⛰️⬆️🔥💸🏃👽⚠️]/
  const isTag = (l: string) =>
    l.length <= 30 &&
    !/[.!?]$/.test(l) &&
    !/ {2}/.test(l) &&
    !TAG_GLYPHS.test(l) &&
    (l === l.toLowerCase() || l.split(' ').length <= 3)
  const tags = aboutBlock.filter(isTag)
  const taglineLines = aboutBlock.filter(l => !isTag(l))
  const tagline = taglineLines.length ? taglineLines.join('\n') : null

  // Active players: line equal to "Active", number sits one line above
  const activeIdx = idxOf((l, i) => l === 'Active' && i > codeLineIdx)
  const activePlayers = activeIdx > 0 ? parseAbbrevNumber(lines[activeIdx - 1] ?? '') : null

  // Followers
  const followersIdx = idxOf(l => /^Followers$/i.test(l))
  const creatorFollowers = followersIdx > 0 ? parseAbbrevNumber(lines[followersIdx - 1] ?? '') : null

  // ── Age rating ────────────────────────────────────────────────────────────
  // PEGI / ESRB labels appear in the streamed payload as altText next to
  // the rating image. Match common forms.
  const RATING_RE = /^(PEGI[- ]\d+|ESRB[- ](EC|E|E10\+|T|M|AO|RP)|USK[- ]\d+|ACB[- ](G|PG|M|MA15\+|R18\+)|IARC[- ]?\d+\+?)$/i
  const ageRating = streamStrings.find(s => RATING_RE.test(s.trim()))?.trim() ?? null

  // ── Content descriptors ───────────────────────────────────────────────────
  // Authoritative source: visible block between BY and PLAY NOW. Augment with
  // any well-known descriptor strings found in stream payload.
  const DESCRIPTOR_RES = [
    /^(Mild|Moderate|Strong)?\s*Violence$/i,
    /^Users Interact$/i,
    /^In-Game Purchases$/i,
    /^In-App Purchases$/i,
    /^Online Interaction.*$/i,
    /^(Mild|Strong)?\s*Bad Language$/i,
    /^Fear$/i,
    /^Horror$/i,
    /^Gambling$/i,
    /^Simulated Gambling$/i,
    /^Sex$/i,
    /^Sexual Content$/i,
    /^Discrimination$/i,
    /^Drugs$/i,
    /^Crude Humor$/i,
  ]
  const descSet = new Set<string>()
  for (const d of visibleDescriptors) if (DESCRIPTOR_RES.some(re => re.test(d))) descSet.add(d)
  for (const s of streamStrings) if (DESCRIPTOR_RES.some(re => re.test(s.trim()))) descSet.add(s.trim())

  return {
    title:              h1,
    creator,
    tagline,
    tags,
    activePlayers,
    ageRating,
    contentDescriptors: [...descSet],
    creatorFollowers,
  }
}

function isMeaningful(s: Structured): boolean {
  return !!s.tagline
      || s.tags.length > 0
      || s.activePlayers != null
      || s.contentDescriptors.length > 0
      || !!s.ageRating
}

async function main() {
  const limitIdx = process.argv.indexOf('--limit')
  const limit    = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1] ?? '50', 10) : 1300
  const dryRun   = process.argv.includes('--dry-run')

  const force = process.argv.includes('--force')
  const rows = await sql<{ id: number; place_id: string; title: string }[]>`
    SELECT pe.id, pe.place_id, pe.title
    FROM platform_experiences pe
    JOIN games g ON g.id = pe.platform_id
    WHERE g.slug = 'fortnite-creative'
      AND pe.is_public = TRUE
      AND pe.place_id ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}$'
      ${force ? sql`` : sql`AND pe.tagline IS NULL`}
    ORDER BY pe.id
    LIMIT ${limit}
  `
  console.log(`Targets: ${rows.length} (limit=${limit}, dryRun=${dryRun})`)

  console.log(`Connecting to Chrome at ${CDP_URL}…`)
  const browser = await chromium.connectOverCDP(CDP_URL)
  const ctx = browser.contexts()[0]
  if (!ctx) { console.error('No browser context. Is Chrome open with --remote-debugging-port=9222?'); process.exit(1) }
  const page = await ctx.newPage()
  await page.addInitScript(() => { (globalThis as { __name?: <T>(fn: T) => T }).__name = (fn) => fn })

  let ok = 0, fail = 0, empty = 0
  let consecutiveCf = 0
  const counts = { tagline: 0, tags: 0, activePlayers: 0, ageRating: 0, descriptors: 0, followers: 0 }

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      process.stdout.write(`  [${i + 1}/${rows.length}] ${row.place_id} ${row.title.slice(0, 45).padEnd(45)} `)
      const data = await extract(page, row.place_id)
      if (!data) {
        console.log('FAIL nav/cloudflare')
        fail++
        consecutiveCf++
        if (consecutiveCf >= MAX_CONSECUTIVE_CF) {
          console.log(`\n!! ${MAX_CONSECUTIVE_CF} consecutive Cloudflare/navigation failures — stopping. Clear the challenge in Chrome and re-run; the WHERE clause skips rows already scraped.`)
          break
        }
        await page.waitForTimeout(DELAY_MS_MIN + Math.random() * (DELAY_MS_MAX - DELAY_MS_MIN))
        continue
      }
      consecutiveCf = 0
      if (!isMeaningful(data)) {
        console.log('no meaningful data')
        empty++
        await page.waitForTimeout(DELAY_MS_MIN + Math.random() * (DELAY_MS_MAX - DELAY_MS_MIN))
        continue
      }

      if (data.tagline)              counts.tagline++
      if (data.tags.length)          counts.tags++
      if (data.activePlayers != null) counts.activePlayers++
      if (data.ageRating)            counts.ageRating++
      if (data.contentDescriptors.length) counts.descriptors++
      if (data.creatorFollowers != null) counts.followers++

      const summary = [
        data.tagline ? `tagline=${data.tagline.length}c` : null,
        data.tags.length ? `tags=${data.tags.length}` : null,
        data.activePlayers != null ? `active=${data.activePlayers}` : null,
        data.ageRating ?? null,
        data.contentDescriptors.length ? `descr=[${data.contentDescriptors.join(',').slice(0, 50)}]` : null,
      ].filter(Boolean).join(' ')
      console.log(summary)

      if (!dryRun) {
        await sql`
          UPDATE platform_experiences
          SET tagline             = ${data.tagline},
              tags                = ${data.tags.length ? sql.json(data.tags) : null},
              active_players      = COALESCE(${data.activePlayers}, active_players),
              age_rating          = ${data.ageRating},
              content_descriptors = ${data.contentDescriptors.length ? sql.json(data.contentDescriptors) : null},
              creator_followers   = ${data.creatorFollowers},
              creator_name        = COALESCE(${data.creator}, creator_name),
              needs_rescore       = TRUE,
              updated_at          = NOW()
          WHERE id = ${row.id}
        `
      }
      ok++
      await page.waitForTimeout(DELAY_MS_MIN + Math.random() * (DELAY_MS_MAX - DELAY_MS_MIN))

      // Long cool-down every COOLDOWN_EVERY processed rows — lets CF's
      // rate-limit window decay so we don't get hard-blocked.
      if ((i + 1) % COOLDOWN_EVERY === 0 && i + 1 < rows.length) {
        console.log(`  ─ cool-down ${COOLDOWN_MS / 1000}s ─`)
        await page.waitForTimeout(COOLDOWN_MS)
      }
    }
  } finally {
    console.log(`\n── Summary ──`)
    console.log(`processed=${ok} fail=${fail} empty=${empty}`)
    console.log(`field coverage:`, counts)
    if (!dryRun && ok > 0) console.log(`(rows marked needs_rescore=TRUE)`)
    await page.close().catch(() => {})
    await browser.close().catch(() => {})
    await sql.end()
  }
}

main().catch(async e => { console.error(e); await sql.end(); process.exit(1) })
