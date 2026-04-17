// One-time seed: create the fortnite-creative platform row in the games table
// Run with: npx tsx scripts/seed-fortnite.ts
import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  const [existing] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, 'fortnite-creative'))
    .limit(1)

  if (existing) {
    console.log('✓ fortnite-creative row already exists (id:', existing.id, ')')
    process.exit(0)
  }

  const [row] = await db.insert(games).values({
    slug:        'fortnite-creative',
    title:       'Fortnite Creative',
    description: 'Fortnite Creative is Epic Games\' user-generated map platform. Players can build and share their own islands across dozens of genres including box fights, zone wars, deathrun, puzzle maps, and open sandboxes.',
    developer:   'Epic Games',
    publisher:   'Epic Games',
    isPlatform:  true,
    platforms:   ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile'],
    genres:      ['Action', 'Creative', 'User-Generated Content'],
    pegiRating:  12,
    hasMicrotransactions: true,
    hasBattlePass:        true,
    hasStrangerChat:      true,
    requiresInternet:     'always',
  }).returning({ id: games.id })

  console.log('✓ fortnite-creative platform row created (id:', row.id, ')')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
