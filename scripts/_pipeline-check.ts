import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)

  const [ingest]   = await sql`SELECT COUNT(*) FROM cron_runs WHERE job_name = 'ingest-games'`
  const [coverage] = await sql`SELECT COUNT(*) FROM cron_runs WHERE job_name = 'coverage-report'`
  console.log('ingest-games runs in DB:', ingest.count)
  console.log('coverage-report runs in DB:', coverage.count)

  const errors = await sql`
    SELECT meta, started_at, duration_ms
    FROM cron_runs
    WHERE job_name = 'fetch-games' AND status = 'error'
    ORDER BY started_at DESC LIMIT 5
  `
  console.log('\nfetch-games recent errors:')
  for (const e of errors) {
    console.log(` ${e.started_at}  (${e.duration_ms}ms)  meta:`, JSON.stringify(e.meta))
  }

  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
