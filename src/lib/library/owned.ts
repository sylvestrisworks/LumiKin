/**
 * Shared write helpers for a user's owned-games library (`user_games`).
 *
 * Centralises the insert/dedupe/provenance logic used by every import path
 * (Steam route, Epic cron, GOG cron). The key invariant: a game is a single
 * `owned` row per user regardless of how many platforms it came from. The
 * `source` column records the *primary* importer and is only upgraded away
 * from 'manual' — a platform import claims a hand-added entry, but one platform
 * never clobbers another's attribution.
 */

import { db } from '@/lib/db'
import { userGames } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

export type LibrarySource = 'manual' | 'steam' | 'epic' | 'gog' | 'xbox'

/**
 * Pure decision logic for {@link upsertOwnedGames}, split out so it can be
 * unit-tested without a database. Given the games already owned by the user
 * (gameId → current source) and the incoming gameIds/source, decide which ids
 * to insert fresh and which existing 'manual' rows this platform should claim.
 */
export function planOwnedUpserts(
  existing: Map<number, string>,
  gameIds: number[],
  source: LibrarySource,
): { toInsertIds: number[]; toClaimIds: number[] } {
  const uniqueIds = Array.from(new Set(gameIds))

  const toInsertIds = uniqueIds.filter(id => !existing.has(id))

  // A platform import claims a hand-added ('manual') row, but one platform
  // never overwrites another platform's attribution.
  const toClaimIds = source === 'manual'
    ? []
    : uniqueIds.filter(id => existing.get(id) === 'manual')

  return { toInsertIds, toClaimIds }
}

/**
 * Add games to a user's owned library, tagged with `source`.
 *
 * - Games not yet owned are inserted as `owned` with the given source.
 * - Games already owned with source `'manual'` are upgraded to the given source.
 * - Games already owned from another platform are left untouched.
 *
 * Returns the number of *newly added* rows (existing rows are not counted).
 */
export async function upsertOwnedGames(
  userId: string,
  gameIds: number[],
  source: LibrarySource,
): Promise<{ added: number }> {
  const uniqueIds = Array.from(new Set(gameIds))
  if (uniqueIds.length === 0) return { added: 0 }

  const existing = await db
    .select({ gameId: userGames.gameId, source: userGames.source })
    .from(userGames)
    .where(
      and(
        eq(userGames.userId, userId),
        eq(userGames.listType, 'owned'),
        inArray(userGames.gameId, uniqueIds),
      ),
    )

  const existingMap = new Map(existing.map(r => [r.gameId, r.source]))
  const { toInsertIds, toClaimIds } = planOwnedUpserts(existingMap, uniqueIds, source)

  const toInsert = toInsertIds.map(gameId => ({ userId, gameId, listType: 'owned' as const, source }))

  if (toInsert.length > 0) {
    await db.insert(userGames).values(toInsert).onConflictDoNothing()
  }

  if (toClaimIds.length > 0) {
    await db
      .update(userGames)
      .set({ source })
      .where(
        and(
          eq(userGames.userId, userId),
          eq(userGames.listType, 'owned'),
          eq(userGames.source, 'manual'),
          inArray(userGames.gameId, toClaimIds),
        ),
      )
  }

  return { added: toInsert.length }
}

/** Remove only the owned games attributed to a given platform (used on disconnect). */
export async function removeOwnedBySource(
  userId: string,
  source: LibrarySource,
): Promise<void> {
  await db
    .delete(userGames)
    .where(
      and(
        eq(userGames.userId, userId),
        eq(userGames.listType, 'owned'),
        eq(userGames.source, source),
      ),
    )
}
