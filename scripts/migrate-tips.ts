import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

  await sql`
    CREATE TABLE IF NOT EXISTS game_tips (
      id          SERIAL PRIMARY KEY,
      game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id     TEXT    NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      author_name VARCHAR(100) NOT NULL DEFAULT 'A parent',
      content     VARCHAR(280) NOT NULL,
      tip_type    VARCHAR(20)  NOT NULL DEFAULT 'tip',
      status      VARCHAR(20)  NOT NULL DEFAULT 'approved',
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS game_tips_game_idx ON game_tips(game_id)`
  await sql`CREATE INDEX IF NOT EXISTS game_tips_user_idx ON game_tips(user_id)`
  await sql`
    CREATE TABLE IF NOT EXISTS game_tip_votes (
      id         SERIAL PRIMARY KEY,
      tip_id     INTEGER NOT NULL REFERENCES game_tips(id) ON DELETE CASCADE,
      user_id    TEXT    NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS game_tip_votes_tip_user_idx ON game_tip_votes(tip_id, user_id)`

  console.log('Migration complete.')
  await sql.end()
  process.exit(0)
}
main()
