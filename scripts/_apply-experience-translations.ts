import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  await db.execute(sql`
    create table if not exists experience_translations (
      id                  serial primary key,
      experience_id       integer not null references platform_experiences(id) on delete cascade,
      locale              varchar(10) not null,
      summary             text,
      benefits_narrative  text,
      risks_narrative     text,
      parent_tip          text,
      created_at          timestamp default now(),
      quality_score       integer,
      quality_issues      jsonb,
      needs_retranslate   boolean default false,
      audited_at          timestamp
    )
  `)
  await db.execute(sql`
    create unique index if not exists experience_translations_experience_locale_idx
      on experience_translations(experience_id, locale)
  `)
  await db.execute(sql`
    create index if not exists experience_translations_needs_retranslate_idx
      on experience_translations(needs_retranslate)
  `)
  const rows = await db.execute(sql`
    select column_name from information_schema.columns
     where table_name = 'experience_translations'
     order by ordinal_position
  `)
  console.log('created experience_translations:', rows)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
