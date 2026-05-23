import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  const total = await db.execute(sql`select count(*)::int as n from game_translations`)
  const audited = await db.execute(sql`select count(*)::int as n from game_translations where audited_at is not null`)
  const flagged = await db.execute(sql`select count(*)::int as n from game_translations where needs_retranslate = true`)
  const scoreDist = await db.execute(sql`
    select
      sum(case when quality_score = 100 then 1 else 0 end)::int as perfect,
      sum(case when quality_score between 70 and 99 then 1 else 0 end)::int as good,
      sum(case when quality_score between 40 and 69 then 1 else 0 end)::int as flagged,
      sum(case when quality_score < 40 then 1 else 0 end)::int as bad
    from game_translations
    where audited_at is not null
  `)
  const ruleHits = await db.execute(sql`
    with rules as (
      select locale, e->>'rule' as rule
        from game_translations,
             lateral jsonb_array_elements(quality_issues) e
       where audited_at is not null
         and quality_issues is not null
    )
    select rule, locale, count(*)::int as n
      from rules
     group by rule, locale
     order by rule, locale
  `)
  console.log('total rows:', total)
  console.log('audited:', audited)
  console.log('needs_retranslate=true:', flagged)
  console.log('score distribution:', scoreDist)
  console.log('rows hitting each rule (by locale):', ruleHits)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
