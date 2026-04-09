/**
 * Import games from docs/games to get.txt into the DB.
 *
 * 1. Parses and deduplicates all game titles from the list
 * 2. Bulk-checks which are already in the DB (one query, in-memory compare)
 * 3. For missing games, searches RAWG and upserts the best match
 * 4. Reports a summary at the end
 *
 * After this, score everything:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/auto-review-pending.ts --provider google --limit 500
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/import-from-list.ts
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/import-from-list.ts --dry-run
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

import { readFileSync } from 'fs'
import { rawgSearch, rawgGetDetail, RawgError } from '../src/lib/rawg/client'
import type { RawgListResponse } from '../src/lib/rawg/types'
import { mapDetailToInsert } from '../src/lib/rawg/mapper'
import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { ilike, or } from 'drizzle-orm'

const dryRun = process.argv.includes('--dry-run')
const DELAY_MS = 250

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Parse the list ───────────────────────────────────────────────────────────

function parseTitles(text: string): string[] {
  const titles = new Set<string>()

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue

    // Skip section headers and emoji markers
    if (
      /^(PlayStation|Xbox|PC|Nintendo|Android|iOS|The Top)/i.test(line) ||
      /^[🟢💻🔴📱🍎]/.test(line)
    ) continue

    // Bulk list lines end with a period and contain many commas.
    // Split on commas but only at the top level (not inside parentheses).
    if (line.endsWith('.') && line.split(',').length > 3) {
      const parts = splitTopLevelCommas(line.replace(/\.$/, ''))
      for (const part of parts) {
        const t = part.trim()
        if (t && t.length > 1 && !t.startsWith('&')) titles.add(t)
      }
    } else {
      // Single-title line (top-10 entries). Strip trailing parenthetical
      // descriptions like "(Parts I & II)" or "(1, Miles Morales, & 2)".
      const t = line.replace(/\s*\(.*\)\s*$/, '').trim()
      if (t && t.length > 1) titles.add(t)
    }
  }

  return Array.from(titles).sort()
}

// Split a string on commas that are NOT inside parentheses.
function splitTopLevelCommas(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') depth--
    else if (s[i] === ',' && depth === 0) {
      parts.push(s.slice(start, i))
      start = i + 1
    }
  }
  parts.push(s.slice(start))
  return parts
}

// ─── Normalize for comparison ─────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[&]/g, 'and')
    .replace(/:\s*/g, ' ')           // "Witcher 3: Wild Hunt" → "witcher 3  wild hunt"
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ') // drop articles
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Build a set of normalized titles already in DB ──────────────────────────

async function buildDbIndex(): Promise<Set<string>> {
  const rows = await db.select({ title: games.title }).from(games)
  const index = new Set<string>()
  for (const r of rows) index.add(normalize(r.title))
  return index
}

function isInDb(title: string, index: Set<string>): boolean {
  const n = normalize(title)
  if (index.has(n)) return true
  // Also try base title before colon/dash (catches "God of War 2018" vs "God of War")
  const base = normalize(title.split(/[:\-–]/)[0].trim())
  if (base.length > 3 && index.has(base)) return true
  return false
}

// ─── RAWG search by relevance (no rating sort) ───────────────────────────────

async function rawgSearchRelevance(query: string): Promise<RawgListResponse> {
  // Use rawgSearch but override ordering — we need relevance, not rating rank.
  // We do this by building the URL manually via the public client pattern.
  // Simpler: just call rawgSearch then re-sort by title similarity ourselves —
  // but rawgSearch sorts server-side. Instead, fetch without ordering param
  // by constructing the URL directly.
  const apiKey = process.env.RAWG_API_KEY!
  const url = new URL('https://api.rawg.io/api/games')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('search', query)
  url.searchParams.set('page_size', '5')
  url.searchParams.set('search_precise', 'true')
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) throw new RawgError(`RAWG ${res.status}`, res.status)
  return res.json()
}

// Convert a game title to a likely RAWG slug
function titleToSlug(title: string): string {
  return title.toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// ─── Fetch from RAWG and upsert ───────────────────────────────────────────────

async function fetchAndInsert(title: string): Promise<'inserted' | 'updated' | 'not_found' | 'error'> {
  try {
    const normTitle = normalize(title)
    let detail

    // Strategy 1: try the slug directly (fastest, most accurate)
    const guessedSlug = titleToSlug(title)
    try {
      detail = await rawgGetDetail(guessedSlug)
      await sleep(DELAY_MS)
      // Verify it's actually the right game
      if (normalize(detail.name) !== normTitle && !normalize(detail.name).includes(normalize(title.split(':')[0].trim()))) {
        detail = undefined
      }
    } catch {
      detail = undefined
    }

    // Strategy 2: search by relevance
    if (!detail) {
      const results = await rawgSearchRelevance(title)
      await sleep(DELAY_MS)

      if (results.results.length === 0) return 'not_found'

      const pick = results.results.find(r => normalize(r.name) === normTitle)
        ?? results.results.find(r => normalize(r.name).startsWith(normalize(title.split(':')[0].trim())))
        ?? results.results[0]

      // Sanity check: reject if the RAWG result has no word overlap with the query
      const pickNorm = normalize(pick.name)
      const titleWords = normalize(title.split(/[:(]/)[0].trim()).split(' ').filter(w => w.length > 2)
      const overlap = titleWords.filter(w => pickNorm.includes(w))
      if (overlap.length === 0) {
        process.stdout.write(`(no match — RAWG returned "${pick.name}") `)
        return 'not_found'
      }

      detail = await rawgGetDetail(pick.id)
      await sleep(DELAY_MS)
    }

    const data = mapDetailToInsert(detail)

    if (dryRun) {
      console.log(`→ ${detail.name} (${data.slug})`)
      return 'inserted'
    }

    const [existing] = await db
      .select({ id: games.id })
      .from(games)
      .where(or(
        ilike(games.slug, data.slug ?? ''),
        ilike(games.title, detail.name),
      ))
      .limit(1)

    if (existing) {
      await db.update(games)
        .set({ ...data, updatedAt: new Date() })
        .where(ilike(games.slug, data.slug ?? ''))
      return 'updated'
    }

    await db.insert(games).values(data)
    return 'inserted'

  } catch (err) {
    console.error(`  ERROR: ${err instanceof Error ? err.message : String(err)}`)
    return 'error'
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║        Import games from list → DB               ║')
  console.log('╚══════════════════════════════════════════════════╝')
  if (dryRun) console.log('  [DRY RUN — no DB writes]\n')

  const text = readFileSync(resolve(process.cwd(), 'docs/games to get.txt'), 'utf-8')
  const titles = parseTitles(text)
  console.log(`  Parsed ${titles.length} unique titles from list`)

  console.log('  Loading existing DB titles…')
  const dbIndex = await buildDbIndex()
  console.log(`  DB has ${dbIndex.size} games\n`)

  const toFetch = titles.filter(t => !isInDb(t, dbIndex))
  const alreadyHave = titles.length - toFetch.length

  console.log(`  Already in DB : ${alreadyHave}`)
  console.log(`  Need to fetch : ${toFetch.length}\n`)

  if (toFetch.length === 0) {
    console.log('  Nothing to do — all games already in DB.')
    process.exit(0)
  }

  const stats = { inserted: 0, updated: 0, notFound: 0, errors: 0 }
  const notFound: string[] = []
  const errors: string[] = []

  for (let i = 0; i < toFetch.length; i++) {
    const title = toFetch[i]
    const progress = `[${String(i + 1).padStart(3)}/${toFetch.length}]`
    process.stdout.write(`  ${progress} ${title}… `)

    const result = await fetchAndInsert(title)

    if (result === 'inserted')  { console.log(dryRun ? '' : 'added');    stats.inserted++ }
    if (result === 'updated')   { console.log('updated');  stats.updated++ }
    if (result === 'not_found') { console.log('not found'); stats.notFound++; notFound.push(title) }
    if (result === 'error')     { stats.errors++; errors.push(title) }
  }

  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║                    Summary                       ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Already in DB : ${alreadyHave}`)
  console.log(`  Newly added   : ${stats.inserted}`)
  console.log(`  Updated       : ${stats.updated}`)
  console.log(`  Not on RAWG   : ${stats.notFound}`)
  console.log(`  Errors        : ${stats.errors}`)

  if (notFound.length)
    console.log(`\n  Not found on RAWG:\n${notFound.map(t => `    - ${t}`).join('\n')}`)
  if (errors.length)
    console.log(`\n  Errored:\n${errors.map(t => `    - ${t}`).join('\n')}`)

  if (!dryRun && stats.inserted > 0) {
    console.log(`\n  Next — score the new games with Google tokens:`)
    console.log(`  node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/auto-review-pending.ts --provider google --limit 500`)
  }

  process.exit(stats.errors > 0 ? 1 : 0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
