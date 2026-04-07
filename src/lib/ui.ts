// Shared UI helpers — import these instead of duplicating color logic.

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
