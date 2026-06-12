// Bundled-online inheritance.
//
// Policy: LumiKin scores the BASE game; a bundled online/live-service mode is
// surfaced as a separate warning (games.bundledOnlineNote), never folded into
// the score. The scoring prompt honours that flag — but only when it is set.
//
// New editions/remasters (e.g. "Grand Theft Auto V Enhanced") get ingested
// without the note, so the standard prompt folds the online mode back in and
// contradicts the policy. This module detects an edition/remaster of an
// already-flagged title at score time and inherits its note.
//
// Note: this is deliberately limited to editions/remasters of the SAME base
// game — a high-precision match. Franchise-wide inheritance (e.g. flagging
// every yearly sports installment) was rejected because it mislabels spinoffs
// (FIFA Street, NBA 2K Playgrounds) and pre-live-service classics that have no
// bundled online mode. Those are handled by explicit per-title curation.

/** A game we can inherit a bundled-online note from. */
export type FlaggedGame = {
  id: number
  slug: string
  title: string
  bundledOnlineNote: string | null
}

// Edition / remaster / re-release qualifiers that do NOT change the base game
// being scored. Stripped (longest-first) to recover the underlying title.
const EDITION_PHRASES = [
  'game of the year edition', 'game of the year', 'goty edition', 'goty',
  'the definitive edition', 'definitive edition', 'definitive',
  'expanded and enhanced', 'enhanced edition', 'enhanced',
  'complete edition', 'complete',
  'special edition', 'deluxe edition', 'ultimate edition', 'gold edition',
  'legendary edition', 'legacy edition', 'anniversary edition', 'anniversary',
  'remastered', 'remaster', 'redux',
  'next generation', 'next gen', 'current gen',
  'edition',
]

/**
 * Reduce a title to its underlying base game by stripping edition/remaster
 * qualifiers and normalising separators. "Grand Theft Auto V Enhanced" and
 * "Grand Theft Auto V" both reduce to "grand theft auto v".
 */
export function normalizeBaseTitle(title: string): string {
  let t = title
    .toLowerCase()
    .replace(/[:\-–—()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  for (const phrase of EDITION_PHRASES) {
    t = t.replace(new RegExp(`\\b${phrase}\\b`, 'g'), ' ')
  }
  return t.replace(/\s+/g, ' ').trim()
}

export type InheritResult = { note: string; via: string }

/**
 * If `target` is an edition/remaster of an already-flagged game (same base
 * title), return the note to inherit. Returns null when there is no confident
 * match. `flagged` should contain only games with a non-null bundledOnlineNote.
 */
export function findInheritedBundledNote(
  target: { id: number; title: string },
  flagged: FlaggedGame[],
): InheritResult | null {
  const base = normalizeBaseTitle(target.title)
  if (!base) return null
  for (const f of flagged) {
    if (f.id === target.id || !f.bundledOnlineNote) continue
    // Require the flagged sibling to actually be a shorter/equal base form —
    // i.e. the target is the same game plus an edition qualifier, not a
    // different game that merely normalises to the same string by coincidence.
    if (normalizeBaseTitle(f.title) === base) {
      return { note: f.bundledOnlineNote, via: `edition:${f.slug}` }
    }
  }
  return null
}
