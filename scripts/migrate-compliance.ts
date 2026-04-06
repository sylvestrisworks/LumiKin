/**
 * One-time migration: add compliance_status table.
 * Run with: node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/migrate-compliance.ts
 */

import { sql } from 'drizzle-orm'
import { db } from '../src/lib/db'

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS compliance_status (
      id           serial PRIMARY KEY,
      game_id      integer NOT NULL REFERENCES games(id),
      regulation   varchar(10) NOT NULL,
      status       varchar(15) NOT NULL DEFAULT 'not_assessed',
      notes        text,
      assessed_at  timestamp,
      created_at   timestamp DEFAULT now(),
      CONSTRAINT compliance_unique UNIQUE (game_id, regulation)
    );
  `)
  console.log('Migration complete.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
