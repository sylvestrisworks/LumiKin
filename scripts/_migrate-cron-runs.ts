import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)

  await sql`
    CREATE TABLE IF NOT EXISTS cron_runs (
      id              SERIAL PRIMARY KEY,
      job_name        VARCHAR(100) NOT NULL,
      started_at      TIMESTAMP NOT NULL,
      finished_at     TIMESTAMP,
      status          VARCHAR(20) NOT NULL,
      items_processed INTEGER NOT NULL DEFAULT 0,
      items_skipped   INTEGER NOT NULL DEFAULT 0,
      errors          INTEGER NOT NULL DEFAULT 0,
      duration_ms     INTEGER,
      meta            JSONB
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS cron_runs_job_name_idx   ON cron_runs (job_name)`
  await sql`CREATE INDEX IF NOT EXISTS cron_runs_started_at_idx ON cron_runs (started_at)`

  console.log('cron_runs table created')
  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
