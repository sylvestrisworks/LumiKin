/**
 * Migration: add REP (representation) and PROP (propaganda) columns.
 * Run with: node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/migrate-rep-prop.ts
 */

import { sql } from 'drizzle-orm'
import { db } from '../src/lib/db'

async function main() {
  await db.execute(sql`
    ALTER TABLE reviews
      ADD COLUMN IF NOT EXISTS rep_gender_balance   integer,
      ADD COLUMN IF NOT EXISTS rep_ethnic_diversity  integer,
      ADD COLUMN IF NOT EXISTS propaganda_level      integer,
      ADD COLUMN IF NOT EXISTS propaganda_notes      text;
  `)

  await db.execute(sql`
    ALTER TABLE game_scores
      ADD COLUMN IF NOT EXISTS representation_score real,
      ADD COLUMN IF NOT EXISTS propaganda_level     integer;
  `)

  console.log('Migration complete.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
