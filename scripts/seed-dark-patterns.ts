/**
 * Seed dark pattern flags for reviewed games.
 * Source: RUBRIC_UPDATE_BRIEF.md Feature 1 seed data.
 *
 * Run with:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/seed-dark-patterns.ts
 */

import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, reviews, gameScores, darkPatterns } from '../src/lib/db/schema'

type DpSeed = {
  patternId: string
  severity: 'low' | 'medium' | 'high'
  description?: string
}

type GameDpSeed = {
  slug: string
  patterns: DpSeed[]
  usesVirtualCurrency?: boolean
  virtualCurrencyName?: string
  virtualCurrencyRate?: string
}

const SEEDS: GameDpSeed[] = [
  // Zelda TotK — no dark patterns
  { slug: 'the-legend-of-zelda-tears-of-the-kingdom', patterns: [] },

  // Genshin Impact
  {
    slug: 'genshin-impact',
    patterns: [
      { patternId: 'DP04', severity: 'high',   description: 'Primogems obscure real-money costs; multiple currencies (Primogems, Fates, Resin) further confuse spending' },
      { patternId: 'DP06', severity: 'medium', description: 'Daily commissions and resin cap encourage daily check-ins; missing days feels like wasted progress' },
      { patternId: 'DP07', severity: 'medium', description: 'Original Resin caps at 160 and refills over ~21 hours, gating exploration and domain runs' },
      { patternId: 'DP09', severity: 'high',   description: 'Wish system (gacha) has a soft pity at 74 pulls and hard pity at 90; character banner odds ~0.6% per 5-star' },
      { patternId: 'DP10', severity: 'low',    description: 'Welkin Moon pass and Genesis Crystal top-ups accelerate Resin and pull acquisition' },
      { patternId: 'DP12', severity: 'high',   description: 'Limited-time character banners and events create urgency; banners rotate every ~3 weeks' },
    ],
    usesVirtualCurrency: true,
    virtualCurrencyName: 'Primogems',
    virtualCurrencyRate: '160 ≈ $2.99',
  },

  // Minecraft (no marketplace) — no dark patterns
  { slug: 'minecraft', patterns: [] },

  // Split Fiction — no dark patterns
  { slug: 'split-fiction', patterns: [] },

  // GTA Online
  {
    slug: 'grand-theft-auto-v',
    patterns: [
      { patternId: 'DP04', severity: 'high',   description: 'Shark Cards convert real money to GTA$; expensive items require large card purchases with awkward denominations' },
      { patternId: 'DP03', severity: 'medium', description: 'Timed bonuses and weekly rotating content suggest urgency around digital items' },
      { patternId: 'DP10', severity: 'high',   description: 'High-end businesses, vehicles, and properties are prohibitively slow to earn in-game, nudging Shark Card purchases' },
      { patternId: 'DP12', severity: 'medium', description: 'Weekly Rockstar Newswire events offer double-money windows that expire, creating FOMO' },
    ],
    usesVirtualCurrency: true,
    virtualCurrencyName: 'Shark Cards / GTA$',
    virtualCurrencyRate: '$1,250,000 GTA$ ≈ $19.99',
  },
]

async function main() {
  for (const seed of SEEDS) {
    // Find the game
    const [game] = await db.select({ id: games.id }).from(games).where(eq(games.slug, seed.slug)).limit(1)
    if (!game) {
      console.warn(`Game not found: ${seed.slug} — skipping`)
      continue
    }

    // Find the review via game_scores
    const [score] = await db.select({ reviewId: gameScores.reviewId }).from(gameScores).where(eq(gameScores.gameId, game.id)).limit(1)
    if (!score) {
      console.warn(`No score/review for: ${seed.slug} — skipping`)
      continue
    }

    const reviewId = score.reviewId

    // Update virtual currency fields on the review
    if (seed.usesVirtualCurrency !== undefined) {
      await db
        .update(reviews)
        .set({
          usesVirtualCurrency: seed.usesVirtualCurrency,
          virtualCurrencyName: seed.virtualCurrencyName ?? null,
          virtualCurrencyRate: seed.virtualCurrencyRate ?? null,
        })
        .where(eq(reviews.id, reviewId))
    }

    // Remove existing patterns for this review (idempotent)
    await db.delete(darkPatterns).where(eq(darkPatterns.reviewId, reviewId))

    // Insert new patterns
    if (seed.patterns.length > 0) {
      await db.insert(darkPatterns).values(
        seed.patterns.map((p) => ({
          reviewId,
          patternId: p.patternId,
          severity: p.severity,
          description: p.description ?? null,
        }))
      )
    }

    console.log(`✓ ${seed.slug}: ${seed.patterns.length} dark pattern(s)`)
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
