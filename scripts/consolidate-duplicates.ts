/**
 * Consolidate DLC / expansion / edition pollution in the games catalog.
 *
 * - Drops 5 confirmed DLC / expansion / season-pass rows (DLC Quest is kept;
 *   it's the name of a real standalone indie game).
 * - For each base+edition duplicate cluster, picks the base-game row as
 *   the canonical survivor and merges the edition row into it: re-points
 *   user_games / game_tips / game_feedback / notifications / epic_library
 *   to the survivor, deletes the edition's review / scores / compliance
 *   rows, then deletes the edition row.
 * - Registers a slug_redirects entry (from=loser, to=winner) so external
 *   links to the dropped slug 301 to the canonical page.
 *
 * Safety guards:
 *   - A cluster is consolidated only when it has exactly one base-titled
 *     row and ≥1 edition-titled rows. 0 bases or 2+ bases → skipped.
 *   - If any edition's release_date is more than 365 days from the base
 *     row's release_date, the cluster is skipped (probably a separate
 *     game like Tomb Raider Anniversary 2007 vs Tomb Raider 1996).
 *   - Each cluster runs in its own transaction; a failed cluster doesn't
 *     abort the others.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'

const DRY_RUN = process.argv.includes('--dry-run')

const HARD_DLC_DELETES: { id: number; redirectTo?: string; note: string }[] = [
  { id: 3075,  note: 'Ninja Turdle - Coronavirus DLC' },
  { id: 5931,  note: 'Mafia II DLC: Jimmy\'s Vendetta', redirectTo: 'mafia-ii' },
  { id: 5998,  note: 'Sniper Ghost Warrior 3 Season Pass Edition' },
  { id: 12678, note: 'RACE: Caterham Expansion' },
  { id: 1339,  note: 'Splatoon 2: Octo Expansion' },
  // 13766 dlc-quest — KEPT (real standalone indie game)
]

// Strong re-release keywords: nearly always the same product, just refurbished
// or bundled with DLC. Consolidate regardless of release-date drift.
const STRONG_RERELEASE_PATTERNS: RegExp[] = [
  /\bdeluxe edition\b/i,
  /\bgold edition\b/i,
  /\bultimate edition\b/i,
  /\bpremium edition\b/i,
  /\bcomplete edition\b/i,
  /\b(game of the year|goty)\b/i,
  /\bdefinitive edition\b/i,
  /\bremaster(ed)?\b/i,
]

// Ambiguous: "Anniversary" can mean a remaster (Halo 2 Anniversary, 2014)
// OR a separate "celebration" game (Tomb Raider Anniversary, 2007 — a
// new release that retells the 1996 game's story). Apply a release-date
// sanity guard only here.
const AMBIGUOUS_PATTERNS: RegExp[] = [
  /\banniversary( edition)?\b/i,
]

function isStrongRerelease(t: string): boolean {
  return STRONG_RERELEASE_PATTERNS.some(re => re.test(t))
}
function isAmbiguous(t: string): boolean {
  return AMBIGUOUS_PATTERNS.some(re => re.test(t))
}
function isEditionTitle(t: string): boolean {
  return isStrongRerelease(t) || isAmbiguous(t)
}

function baseTitleKey(t: string): string {
  return t
    .replace(/[:\-–—]\s*(deluxe|gold|ultimate|premium|complete|game of the year|goty|definitive|remaster(ed)?|anniversary|hd|enhanced|special)\b.*$/i, '')
    .replace(/\b(deluxe|gold|ultimate|premium|complete|game of the year|goty|definitive|remastered|remaster|anniversary|hd remaster|hd remastered|enhanced)\s+edition\b/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

type Row = {
  id: number
  slug: string
  title: string
  releaseDate: Date | null
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}\n`)

  // ─── Step 1: hard DLC / expansion deletes ─────────────────────────────────
  console.log('━'.repeat(80))
  console.log('STEP 1 — Hard DLC / expansion deletes')
  console.log('━'.repeat(80))

  for (const item of HARD_DLC_DELETES) {
    const [row] = await sql<Row[]>`SELECT id, slug, title FROM games WHERE id = ${item.id}`
    if (!row) {
      console.log(`  · id=${item.id}  already gone — skip`)
      continue
    }
    let redirectToSlug: string | null = null
    if (item.redirectTo) {
      const [t] = await sql<{ slug: string }[]>`SELECT slug FROM games WHERE slug = ${item.redirectTo}`
      redirectToSlug = t?.slug ?? null
    }
    console.log(`\n  ▶ id=${row.id}  ${row.slug}  →  ${row.title}`)
    console.log(`     redirect: ${redirectToSlug ?? '(none — slug will 404)'}`)

    if (DRY_RUN) continue

    try {
      await sql.begin(async tx => {
        await deleteGameRow(tx, row.id)
        if (redirectToSlug) {
          await tx`
            INSERT INTO slug_redirects (from_slug, to_slug)
            VALUES (${row.slug}, ${redirectToSlug})
            ON CONFLICT (from_slug) DO UPDATE SET to_slug = EXCLUDED.to_slug
          `
        }
      })
      console.log(`     ✓ deleted`)
    } catch (e) {
      console.error(`     ✗ failed: ${(e as Error).message}`)
    }
  }

  // ─── Step 2: base + edition consolidation ─────────────────────────────────
  console.log('\n' + '━'.repeat(80))
  console.log('STEP 2 — Base + edition consolidation')
  console.log('━'.repeat(80))

  const rows = await sql<Row[]>`
    SELECT g.id, g.slug, g.title, g.release_date AS "releaseDate"
    FROM games g
    JOIN game_scores gs ON gs.game_id = g.id
    WHERE g.content_type = 'standalone_game'
  `

  const byBase = new Map<string, Row[]>()
  for (const r of rows) {
    const key = baseTitleKey(r.title)
    if (!key) continue
    if (!byBase.has(key)) byBase.set(key, [])
    byBase.get(key)!.push(r)
  }

  let consolidated = 0
  let skipped = 0
  const skips: { key: string; reason: string; rows: Row[] }[] = []

  for (const [key, items] of byBase) {
    if (items.length < 2) continue
    if (!items.some(it => isEditionTitle(it.title))) continue

    const bases = items.filter(it => !isEditionTitle(it.title))
    const editions = items.filter(it => isEditionTitle(it.title))

    if (bases.length !== 1) {
      skips.push({ key, reason: `${bases.length} base candidates (need exactly 1)`, rows: items })
      skipped++
      continue
    }
    const winner = bases[0]!

    // Sanity guard for RAWG slug-collision artifacts: if the winner's slug
    // ends in -N (a digit) but the title doesn't mention that number, the
    // row may actually be a numbered sequel mis-titled in our DB
    // (e.g. slug=jurassic-world-evolution-2, title="Jurassic World Evolution").
    const trailingNum = winner.slug.match(/-(\d+)$/)?.[1]
    if (trailingNum && !new RegExp(`\\b${trailingNum}\\b`).test(winner.title)) {
      skips.push({
        key,
        reason: `winner slug has trailing -${trailingNum} not in title — possible mis-titled sequel`,
        rows: items,
      })
      skipped++
      continue
    }

    // Strong re-release titles (Definitive/Remaster/Ultimate/Complete/GOTY/
    // Gold/Deluxe/Premium) are trusted regardless of release-date drift.
    // Ambiguous titles ("Anniversary") require dates within 365 days.
    const safeEditions: Row[] = []
    const driftSkipped: Row[] = []
    for (const ed of editions) {
      if (isStrongRerelease(ed.title)) {
        safeEditions.push(ed)
        continue
      }
      // ambiguous → require date proximity
      if (winner.releaseDate && ed.releaseDate) {
        const diffDays = Math.abs(
          (winner.releaseDate.getTime() - ed.releaseDate.getTime()) / 86_400_000
        )
        if (diffDays > 365) {
          driftSkipped.push(ed)
          continue
        }
        safeEditions.push(ed)
      } else {
        driftSkipped.push(ed)  // no date and ambiguous → too risky
      }
    }
    if (driftSkipped.length) {
      skips.push({
        key,
        reason: `release-date drift > 365d on ${driftSkipped.map(r => r.slug).join(', ')}`,
        rows: driftSkipped,
      })
    }
    if (safeEditions.length === 0) {
      skipped++
      continue
    }

    console.log(`\n  ▶ "${key}"`)
    console.log(`     winner: id=${winner.id}  ${winner.slug}  (${winner.title})`)
    for (const ed of safeEditions) {
      console.log(`     loser:  id=${ed.id}  ${ed.slug}  (${ed.title})`)
    }

    if (DRY_RUN) { consolidated += safeEditions.length; continue }

    for (const loser of safeEditions) {
      try {
        await sql.begin(async tx => {
          // 1) migrate user-facing FK rows from loser → winner
          await tx`
            DELETE FROM user_games
            WHERE game_id = ${loser.id}
              AND (user_id, list_type) IN (
                SELECT user_id, list_type FROM user_games WHERE game_id = ${winner.id}
              )
          `
          await tx`UPDATE user_games  SET game_id = ${winner.id} WHERE game_id = ${loser.id}`
          await tx`UPDATE game_tips    SET game_id = ${winner.id} WHERE game_id = ${loser.id}`
          await tx`UPDATE game_feedback SET game_id = ${winner.id} WHERE game_id = ${loser.id}`
          await tx`UPDATE notifications SET game_id = ${winner.id} WHERE game_id = ${loser.id}`
          await tx`UPDATE epic_library  SET game_id = ${winner.id} WHERE game_id = ${loser.id}`

          // 2) delete loser's review chain + scores + compliance + translations
          await deleteGameRow(tx, loser.id)

          // 3) register slug redirect
          await tx`
            INSERT INTO slug_redirects (from_slug, to_slug)
            VALUES (${loser.slug}, ${winner.slug})
            ON CONFLICT (from_slug) DO UPDATE SET to_slug = EXCLUDED.to_slug
          `
        })
        console.log(`     ✓ ${loser.slug} → ${winner.slug}`)
        consolidated++
      } catch (e) {
        console.error(`     ✗ ${loser.slug} failed: ${(e as Error).message}`)
      }
    }
  }

  // ─── Step 3: report skipped clusters ──────────────────────────────────────
  console.log('\n' + '━'.repeat(80))
  console.log(`STEP 3 — Skipped clusters (need manual review): ${skips.length}`)
  console.log('━'.repeat(80))
  for (const s of skips) {
    console.log(`\n  · "${s.key}" — ${s.reason}`)
    for (const r of s.rows) {
      console.log(`      id=${r.id}  ${r.slug}  →  ${r.title}  (${r.releaseDate?.toISOString().slice(0,10) ?? 'no date'})`)
    }
  }

  console.log('\n' + '━'.repeat(80))
  console.log(`SUMMARY`)
  console.log('━'.repeat(80))
  console.log(`Hard DLC deletes attempted: ${HARD_DLC_DELETES.length}`)
  console.log(`Edition rows consolidated:  ${consolidated}`)
  console.log(`Clusters skipped:           ${skipped}`)
  if (DRY_RUN) console.log(`\n(dry-run — no writes performed)`)

  await sql.end()
}

/**
 * Delete a game and all of its no-cascade FK children, in FK-safe order.
 * Cascade-FK children (game_translations, etc.) are removed automatically.
 * Caller is responsible for migrating user-facing rows BEFORE calling this.
 */
async function deleteGameRow(tx: postgres.TransactionSql, gameId: number) {
  // dark_patterns → reviews (no cascade); must clear DPs first
  await tx`
    DELETE FROM dark_patterns
    WHERE review_id IN (SELECT id FROM reviews WHERE game_id = ${gameId})
  `
  await tx`DELETE FROM game_scores       WHERE game_id = ${gameId}`
  await tx`DELETE FROM reviews           WHERE game_id = ${gameId}`
  await tx`DELETE FROM compliance_status WHERE game_id = ${gameId}`
  await tx`DELETE FROM games             WHERE id      = ${gameId}`
}

main().catch(e => { console.error(e); process.exit(1) })
