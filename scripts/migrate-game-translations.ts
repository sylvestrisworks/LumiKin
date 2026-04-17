// One-time migration: create game_translations table
// Run with: npx tsx scripts/migrate-game-translations.ts
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS game_translations (
      id SERIAL PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      locale VARCHAR(10) NOT NULL,
      executive_summary TEXT,
      benefits_narrative TEXT,
      risks_narrative TEXT,
      parent_tip TEXT,
      parent_tip_benefits TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT game_translations_game_locale_idx UNIQUE (game_id, locale)
    )
  `)
  console.log('✓ game_translations table created (or already exists)')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
