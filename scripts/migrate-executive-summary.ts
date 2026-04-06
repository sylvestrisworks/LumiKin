/**
 * One-time migration: add executive_summary column to game_scores.
 * Run with: node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/migrate-executive-summary.ts
 */

import { sql } from 'drizzle-orm'
import { db } from '../src/lib/db'

async function main() {
  await db.execute(sql`
    ALTER TABLE game_scores
      ADD COLUMN IF NOT EXISTS executive_summary text;
  `)
  console.log('Migration complete.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
