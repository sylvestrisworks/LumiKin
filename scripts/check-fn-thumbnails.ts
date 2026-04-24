import { db } from '@/lib/db'
import { platformExperiences, games } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  const [fn] = await db.select({ id: games.id }).from(games).where(eq(games.slug, 'fortnite-creative')).limit(1)
  const rows = await db.select({ slug: platformExperiences.slug, title: platformExperiences.title, thumbnailUrl: platformExperiences.thumbnailUrl })
    .from(platformExperiences)
    .where(eq(platformExperiences.platformId, fn.id))

  const domains: Record<string, number> = {}
  for (const r of rows) {
    if (r.thumbnailUrl) {
      try { const d = new URL(r.thumbnailUrl).hostname; domains[d] = (domains[d] || 0) + 1 } catch {}
    } else {
      domains['(null)'] = (domains['(null)'] || 0) + 1
    }
  }
  console.log('Thumbnail URL domains:')
  for (const [d, n] of Object.entries(domains).sort((a, b) => b[1] - a[1])) console.log(`  ${n}x  ${d}`)

  console.log('\nSample broken-looking URLs:')
  for (const r of rows.filter(r => r.thumbnailUrl && !r.thumbnailUrl.includes('epicgames') && !r.thumbnailUrl.includes('unrealengine')).slice(0, 5)) {
    console.log(`  ${r.title}: ${r.thumbnailUrl}`)
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
