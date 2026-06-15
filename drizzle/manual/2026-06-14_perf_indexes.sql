-- Performance indexes for the hot browse / discover / stats query paths.
--
-- WHY THIS IS A HAND-WRITTEN SCRIPT (not a drizzle-kit generate migration):
-- this project deploys schema changes with `drizzle-kit push` (see CLAUDE.md),
-- so the drizzle/ migration journal/snapshots are stale and `generate` emits the
-- whole schema as a diff. The indexes are defined in src/lib/db/schema.ts as the
-- source of truth; `npm run db:push` will also create them. This script exists so
-- they can be applied to production WITHOUT the brief write-lock that plain
-- `CREATE INDEX` (what push runs) takes on the large games / game_scores tables.
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block — run each
-- statement on its own (psql autocommit, or one-at-a-time). All are IF NOT EXISTS
-- so the script is safe to re-run and is a no-op once push/this has applied them.

-- game_scores: default /browse sort + every catalogue stat (curascore),
-- recent-scores + 7/30-day windows (calculated_at), risk filter/sort (ris),
-- benefit sort + carousels (bds). Previously only unique(game_id) existed.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "game_scores_curascore_idx"     ON "game_scores" ("curascore");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "game_scores_calculated_at_idx" ON "game_scores" ("calculated_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "game_scores_ris_idx"           ON "game_scores" ("ris");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "game_scores_bds_idx"           ON "game_scores" ("bds");

-- games: /browse filters released titles (release_date) on every request and
-- offers newest / trending / popular / metacritic sorts. None were indexed.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "games_release_date_idx"   ON "games" ("release_date");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "games_trending_score_idx" ON "games" ("trending_score");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "games_rawg_added_idx"     ON "games" ("rawg_added");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "games_metacritic_idx"     ON "games" ("metacritic_score");

-- experience_scores (UGC shelves + UGC stats): curascore filter/sort,
-- calculated_at for recent-UGC + day-window stats. Only unique(experience_id).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "experience_scores_curascore_idx"     ON "experience_scores" ("curascore");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "experience_scores_calculated_at_idx" ON "experience_scores" ("calculated_at");

-- After applying, refresh planner stats so the new indexes get used promptly:
ANALYZE "game_scores";
ANALYZE "games";
ANALYZE "experience_scores";
