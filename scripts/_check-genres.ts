import { sql } from 'drizzle-orm'
import { db } from '../src/lib/db'

async function main() {
  const r = await db.execute(sql`
    SELECT jsonb_array_elements_text(genres::jsonb) AS genre, COUNT(*) AS cnt
    FROM games
    WHERE genres IS NOT NULL AND jsonb_typeof(genres::jsonb) = 'array'
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 40
  `)
  ;(r as any[]).forEach((x: any) => console.log(x.cnt.toString().padStart(4), x.genre))
}

main().catch(e => { console.error(e); process.exit(1) })
