import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  // Flag every translation row that's missing time_rec_reasoning when the
  // source (gameScores.time_rec_reasoning) has content. The cron will then
  // re-translate them on its next run with the new field included.
  const result = await db.execute(sql`
    update game_translations gt
       set needs_retranslate = true
      from game_scores gs
     where gs.game_id = gt.game_id
       and gs.time_rec_reasoning is not null
       and gs.time_rec_reasoning <> ''
       and gt.time_rec_reasoning is null
       and gt.needs_retranslate is distinct from true
  `)
  console.log('flagged rows:', result)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
