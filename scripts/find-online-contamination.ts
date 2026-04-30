/**
 * Find games that may have inflated risk scores due to a bundled online mode
 * being scored alongside the base SP/campaign experience.
 *
 * Signals:
 *   - Elevated R2 monetization (spending_ceiling > 0 or pay_to_win > 0)
 *     on games that are primarily single-player
 *   - High stranger_risk or social_obligation on games not known as social games
 *   - requiresInternet = 'always' but game has offline SP content
 *   - No bundledOnlineNote set yet
 */
import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env') })
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false })

  // ── 1. High monetization risk with no bundledOnlineNote ─────────────────────
  const monetizHigh = await sql`
    SELECT g.title, g.slug, g.developer,
           gs.bds, gs.ris, gs.curascore, gs.time_rec_minutes,
           gs.monetization_risk, gs.dopamine_risk, gs.social_risk,
           r.spending_ceiling, r.pay_to_win, r.currency_obfuscation,
           r.child_targeting, r.spending_prompts,
           r.stranger_risk, r.social_obligation, r.competitive_toxicity,
           r.infinite_play, r.fomo_events,
           g.requires_internet, g.has_stranger_chat
    FROM games g
    JOIN game_scores gs ON gs.game_id = g.id
    LEFT JOIN reviews r ON r.id = gs.review_id
    WHERE g.bundled_online_note IS NULL
      AND (
        gs.monetization_risk > 0.15
        OR (gs.social_risk > 0.40 AND g.has_stranger_chat = true)
        OR (r.spending_ceiling >= 2 AND gs.curascore > 50)
      )
    ORDER BY gs.monetization_risk DESC, gs.ris DESC
    LIMIT 40
  `

  console.log(`\n── Candidates: elevated monetization or social risk, no bundledOnlineNote (${monetizHigh.length} found) ──\n`)
  console.log(`${'Title'.padEnd(42)} ${'Cura'.padStart(4)} ${'RIS'.padStart(5)} ${'Mon'.padStart(5)} ${'Soc'.padStart(5)} ${'Dop'.padStart(5)}  SpCeil P2W  StrRisk  FOMO  InfPlay  Internet`)
  console.log('─'.repeat(145))
  for (const r of monetizHigh) {
    console.log(
      `${String(r.title).slice(0, 41).padEnd(42)}` +
      ` ${String(r.curascore).padStart(4)}` +
      ` ${Number(r.ris).toFixed(2).padStart(5)}` +
      ` ${Number(r.monetization_risk).toFixed(2).padStart(5)}` +
      ` ${Number(r.social_risk).toFixed(2).padStart(5)}` +
      ` ${Number(r.dopamine_risk).toFixed(2).padStart(5)}` +
      `  ${String(r.spending_ceiling ?? 0).padStart(6)}` +
      ` ${String(r.pay_to_win ?? 0).padStart(3)}` +
      ` ${String(r.stranger_risk ?? 0).padStart(8)}` +
      ` ${String(r.fomo_events ?? 0).padStart(5)}` +
      ` ${String(r.infinite_play ?? 0).padStart(8)}` +
      `  ${r.requires_internet ?? 'null'}`
    )
  }

  // ── 2. Games with very high total RIS that might be SP-primary ───────────────
  const highRis = await sql`
    SELECT g.title, g.slug, g.developer, g.genres,
           gs.ris, gs.curascore, gs.time_rec_minutes,
           gs.dopamine_risk, gs.monetization_risk, gs.social_risk,
           r.spending_ceiling, r.pay_to_win, r.stranger_risk,
           r.fomo_events, r.infinite_play, r.variable_rewards,
           g.requires_internet, g.has_stranger_chat, g.has_microtransactions
    FROM games g
    JOIN game_scores gs ON gs.game_id = g.id
    LEFT JOIN reviews r ON r.id = gs.review_id
    WHERE g.bundled_online_note IS NULL
      AND gs.ris > 0.45
      AND gs.curascore > 35
    ORDER BY gs.ris DESC
    LIMIT 30
  `

  console.log(`\n\n── High RIS (>0.45) with no bundledOnlineNote — possible online contamination (${highRis.length} found) ──\n`)
  console.log(`${'Title'.padEnd(42)} ${'Cura'.padStart(4)} ${'RIS'.padStart(5)} ${'Mon'.padStart(5)} ${'Soc'.padStart(5)} ${'Dop'.padStart(5)}  MTX  StChat  Genres`)
  console.log('─'.repeat(130))
  for (const r of highRis) {
    const genres = ((r.genres as string[]) ?? []).slice(0,3).join(', ')
    console.log(
      `${String(r.title).slice(0, 41).padEnd(42)}` +
      ` ${String(r.curascore).padStart(4)}` +
      ` ${Number(r.ris).toFixed(2).padStart(5)}` +
      ` ${Number(r.monetization_risk).toFixed(2).padStart(5)}` +
      ` ${Number(r.social_risk).toFixed(2).padStart(5)}` +
      ` ${Number(r.dopamine_risk).toFixed(2).padStart(5)}` +
      `  ${r.has_microtransactions ? 'yes' : 'no '.padEnd(3)}` +
      `  ${r.has_stranger_chat ? 'yes' : 'no '.padEnd(5)}` +
      `  ${genres}`
    )
  }

  await sql.end()
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
