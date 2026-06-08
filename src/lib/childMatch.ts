// Shared child-appropriateness & library-stat helpers.
//
// These were previously duplicated (and subtly inconsistent) between the
// Library and Dashboard pages. Import from here so both surfaces agree on
// what a child can play and how a library scores.

import { calcAge } from '@/lib/age'

// ─── ESRB → minimum age ───────────────────────────────────────────────────────

/**
 * Convert an ESRB rating to a minimum age for appropriateness filtering.
 * Single source of truth — accepts both `E10` and `E10+` so callers don't have
 * to care which form the data uses. `E` ("Everyone") stays at 0: it suits all
 * ages, so it must not be hidden from the youngest children. T→13, M→17, AO→18.
 */
export function esrbToMinAge(rating: string | null | undefined): number | null {
  switch (rating) {
    case 'E':    return 0
    case 'E10':
    case 'E10+': return 10
    case 'T':    return 13
    case 'M':    return 17
    case 'AO':   return 18
    default:     return null
  }
}

// ─── Skill → score column mapping ────────────────────────────────────────────

export type ScoreKey = 'cognitiveScore' | 'socialEmotionalScore' | 'motorScore'

export const SKILL_SCORE: Record<string, ScoreKey> = {
  cognitive:       'cognitiveScore',
  problem_solving: 'cognitiveScore',
  creativity:      'cognitiveScore',
  social:          'socialEmotionalScore',
  teamwork:        'socialEmotionalScore',
  motor:           'motorScore',
}

export const SKILL_SCORE_THRESHOLD = 0.3

// ─── Structural row / child shapes ───────────────────────────────────────────
// Accept the minimum each query happens to select, so both pages' row shapes
// satisfy these without coupling to a single select().

export type MatchableGame = {
  esrbRating: string | null
  platforms: unknown
  recommendedMinAge: number | null
  cognitiveScore?: number | null
  socialEmotionalScore?: number | null
  motorScore?: number | null
}

export type MatchableChild = {
  birthDate: string | null
  birthYear: number
  platforms: unknown
  focusSkills?: unknown
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : []
}

// ─── Age fit ──────────────────────────────────────────────────────────────────

/** Effective minimum age for a game: explicit recommendation, else ESRB fallback. */
export function gameMinAge(game: MatchableGame): number | null {
  return game.recommendedMinAge ?? esrbToMinAge(game.esrbRating)
}

/**
 * Age fit for a game against a child age.
 * `gap` is how many years too young the child is (0 when they fit, null when
 * the game has no known minimum age).
 */
export function ageFit(game: MatchableGame, childAge: number): {
  fits: boolean
  minAge: number | null
  gap: number | null
} {
  const minAge = gameMinAge(game)
  if (minAge == null) return { fits: true, minAge: null, gap: null }
  const gap = Math.max(0, minAge - childAge)
  return { fits: gap === 0, minAge, gap }
}

// ─── Appropriateness ───────────────────────────────────────────────────────────

/**
 * Full age + platform + skill-focus check used by the Library filter.
 * Unscored games always pass the skill filter (we can't evaluate them yet).
 * Pass `ignoreAge` to skip the age gate — used for the wishlist, where we want
 * to *show* too-young titles and flag them rather than hide them.
 */
export function isAppropriate(
  game: MatchableGame,
  child: MatchableChild,
  opts: { ignoreAge?: boolean } = {},
): boolean {
  const age = calcAge(child.birthDate, child.birthYear)

  // Age
  const minAge = gameMinAge(game)
  const ageOk = opts.ignoreAge || minAge == null || minAge <= age

  // Platform
  const childPlats = asStringArray(child.platforms)
  const gamePlats = asStringArray(game.platforms)
  const platOk = childPlats.length === 0
    || gamePlats.some(gp => childPlats.some(cp => gp.toLowerCase().includes(cp.toLowerCase())))

  // Skill focus
  const childSkills = asStringArray(child.focusSkills)
  const isUnscored = game.cognitiveScore == null
    && game.socialEmotionalScore == null
    && game.motorScore == null
  const skillOk = childSkills.length === 0 || isUnscored
    || childSkills.some(skill => {
         const col = SKILL_SCORE[skill]
         if (!col) return false
         return ((game[col] as number | null) ?? 0) > SKILL_SCORE_THRESHOLD
       })

  return ageOk && platOk && skillOk
}

/**
 * Dashboard's narrower match: age + platform only (no skill focus), sorted by
 * curascore descending. A thin wrapper so the two surfaces stay in lockstep on
 * the age/platform rules.
 */
export function gamesForChild<T extends MatchableGame & { curascore: number | null }>(
  games: T[],
  childAge: number,
  childPlatforms: string[],
): T[] {
  return games
    .filter(g => {
      const minAge = gameMinAge(g)
      const ageOk = minAge == null || minAge <= childAge
      const gamePlats = asStringArray(g.platforms)
      const platOk = childPlatforms.length === 0
        || gamePlats.some(gp => childPlatforms.some(cp => gp.toLowerCase().includes(cp.toLowerCase())))
      return ageOk && platOk
    })
    .sort((a, b) => (b.curascore ?? 0) - (a.curascore ?? 0))
}

// ─── Library stats ──────────────────────────────────────────────────────────

/** Average curascore across scored games (rounded), or null when none scored. */
export function avgCurascore(games: Array<{ curascore: number | null }>): number | null {
  const scored = games.filter(g => g.curascore != null)
  if (!scored.length) return null
  return Math.round(scored.reduce((s, g) => s + g.curascore!, 0) / scored.length)
}

/** Alias used by the Dashboard's per-child "library health" readout. */
export const libHealthScore = avgCurascore

export type SkillRollup = { key: 'cognitive' | 'social' | 'motor'; avg: number }

/**
 * Top focus skills across a set of scored games, highest average first.
 * Returns the three benefit families ranked; caller slices/labels as needed.
 */
export function topSkills(
  games: Array<{
    cognitiveScore: number | null
    socialEmotionalScore: number | null
    motorScore: number | null
  }>,
): SkillRollup[] {
  const totals = { cognitive: 0, social: 0, motor: 0 }
  let count = 0
  for (const g of games) {
    if (g.cognitiveScore != null || g.socialEmotionalScore != null || g.motorScore != null) {
      totals.cognitive += g.cognitiveScore ?? 0
      totals.social += g.socialEmotionalScore ?? 0
      totals.motor += g.motorScore ?? 0
      count++
    }
  }
  if (count === 0) return []
  return (Object.entries(totals) as Array<['cognitive' | 'social' | 'motor', number]>)
    .map(([key, total]) => ({ key, avg: total / count }))
    .sort((a, b) => b.avg - a.avg)
}
