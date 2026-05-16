/**
 * Probes the DOM of a Fortnite Creative island page to find every text region
 * that might contain a real, map-specific description. og:description is the
 * generic share template; we need to find whatever is actually shown on-page.
 *
 * Run after Chrome is open on CDP port 9222:
 *   node node_modules/tsx/dist/cli.cjs scripts/probe-fortnite-detail-content.ts 6562-8953-6567
 */

import { chromium } from 'playwright'

const CDP_URL = process.env.CDP_URL ?? 'http://localhost:9222'

async function main() {
  const code = process.argv[2]
  if (!code) { console.error('usage: probe-fortnite-detail-content.ts <island-code>'); process.exit(1) }

  const browser = await chromium.connectOverCDP(CDP_URL)
  const ctx = browser.contexts()[0]
  if (!ctx) { console.error('No browser context'); process.exit(1) }

  const page = await ctx.newPage()
  await page.addInitScript(() => { (globalThis as { __name?: <T>(fn: T) => T }).__name = (fn) => fn })

  console.log(`→ https://www.fortnite.com/creative/island-codes/${code}`)
  await page.goto(`https://www.fortnite.com/creative/island-codes/${code}`, { waitUntil: 'domcontentloaded' })
  // Wait for the "How to Play" section to render (it's hydrated client-side)
  await page.waitForTimeout(6000)

  const dump = await page.evaluate(() => {
    const out: Record<string, unknown> = {}
    out.url = location.href
    out.title = document.title

    // All meta tags
    const metas: Record<string, string> = {}
    document.querySelectorAll('meta').forEach(m => {
      const k = m.getAttribute('property') || m.getAttribute('name')
      const v = m.getAttribute('content')
      if (k && v) metas[k] = v
    })
    out.metas = metas

    // Every <h1>, <h2>, <h3> + their text
    out.headings = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => ({
      tag: h.tagName, text: (h.textContent ?? '').trim().slice(0, 200),
    }))

    // Every <p> with substantial text
    out.paragraphs = Array.from(document.querySelectorAll('p'))
      .map(p => (p.textContent ?? '').trim())
      .filter(t => t.length >= 30)
      .slice(0, 20)

    // Look for any element whose text mentions 'description' label
    out.descLabels = Array.from(document.querySelectorAll('*'))
      .filter(e => /description/i.test(e.textContent ?? '') && e.children.length <= 2)
      .map(e => ({ tag: e.tagName, text: (e.textContent ?? '').trim().slice(0, 300) }))
      .slice(0, 8)

    // Walk siblings/descendants of the "How to Play This Island" heading
    const findAfter = (matcher: RegExp) => {
      const heading = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3'))
        .find(h => matcher.test((h.textContent ?? '').trim()))
      if (!heading) return null
      const collected: string[] = []
      let walker: Element | null = heading
      while (walker && collected.join(' ').length < 800) {
        walker = walker.nextElementSibling
        if (!walker) {
          walker = heading.parentElement?.nextElementSibling ?? null
        }
        if (!walker) break
        const txt = (walker.textContent ?? '').trim()
        if (txt) collected.push(txt.slice(0, 400))
      }
      return collected
    }
    out.howToPlay = findAfter(/how to play/i)
    out.aboutIsland = findAfter(/about/i)

    // Pull React Router streamed loader data
    const streamScripts = Array.from(document.querySelectorAll('script')).filter(s => /streamController\.enqueue/.test(s.textContent ?? ''))
    out.streamScriptCount = streamScripts.length
    // Naively pull any string-looking content from the stream payload that's >= 60 chars
    const streamText = streamScripts.map(s => s.textContent).join('\n')
    const candidate = (streamText.match(/"[^"\\]{60,500}"/g) || [])
      .map(s => s.slice(1, -1))
      .filter(s => !/^[A-Za-z0-9+/=]+$/.test(s))  // skip base64ish
      .filter(s => !/^https?:\/\//.test(s))
      .filter(s => !/^\d{4}-\d{4}-\d{4}/.test(s))
    out.streamLongStrings = candidate.slice(0, 30)

    // Raw stream text excerpt — first 4000 chars
    out.streamRaw = streamText.slice(0, 4000)

    // Full visible body text minus cookie/privacy junk
    const bodyText = (document.body?.innerText ?? '')
    out.bodyHead = bodyText.slice(0, 2000)
    out.bodyMid = bodyText.slice(2000, 4000)
    out.bodyLen = bodyText.length

    // Any <script type="application/ld+json">
    out.ldJson = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map(s => { try { return JSON.parse(s.textContent ?? '{}') } catch { return null } })

    // Try __NEXT_DATA__ — common in Next.js apps
    const nd = document.getElementById('__NEXT_DATA__')
    if (nd) {
      try {
        const json = JSON.parse(nd.textContent ?? '{}')
        // Look for description-like fields in nested page props
        const stringify = JSON.stringify(json)
        out.nextDataLength = stringify.length
        // Pull anything resembling a tagline / description
        const m = stringify.match(/"(description|tagline|summary|about|blurb)"\s*:\s*"([^"]{30,500})"/g)
        out.nextDataMatches = (m || []).slice(0, 10)
      } catch { out.nextDataLength = -1 }
    }

    return out
  })

  console.log('\n── META TAGS ──')
  console.log(JSON.stringify(dump.metas, null, 2))
  console.log('\n── HEADINGS ──')
  console.log(JSON.stringify(dump.headings, null, 2))
  console.log('\n── PARAGRAPHS (≥30 chars) ──')
  console.log(JSON.stringify(dump.paragraphs, null, 2))
  console.log('\n── DESCRIPTION-LABEL ELEMENTS ──')
  console.log(JSON.stringify(dump.descLabels, null, 2))
  console.log('\n── HOW TO PLAY (siblings after heading) ──')
  console.log(JSON.stringify(dump.howToPlay, null, 2))
  console.log('\n── ABOUT (siblings after heading) ──')
  console.log(JSON.stringify(dump.aboutIsland, null, 2))
  console.log('\n── STREAM SCRIPTS ──')
  console.log('count:', dump.streamScriptCount)
  console.log('long strings extracted:')
  console.log(JSON.stringify(dump.streamLongStrings, null, 2))
  console.log('\n── LD+JSON ──')
  console.log(JSON.stringify(dump.ldJson, null, 2))
  console.log('\n── __NEXT_DATA__ ──')
  console.log('length:', dump.nextDataLength)
  console.log('matches:', dump.nextDataMatches)
  console.log('\n── BODY TEXT (head/mid) ──')
  console.log('len:', dump.bodyLen)
  console.log('---head---\n' + dump.bodyHead)
  console.log('---mid---\n' + dump.bodyMid)
  console.log('\n── STREAM RAW (first 4000) ──')
  console.log(dump.streamRaw)

  await page.close()
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
