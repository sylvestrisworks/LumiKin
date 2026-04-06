/**
 * Seed executive summary lines for reviewed games.
 * Source: RUBRIC_UPDATE_BRIEF.md Feature 2 examples.
 *
 * Run with:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/seed-executive-summaries.ts
 */

import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, gameScores } from '../src/lib/db/schema'

const SEEDS: { slug: string; summary: string }[] = [
  {
    slug: 'the-legend-of-zelda-tears-of-the-kingdom',
    summary: 'High-benefit exploration game with minimal manipulation design.',
  },
  {
    slug: 'genshin-impact',
    summary: 'Beautiful world with genuine learning value, but aggressive gacha monetization.',
  },
  {
    slug: 'minecraft',
    summary: 'Exceptional creativity tool — set your own time limits, the game won\'t.',
  },
  {
    slug: 'split-fiction',
    summary: 'Inventive co-op adventure with strong creative benefits and no monetization pressure.',
  },
  {
    slug: 'grand-theft-auto-v',
    summary: 'Not designed for children. High manipulation, high spending pressure.',
  },
]

async function main() {
  for (const seed of SEEDS) {
    const [game] = await db.select({ id: games.id }).from(games).where(eq(games.slug, seed.slug)).limit(1)
    if (!game) {
      console.warn(`Game not found: ${seed.slug} — skipping`)
      continue
    }

    const result = await db
      .update(gameScores)
      .set({ executiveSummary: seed.summary })
      .where(eq(gameScores.gameId, game.id))

    console.log(`✓ ${seed.slug}`)
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
