import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  const total = await db.execute(sql`select count(*)::int as n from platform_experiences`)
  const scored = await db.execute(sql`
    select count(*)::int as n from experience_scores where summary is not null and curascore is not null
  `)
  const byPlatform = await db.execute(sql`
    select g.slug as platform, count(*)::int as n
      from platform_experiences pe
      join games g on g.id = pe.platform_id
      join experience_scores es on es.experience_id = pe.id
     where es.summary is not null
     group by g.slug
     order by n desc
  `)
  console.log('total platform_experiences:', total)
  console.log('with score + summary:', scored)
  console.log('by platform:', byPlatform)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
