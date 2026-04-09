import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  await db.update(games)
    .set({ backgroundImage: 'https://media.rawg.io/media/games/42f/42fe1abd4d7c11ca92d93a0fb0f8662b.jpg' })
    .where(eq(games.slug, 'animal-crossing-new-horizons'))
  console.log('Animal Crossing: New Horizons image patched.')
}

main().catch(console.error)
