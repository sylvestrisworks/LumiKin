// Seed the four standalone Fortnite game modes as individual games entries.
// These are distinct products with very different risk/benefit profiles.
// Run with: npx tsx scripts/seed-fortnite-modes.ts

import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const MODES = [
  {
    slug:        'fortnite-battle-royale',
    title:       'Fortnite Battle Royale',
    description: 'The iconic 100-player battle royale from Epic Games. Players drop onto an island, scavenge for weapons, and fight to be the last one standing. Features heavy seasonal content, battle passes, and cosmetic monetization pressure. One of the most-played games in the world.',
    developer:   'Epic Games',
    publisher:   'Epic Games',
    releaseDate: new Date('2017-09-26'),
    platforms:   ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile'],
    genres:      ['Action', 'Battle Royale', 'Shooter'],
    esrbRating:  'T',
    pegiRating:  12,
    basePrice:   0,
    hasMicrotransactions: true,
    hasBattlePass:        true,
    hasLootBoxes:         false,
    hasStrangerChat:      true,
    chatModeration:       'basic',
    requiresInternet:     'always',
  },
  {
    slug:        'lego-fortnite',
    title:       'Lego Fortnite',
    description: 'A family-friendly survival and crafting adventure set in a Lego-styled Fortnite world. Players gather resources, build structures, craft tools, and explore procedurally generated open worlds solo or with friends. Significantly more child-appropriate than Battle Royale.',
    developer:   'Epic Games',
    publisher:   'Epic Games',
    releaseDate: new Date('2023-12-07'),
    platforms:   ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile'],
    genres:      ['Survival', 'Crafting', 'Family', 'Adventure'],
    esrbRating:  'E10',
    pegiRating:  7,
    basePrice:   0,
    hasMicrotransactions: true,
    hasBattlePass:        false,
    hasLootBoxes:         false,
    hasStrangerChat:      true,
    chatModeration:       'basic',
    requiresInternet:     'always',
  },
  {
    slug:        'fortnite-festival',
    title:       'Fortnite Festival',
    description: 'A rhythm game developed by Harmonix inside the Fortnite ecosystem. Players hit notes in time with popular music tracks across guitar, bass, drums, and vocals. Features solo play and multiplayer jam sessions. Individual song tracks available for purchase.',
    developer:   'Harmonix',
    publisher:   'Epic Games',
    releaseDate: new Date('2023-12-09'),
    platforms:   ['PC', 'PlayStation', 'Xbox', 'Switch'],
    genres:      ['Rhythm', 'Music', 'Party'],
    esrbRating:  'T',
    pegiRating:  12,
    basePrice:   0,
    hasMicrotransactions: true,
    hasBattlePass:        false,
    hasLootBoxes:         false,
    hasStrangerChat:      false,
    requiresInternet:     'always',
  },
  {
    slug:        'fortnite-rocket-racing',
    title:       'Rocket Racing',
    description: 'A high-speed arcade racing game developed by Psyonix (makers of Rocket League) inside the Fortnite ecosystem. Players race across dynamic tracks using boost mechanics and aerial maneuvers. Features ranked competitive play and cosmetic progression.',
    developer:   'Psyonix',
    publisher:   'Epic Games',
    releaseDate: new Date('2023-12-09'),
    platforms:   ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile'],
    genres:      ['Racing', 'Action', 'Sports'],
    esrbRating:  'E',
    pegiRating:  3,
    basePrice:   0,
    hasMicrotransactions: true,
    hasBattlePass:        false,
    hasLootBoxes:         false,
    hasStrangerChat:      false,
    requiresInternet:     'always',
  },
]

async function main() {
  for (const mode of MODES) {
    const [existing] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, mode.slug))
      .limit(1)

    if (existing) {
      console.log(`✓ ${mode.slug} already exists (id: ${existing.id}) — skipping`)
      continue
    }

    const [row] = await db.insert(games).values(mode).returning({ id: games.id })
    console.log(`✓ ${mode.slug} created (id: ${row.id})`)
  }

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
