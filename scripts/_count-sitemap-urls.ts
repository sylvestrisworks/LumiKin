import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

const LOCALES = 5

async function main() {
  const games = await db.execute(sql`
    select count(*)::int as n
      from games g
      join game_scores gs on gs.game_id = g.id
     where gs.curascore is not null
       and (g.content_type is null or g.content_type <> 'platform')
  `)

  const ugc = await db.execute(sql`
    select count(*)::int as n
      from platform_experiences pe
      join games g  on g.id = pe.platform_id
      join experience_scores es on es.experience_id = pe.id
     where g.content_type = 'platform'
       and es.curascore is not null
       and pe.is_public = true
  `)

  const ugcByPlatform = await db.execute(sql`
    select g.slug as platform, count(*)::int as n
      from platform_experiences pe
      join games g  on g.id = pe.platform_id
      join experience_scores es on es.experience_id = pe.id
     where g.content_type = 'platform'
       and es.curascore is not null
       and pe.is_public = true
     group by g.slug
     order by n desc
  `)

  const pickRows = (r: unknown): Array<Record<string, unknown>> => {
    if (Array.isArray(r)) return r as Array<Record<string, unknown>>
    if (r && typeof r === 'object' && 'rows' in (r as Record<string, unknown>)) {
      return (r as { rows: Array<Record<string, unknown>> }).rows
    }
    return []
  }

  const gameRows = Number(pickRows(games)[0]?.n ?? 0)
  const ugcRows  = Number(pickRows(ugc)[0]?.n ?? 0)
  const hubRows  = pickRows(ugcByPlatform)

  const staticPaths = 15 + 14 + 6 // static + age + traditional platforms
  const platformHubs = hubRows.length

  const total =
    (staticPaths + platformHubs + gameRows + ugcRows) * LOCALES

  console.log('--- sitemap URL counts (× 5 locales unless noted) ---')
  console.log('scored games:                 ', gameRows, '→', gameRows * LOCALES, 'URLs')
  console.log('scored UGC experiences:       ', ugcRows, '→', ugcRows * LOCALES, 'URLs')
  console.log('UGC by platform:              ', hubRows)
  console.log('static + age + trad platforms:', staticPaths, '→', staticPaths * LOCALES, 'URLs')
  console.log('UGC platform hubs (derived):  ', platformHubs, '→', platformHubs * LOCALES, 'URLs')
  console.log('---')
  console.log('approx total (excl Sanity):   ', total, 'URLs')
  console.log('---')
  console.log('chunks @ 45 000 / file:       ', Math.ceil(total / 45000))
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
