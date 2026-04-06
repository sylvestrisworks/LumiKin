/**
 * One-time migration: add dark_patterns table and virtual currency columns.
 * Run with: node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/migrate-dark-patterns.ts
 */

import { sql } from 'drizzle-orm'
import { db } from '../src/lib/db'

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS dark_patterns (
      id         serial PRIMARY KEY,
      review_id  integer NOT NULL REFERENCES reviews(id),
      pattern_id varchar(4) NOT NULL,
      severity   varchar(6) NOT NULL,
      description text,
      created_at timestamp DEFAULT now()
    );
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS dp_review_idx ON dark_patterns (review_id);
  `)

  await db.execute(sql`
    ALTER TABLE reviews
      ADD COLUMN IF NOT EXISTS uses_virtual_currency boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS virtual_currency_name varchar(50),
      ADD COLUMN IF NOT EXISTS virtual_currency_rate text;
  `)

  console.log('Migration complete.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
