/**
 * UGC catalogue quality floor.
 *
 * UGC platforms (Roblox, Fortnite Creative) expose a long tail of junk: empty
 * developer templates ("Baseplate"), raw guest creators ("Guest_800000…"), and
 * — most dangerously — exploitation tooling ("Lua Script Execution", "Free
 * Admin") that the AI scorer can mistake for a creative sandbox and award a
 * high LumiScore. A parent-facing catalogue must not surface these.
 *
 * Two independent mechanisms live here:
 *
 *   1. LISTING FLOOR — `passesListingQualityFloor`. Used by catalogue listing
 *      queries to decide what appears in a browse grid. Hides junk titles, junk
 *      creators, exploit tooling, and entries below a minimum engagement
 *      threshold. Detail pages stay reachable by direct URL; we only suppress
 *      *listing*.
 *
 *   2. SCORING DENYLIST — `isExploitTooling`. Used by the scoring pipeline to
 *      guarantee that experiences whose primary function is script execution /
 *      free admin / exploit tooling can never receive a high score — they are
 *      quarantined into the "Not enough info to rate" / flagged state pending
 *      human review, regardless of what the AI returns.
 *
 * Patterns are intentionally conservative (anchored to the named failure modes
 * from the June 2026 audit) to avoid hiding legitimate niche experiences.
 */

// ─── Patterns ──────────────────────────────────────────────────────────────────

/**
 * Exploitation / cheating tooling. These experiences exist to run arbitrary
 * Lua, hand out free admin, or distribute exploits — never legitimate
 * children's content, and never eligible for a high score.
 */
const EXPLOIT_TOOLING_PATTERNS: RegExp[] = [
  /\bscript\s*(execution|executor|exec|hub|ware)\b/i,
  /\blua\s*(script|execution|executor|c\b)/i,
  /\bfree\s*admin\b/i,
  /\badmin\s*(commands?|abuse)\b/i,
  /\b(exploit|exploiting|executor)\b/i,
  /\b(synapse\s*x|fluxus|krnl|scriptware|script\s*hub)\b/i,
  /\b(aim\s*bot|aimbot|esp\s*hack|cheat\s*(menu|engine)|hack\s*script)\b/i,
]

/**
 * Empty / placeholder developer templates and obvious garbage uploads. These
 * are the default Roblox Studio scaffolds and test places that occasionally
 * accumulate visits but contain no real experience.
 */
const JUNK_TITLE_PATTERNS: RegExp[] = [
  /\bbaseplate\b/i,                       // "Baseplate", "a true baseplate"
  /^\s*\[?\s*place\s*\d+\s*\]?/i,         // "Place 1", "[Place 1] …"
  /\btest\s*place\b/i,
  /\bstarter\s*place\b/i,
  // Bare Studio-default scaffold name only — must NOT match a real title that
  // merely contains the word (e.g. "UNTITLED RPG GAME", "Untitled Goose Game").
  /^\s*untitled(\s+(game|place|world|experience))?\s*$/i,
  /^\s*my\s+(first\s+)?(place|game|world)\s*$/i,
  /^\s*(new|empty|blank)\s+(place|game|world|baseplate)\s*$/i,
]

/**
 * Raw / anonymous creator handles that indicate the experience was never
 * published by a real, identifiable creator.
 */
const JUNK_CREATOR_PATTERNS: RegExp[] = [
  /^\s*guest[_\s]?\d+\s*$/i,   // "Guest_800000000000"
  /^\s*guest\s*$/i,
  /^\s*\d+\s*$/,               // raw numeric user/group id with no name
  /^\s*(user|player)[_\s]?\d+\s*$/i,
]

/**
 * Minimum lifetime visits for an experience to appear in a catalogue listing.
 * Known-low-engagement entries are suppressed (the "high score + tiny
 * engagement" smell); entries with unknown visit counts are not excluded on
 * this basis (they fall back to pattern checks and the rating pipeline).
 */
export const MIN_VISITS_FOR_LISTING = 1_000

// ─── Helpers ───────────────────────────────────────────────────────────────────

const matchesAny = (patterns: RegExp[], value: string | null | undefined): boolean => {
  if (!value) return false
  return patterns.some((re) => re.test(value))
}

/**
 * True when the experience's primary function is exploit / cheat / free-admin
 * tooling. This is the scoring denylist: a match here must never receive a
 * high score and is routed to the flagged "needs human review" state.
 */
export function isExploitTooling(
  title: string | null | undefined,
  description?: string | null | undefined,
): boolean {
  return matchesAny(EXPLOIT_TOOLING_PATTERNS, title)
    || matchesAny(EXPLOIT_TOOLING_PATTERNS, description)
}

export type QualityFloorInput = {
  title:         string | null | undefined
  creatorName:   string | null | undefined
  description?:  string | null | undefined
  visitCount:    number | null | undefined
  activePlayers?: number | null | undefined
}

export type QualityFloorResult =
  | { ok: true }
  | { ok: false; reason: 'exploit_tooling' | 'junk_title' | 'junk_creator' | 'below_visit_floor' }

/**
 * Decide whether an experience is allowed to appear in a catalogue listing.
 * Returns a structured result so callers (and the audit script) can report
 * *why* something was filtered.
 */
export function passesListingQualityFloor(exp: QualityFloorInput): QualityFloorResult {
  if (isExploitTooling(exp.title, exp.description)) {
    return { ok: false, reason: 'exploit_tooling' }
  }
  if (matchesAny(JUNK_TITLE_PATTERNS, exp.title)) {
    return { ok: false, reason: 'junk_title' }
  }
  if (matchesAny(JUNK_CREATOR_PATTERNS, exp.creatorName)) {
    return { ok: false, reason: 'junk_creator' }
  }
  // Only exclude on engagement when we actually have a visit count to judge by.
  if (exp.visitCount != null && exp.visitCount < MIN_VISITS_FOR_LISTING) {
    return { ok: false, reason: 'below_visit_floor' }
  }
  return { ok: true }
}

/** Convenience boolean wrapper for the common "should this be listed?" call. */
export function isListable(exp: QualityFloorInput): boolean {
  return passesListingQualityFloor(exp).ok
}
