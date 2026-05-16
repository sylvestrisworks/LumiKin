/**
 * Adds the structured-field columns to platform_experiences. Idempotent.
 * Used as a fallback when drizzle-kit push hangs on its interactive prompt.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

async function main() {
  await sql`ALTER TABLE platform_experiences ADD COLUMN IF NOT EXISTS tagline text`
  await sql`ALTER TABLE platform_experiences ADD COLUMN IF NOT EXISTS tags jsonb`
  await sql`ALTER TABLE platform_experiences ADD COLUMN IF NOT EXISTS content_descriptors jsonb`
  await sql`ALTER TABLE platform_experiences ADD COLUMN IF NOT EXISTS age_rating varchar(16)`
  await sql`ALTER TABLE platform_experiences ADD COLUMN IF NOT EXISTS creator_followers integer`

  const cols = await sql<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'platform_experiences'
      AND column_name IN ('tagline','tags','content_descriptors','age_rating','creator_followers')
    ORDER BY column_name
  `
  console.table(cols)
  await sql.end()
}

main().catch(async e => { console.error(e); await sql.end(); process.exit(1) })
