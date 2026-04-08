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

/** Solid background color for a curascore badge (white text). */
export function curascoreBg(score: number | null | undefined): string {
  if (score == null) return 'bg-slate-400'
  if (score >= 70) return 'bg-emerald-600'
  if (score >= 40) return 'bg-amber-500'
  return 'bg-red-600'
}

/** Tinted border/background for a curascore display panel. */
export function curascoreRing(score: number | null | undefined): string {
  if (score == null) return 'bg-slate-50 border-slate-200'
  if (score >= 70) return 'bg-emerald-50 border-emerald-200'
  if (score >= 40) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

/** Gradient for large display scores. */
export function curascoreGradient(score: number): string {
  if (score >= 70) return 'from-emerald-400 to-teal-500'
  if (score >= 40) return 'from-amber-400 to-orange-500'
  return 'from-red-400 to-rose-500'
}

/** Text color for a curascore number rendered on a light background. */
export function curascoreText(score: number | null | undefined): string {
  if (score == null) return 'text-slate-400'
  if (score >= 70) return 'text-emerald-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}
