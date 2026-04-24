import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

async function main() {
  const res = await fetch('https://store-content.ak.epicgames.com/api/en-US/content/products/fortnite', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  const data = await res.json()

  const targets = ['lego', 'festival', 'rocket-racing']
  const results: Record<string, string | null> = {}

  for (const slug of targets) {
    const page = data.pages.find((p: { _slug: string }) => p._slug === slug)
    const txt = JSON.stringify(page)

    // Pull all unrealengine CDN URLs, exclude rating badges
    const all: string[] = []
    let idx = 0
    while (true) {
      const start = txt.indexOf('https://cdn', idx)
      if (start === -1) break
      const end = txt.indexOf('"', start)
      if (end === -1) break
      all.push(txt.slice(start, end))
      idx = end
    }

    const filtered = [...new Set(all)].filter(u => {
      const low = u.toLowerCase()
      return (low.endsWith('.jpg') || low.endsWith('.png') || low.endsWith('.webp'))
        && !low.includes('rating') && !low.includes('cero') && !low.includes('acb')
        && !low.includes('usk') && !low.includes('esrb') && !low.includes('pegi')
    })

    console.log(`\n${slug} (${filtered.length} promo images):`)
    for (const u of filtered.slice(0, 6)) console.log('  ' + decodeURIComponent(u))
    results[slug] = filtered[0] ?? null
  }

  console.log('\n--- Results ---')
  for (const [slug, url] of Object.entries(results)) {
    console.log(slug + ': ' + (url ?? 'none'))
  }

  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
