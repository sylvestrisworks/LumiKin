/**
 * Adds needs_rescore and rawg_updated_at columns to games table.
 * Run with:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/add-rescore-columns.ts
 */
import { db } from '../src/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  await db.execute(sql`
    ALTER TABLE games
      ADD COLUMN IF NOT EXISTS needs_rescore boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS rawg_updated_at timestamp
  `)
  console.log('✓ columns added')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
