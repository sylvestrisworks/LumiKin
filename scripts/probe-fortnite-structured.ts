/**
 * Probes a list of Fortnite Creative island pages to extract structured fields
 * (tagline, genre tags, active players, PEGI rating, content descriptors,
 * creator handle) and prints JSON. No DB writes — discovery only.
 *
 * Requires Chrome on CDP_URL.
 *
 *   node node_modules/tsx/dist/cli.cjs scripts/probe-fortnite-structured.ts <code> [<code> ...]
 *
 * If no codes are passed, probes a default set across genres.
 */

import { chromium, type Page } from 'playwright'

const CDP_URL = process.env.CDP_URL ?? 'http://localhost:9222'

const DEFAULT_CODES = [
  '7578-1606-3889', // College RP (RP)
  '6562-8953-6567', // Pandvil Box Fight (PvP)
  '2303-5731-9714', // SURVIVE AVALANCHE FOR BRAINROTS (tycoon-ish)
  '6586-8735-3733', // Infinity Tower Tycoon (tycoon)
  '2559-8530-8915', // EDIT AIM PIECE PRACTICE (training)
]

type Extracted = {
  code:            string
  title:           string | null
  creator:         string | null
  tagline:         string | null   // "About this island" lines, joined
  tags:            string[]
  activePlayers:   number | null
  pegiRating:      string | null   // e.g. "PEGI 12"
  descriptors:     string[]        // e.g. ["Moderate Violence", "Users Interact"]
  followers:       number | null   // creator community followers
  hasVideo:        boolean         // "How to Play" video / preview present
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

async function extract(page: Page, code: string): Promise<Extracted> {
  await page.goto(`https://www.fortnite.com/creative/island-codes/${code}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  // SPA hydrates client-side; wait for it to settle
  await page.waitForTimeout(4500)

  const raw = await page.evaluate(() => {
    const bodyText = (document.body?.innerText ?? '')
    const h1 = document.querySelector('h1')?.textContent?.trim() ?? null
    const creatorLink = document.querySelector<HTMLAnchorElement>('a[href^="/@"]')
    const creator = creatorLink?.getAttribute('href')?.match(/^\/@([^/?#]+)/)?.[1] ?? null

    // Video presence — Fortnite uses a video player iframe / element for previews
    const hasVideo = !!document.querySelector('video, iframe[src*="qstv"], iframe[src*="youtube"], iframe[src*="vimeo"]')

    // Try to extract via the streamed React Router payload — strings of interest
    // are usually present once decoded. Look for known patterns.
    const streamScript = Array.from(document.querySelectorAll('script'))
      .map(s => s.textContent ?? '')
      .filter(t => /streamController\.enqueue/.test(t))
      .join('\n')

    // Pull all quoted strings from the stream — they're a flat dictionary in
    // Remix flight format.
    const allStrings = (streamScript.match(/"([^"\\\n]{2,400})"/g) || []).map(s => s.slice(1, -1))

    return { bodyText, h1, creator, hasVideo, allStrings }
  })

  const { bodyText, h1, creator, hasVideo, allStrings } = raw

  // ── Parse body text ────────────────────────────────────────────────────────
  // The visible body has a stable shape:
  //   <H1 title>\nBY <creator>\n<descriptor>\n<descriptor>\nPLAY NOW\n...\nAbout this island\n<bullets>\n<tag>\n<tag>\n...\n<code>\n<active>\nActive\n...
  const lines = bodyText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const lineIdx = (predicate: (l: string, i: number) => boolean) => lines.findIndex(predicate)

  // Descriptors: between "BY <creator>" and "PLAY NOW"
  const playNowIdx = lineIdx(l => /^PLAY NOW$/i.test(l))
  const byIdx = lineIdx(l => /^BY\b/i.test(l))
  let descriptors: string[] = []
  if (byIdx >= 0 && playNowIdx > byIdx) {
    descriptors = lines.slice(byIdx + 1, playNowIdx)
      .filter(l => l.length > 0 && l.length <= 60)
  }

  // Tagline + tags: between "About this island" and the line equal to the island code
  const aboutIdx = lineIdx(l => /^About this island$/i.test(l))
  const codeLineIdx = lineIdx((l, i) => l === code && i > (aboutIdx ?? 0))
  let aboutSlice: string[] = []
  if (aboutIdx >= 0 && codeLineIdx > aboutIdx) {
    aboutSlice = lines.slice(aboutIdx + 1, codeLineIdx)
  }

  // Distinguish tagline (sentences/bullets — may contain spaces or punctuation)
  // from tags (short, lowercase, single phrase). Heuristic: a "tag" line is
  // ≤ 30 chars, mostly lowercase, no terminal punctuation, no double-space.
  const isTag = (l: string) =>
    l.length <= 30 &&
    !/[.!?]$/.test(l) &&
    !/  /.test(l) &&
    (l === l.toLowerCase() || l.split(' ').length <= 3)

  const tags = aboutSlice.filter(isTag)
  const taglineLines = aboutSlice.filter(l => !isTag(l))
  const tagline = taglineLines.length ? taglineLines.join('\n') : null

  // Active players: line equal to "Active", look at line before it
  const activeLabelIdx = lineIdx((l, i) => l === 'Active' && i > codeLineIdx)
  const activePlayers = activeLabelIdx > 0 ? parseAbbrevNumber(lines[activeLabelIdx - 1] ?? '') : null

  // Followers: after "Followers" label
  const followersLabelIdx = lineIdx(l => /^Followers$/i.test(l))
  const followers = followersLabelIdx > 0 ? parseAbbrevNumber(lines[followersLabelIdx - 1] ?? '') : null

  // ── PEGI rating + descriptors from stream ─────────────────────────────────
  const pegiRating = allStrings.find(s => /^PEGI\s+\d+$/i.test(s)) ?? null

  // The "ratingImage" alt text typically has the PEGI label; descriptors live
  // in the body text we already parsed. Some streams expose descriptors as
  // standalone strings too — capture any that match known forms.
  const knownDescriptors = new Set<string>()
  const descriptorPatterns = [
    /^Moderate Violence$/i, /^Strong Violence$/i, /^Mild Violence$/i, /^Violence$/i,
    /^Users Interact$/i, /^In-Game Purchases$/i, /^Online Interaction.*$/i,
    /^Bad Language$/i, /^Mild Bad Language$/i, /^Strong Bad Language$/i,
    /^Fear$/i, /^Horror$/i, /^Gambling$/i, /^Sex$/i, /^Discrimination$/i, /^Drugs$/i,
  ]
  for (const d of descriptors) if (descriptorPatterns.some(re => re.test(d))) knownDescriptors.add(d)
  for (const s of allStrings) if (descriptorPatterns.some(re => re.test(s))) knownDescriptors.add(s)

  return {
    code,
    title: h1,
    creator,
    tagline,
    tags,
    activePlayers,
    pegiRating,
    descriptors: [...knownDescriptors],
    followers,
    hasVideo,
  }
}

async function main() {
  const codes = process.argv.slice(2).filter(a => /^\d{4}-\d{4}-\d{4}$/.test(a))
  const targets = codes.length > 0 ? codes : DEFAULT_CODES

  console.log(`Connecting to Chrome at ${CDP_URL}…`)
  const browser = await chromium.connectOverCDP(CDP_URL)
  const ctx = browser.contexts()[0]
  if (!ctx) throw new Error('No browser context. Is Chrome open with --remote-debugging-port=9222?')
  const page = await ctx.newPage()
  await page.addInitScript(() => { (globalThis as { __name?: <T>(fn: T) => T }).__name = (fn) => fn })

  const results: Extracted[] = []
  for (const code of targets) {
    console.log(`\n→ ${code}`)
    try {
      const out = await extract(page, code)
      results.push(out)
      console.log(JSON.stringify(out, null, 2))
    } catch (e) {
      console.warn(`  error: ${(e as Error).message}`)
    }
    await page.waitForTimeout(1500)
  }

  // Summary — how many fields populated across the batch?
  console.log('\n── Coverage across batch ──')
  const counts = {
    title:        results.filter(r => r.title).length,
    creator:      results.filter(r => r.creator).length,
    tagline:      results.filter(r => r.tagline).length,
    tags:         results.filter(r => r.tags.length > 0).length,
    activePlayers: results.filter(r => r.activePlayers != null).length,
    pegiRating:   results.filter(r => r.pegiRating).length,
    descriptors:  results.filter(r => r.descriptors.length > 0).length,
    hasVideo:     results.filter(r => r.hasVideo).length,
  }
  console.log(counts)
  console.log(`(${results.length} islands probed)`)

  await page.close()
  await browser.close().catch(() => {})
}

main().catch(e => { console.error(e); process.exit(1) })
