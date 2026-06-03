// Shared UI helpers — import these instead of duplicating color logic.

// ─── Age / ESRB helpers ───────────────────────────────────────────────────────

/** Convert an ESRB rating to a minimum-age label, e.g. "T" → "13+" */
export function esrbToAge(rating: string | null | undefined): string {
  switch (rating) {
    case 'E':    return '6+'
    case 'E10+': return '10+'
    case 'T':    return '13+'
    case 'M':    return '17+'
    case 'AO':   return '18+'
    default:     return '?'
  }
}

/** Background + text color for an age badge */
export function ageBadgeColor(rating: string | null | undefined): string {
  switch (rating) {
    case 'E':    return 'bg-emerald-500'
    case 'E10+': return 'bg-lime-500'
    case 'T':    return 'bg-amber-500'
    case 'M':    return 'bg-red-500'
    case 'AO':   return 'bg-rose-700'
    default:     return 'bg-slate-400'
  }
}

/** Text color for a curascore number rendered on a light background. */
export function curascoreText(score: number | null | undefined): string {
  if (score == null) return 'text-slate-400'
  if (score >= 70) return 'text-emerald-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

/**
 * Editorial verdict color for a curascore number — maps to the paper-and-ink
 * palette (ivy / warm / accent). Thresholds mirror `lumiScoreVerdict` in
 * GameCardEditorial so the related-games rail agrees with the detail card.
 */
export function curascoreTextEditorial(score: number | null | undefined): string {
  if (score == null) return 'text-muted'
  if (score >= 50) return 'text-ivy'
  if (score >= 35) return 'text-warm'
  return 'text-accent'
}
