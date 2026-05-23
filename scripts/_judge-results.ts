import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  const hits = await db.execute(sql`
    select count(*)::int as n from game_translations
     where locale='sv' and quality_issues @> '[{"rule":"judge_flag"}]'::jsonb
  `)
  const sample = await db.execute(sql`
    select gt.game_id, g.slug,
           e->>'field'  as field,
           e->>'detail' as reason
      from game_translations gt
      join games g on g.id = gt.game_id,
           lateral jsonb_array_elements(gt.quality_issues) e
     where gt.locale='sv'
       and e->>'rule' = 'judge_flag'
     limit 20
  `)
  const fieldBreakdown = await db.execute(sql`
    select e->>'field' as field, count(*)::int as n
      from game_translations gt,
           lateral jsonb_array_elements(gt.quality_issues) e
     where gt.locale='sv' and e->>'rule' = 'judge_flag'
     group by e->>'field'
     order by n desc
  `)
  console.log('Swedish rows with judge_flag:', hits)
  console.log('field breakdown:', fieldBreakdown)
  console.log('\nsample reasons:')
  for (const r of sample as unknown as Array<Record<string, unknown>>) {
    console.log(`  gid=${r.game_id}  ${r.slug}  ${r.field}: ${r.reason}`)
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
