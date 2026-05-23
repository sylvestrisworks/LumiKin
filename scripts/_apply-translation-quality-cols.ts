import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  await db.execute(sql`
    alter table game_translations
      add column if not exists quality_score integer,
      add column if not exists quality_issues jsonb,
      add column if not exists needs_retranslate boolean default false,
      add column if not exists audited_at timestamp
  `)
  await db.execute(sql`
    create index if not exists game_translations_needs_retranslate_idx
      on game_translations(needs_retranslate)
  `)
  const rows = await db.execute(sql`
    select column_name, data_type
      from information_schema.columns
     where table_name = 'game_translations'
       and column_name in ('quality_score','quality_issues','needs_retranslate','audited_at')
     order by column_name
  `)
  console.log('added columns:', rows)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
