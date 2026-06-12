/**
 * Manual consolidation of the 8 clusters that the auto-pass skipped.
 * Pairs were hand-verified against release_date and surrounding catalog
 * entries — see scripts/_inspect-skipped-clusters.ts output.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'

const MERGES: { loserId: number; winnerId: number; note: string }[] = [
  // Tomb Raider Definitive Edition is the 2013 reboot's Definitive, not the 1996 game.
  // The 2013 reboot row exists separately as id=885 (slug 'tomb-raider', title "Tomb Raider (2013)").
  { loserId: 1106,  winnerId: 885,  note: 'Tomb Raider: Definitive Edition → Tomb Raider (2013)' },

  // Batman: Arkham City GOTY → base game. (Armored Edition kept; it's a distinct Wii U release.)
  { loserId: 70,    winnerId: 37,   note: 'Arkham City GOTY → Arkham City (slug batman-arkham-city-2 is a RAWG collision artifact)' },

  // Jurassic World Evolution: id=3799 IS JWE1 (release 2018, slug -2 is collision artifact;
  // real JWE2 is id=11446 with slug -2-2).
  { loserId: 3700,  winnerId: 3799, note: 'JWE Complete Edition → JWE1' },

  // Anniversary remasters that are the same product, just refurbished
  { loserId: 5852,  winnerId: 706,   note: 'Halo 2: Anniversary → Halo 2' },
  { loserId: 4305,  winnerId: 9887,  note: 'Titan Quest Anniversary → Titan Quest' },
  { loserId: 11212, winnerId: 97,    note: 'Braid Anniversary → Braid' },
  { loserId: 2557,  winnerId: 2639,  note: 'Grandia II Anniversary → Grandia II (slug -2000 is year disambiguator)' },
  { loserId: 10432, winnerId: 4349,  note: 'Edna & Harvey: The Breakout Anniversary → original' },
]

async function deleteGameRow(tx: postgres.TransactionSql, gameId: number) {
  await tx`
    DELETE FROM dark_patterns
    WHERE review_id IN (SELECT id FROM reviews WHERE game_id = ${gameId})
  `
  await tx`DELETE FROM game_scores       WHERE game_id = ${gameId}`
  await tx`DELETE FROM reviews           WHERE game_id = ${gameId}`
  await tx`DELETE FROM compliance_status WHERE game_id = ${gameId}`
  await tx`DELETE FROM games             WHERE id      = ${gameId}`
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)

  for (const m of MERGES) {
    const [loser]  = await sql<{ id: number; slug: string; title: string }[]>`
      SELECT id, slug, title FROM games WHERE id = ${m.loserId}
    `
    const [winner] = await sql<{ id: number; slug: string; title: string }[]>`
      SELECT id, slug, title FROM games WHERE id = ${m.winnerId}
    `
    if (!loser || !winner) {
      console.log(`✗ skip: ${m.note} (missing row: loser=${!!loser} winner=${!!winner})`)
      continue
    }
    console.log(`\n▶ ${m.note}`)
    console.log(`   ${loser.slug} (id=${loser.id})  →  ${winner.slug} (id=${winner.id})`)

    try {
      await sql.begin(async tx => {
        await tx`
          DELETE FROM user_games
          WHERE game_id = ${loser.id}
            AND (user_id, list_type) IN (
              SELECT user_id, list_type FROM user_games WHERE game_id = ${winner.id}
            )
        `
        await tx`UPDATE user_games   SET game_id = ${winner.id} WHERE game_id = ${loser.id}`
        await tx`UPDATE game_tips    SET game_id = ${winner.id} WHERE game_id = ${loser.id}`
        await tx`UPDATE game_feedback SET game_id = ${winner.id} WHERE game_id = ${loser.id}`
        await tx`UPDATE notifications SET game_id = ${winner.id} WHERE game_id = ${loser.id}`
        await tx`UPDATE epic_library  SET game_id = ${winner.id} WHERE game_id = ${loser.id}`

        await deleteGameRow(tx, loser.id)

        await tx`
          INSERT INTO slug_redirects (from_slug, to_slug)
          VALUES (${loser.slug}, ${winner.slug})
          ON CONFLICT (from_slug) DO UPDATE SET to_slug = EXCLUDED.to_slug
        `
      })
      console.log(`   ✓ merged`)
    } catch (e) {
      console.error(`   ✗ failed: ${(e as Error).message}`)
    }
  }

  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
