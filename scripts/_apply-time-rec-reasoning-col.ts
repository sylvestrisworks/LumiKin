import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  await db.execute(sql`
    alter table game_translations
      add column if not exists time_rec_reasoning text
  `)
  const rows = await db.execute(sql`
    select column_name from information_schema.columns
     where table_name = 'game_translations'
       and column_name = 'time_rec_reasoning'
  `)
  console.log('added:', rows)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
