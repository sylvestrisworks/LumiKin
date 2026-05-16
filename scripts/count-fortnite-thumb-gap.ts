import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

async function main() {
  const rows = await sql<{ alive_missing: number; alive_total: number; dead_total: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE pe.is_public AND (pe.thumbnail_url IS NULL OR pe.thumbnail_url LIKE '%fortnitemaps.com%' OR pe.thumbnail_url LIKE '%epic-games-badge%')) AS alive_missing,
      COUNT(*) FILTER (WHERE pe.is_public) AS alive_total,
      COUNT(*) FILTER (WHERE NOT pe.is_public) AS dead_total
    FROM platform_experiences pe
    JOIN games g ON g.id = pe.platform_id
    WHERE g.slug = 'fortnite-creative'
  `
  console.log(rows[0])
  await sql.end()
}

main().catch(async e => { console.error(e); await sql.end(); process.exit(1) })
