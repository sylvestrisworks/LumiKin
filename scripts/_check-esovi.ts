import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'
async function main() {
  const [g] = await db.select({
    id: games.id, slug: games.slug, title: games.title,
    metacriticScore: games.metacriticScore, releaseDate: games.releaseDate,
    description: games.description,
  }).from(games).where(eq(games.slug, 'the-elder-scrolls-vi')).limit(1)
  console.log(JSON.stringify(g, null, 2))
  process.exit(0)
}
main().catch(e => { console.error(e.message); process.exit(1) })
