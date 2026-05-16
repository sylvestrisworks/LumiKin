/**
 * Adds the input_confidence real column to experience_scores. Idempotent —
 * uses IF NOT EXISTS. Used as a fallback when drizzle-kit push hangs on its
 * interactive prompt.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

async function main() {
  await sql`ALTER TABLE experience_scores ADD COLUMN IF NOT EXISTS input_confidence real`
  const cols = await sql<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'experience_scores' AND column_name = 'input_confidence'
  `
  console.log(cols[0] ?? 'column not present')
  await sql.end()
}

main().catch(async e => { console.error(e); await sql.end(); process.exit(1) })
