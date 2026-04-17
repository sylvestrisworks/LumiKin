import { db } from '../src/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS epic_connections (
      id              SERIAL PRIMARY KEY,
      user_id         TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
      epic_account_id VARCHAR(50) NOT NULL UNIQUE,
      display_name    VARCHAR(255),
      access_token    TEXT NOT NULL,
      refresh_token   TEXT NOT NULL,
      expires_at      TIMESTAMP NOT NULL,
      last_synced_at  TIMESTAMP,
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('epic_connections: OK')

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS epic_library (
      id              SERIAL PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      epic_account_id VARCHAR(50) NOT NULL,
      catalog_item_id VARCHAR(100) NOT NULL,
      namespace       VARCHAR(100) NOT NULL,
      app_name        VARCHAR(255),
      title           VARCHAR(500),
      game_id         INTEGER REFERENCES games(id) ON DELETE SET NULL,
      created_at      TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, catalog_item_id)
    )
  `)
  console.log('epic_library: OK')

  await db.execute(sql`CREATE INDEX IF NOT EXISTS epic_library_user_idx ON epic_library(user_id)`)
  console.log('indexes: OK')

  process.exit(0)
}

main().catch(e => { console.error(e.message); process.exit(1) })
