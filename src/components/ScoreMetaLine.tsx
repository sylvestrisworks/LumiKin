import Link from 'next/link'
import { RUBRIC_DIMENSION_COUNT } from '@/lib/methodology'

function relativeDate(iso: string): string {
  const diffMs   = Date.now() - new Date(iso).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 1)  return 'today'
  if (diffDays < 7)  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  if (diffDays < 60) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  }
  return new Date(iso).toLocaleDateString('en', { month: 'short', year: 'numeric' })
}

const SCORING_METHOD_LABEL: Record<string, { label: string; tooltip: string }> = {
  full_rubric:  { label: `${RUBRIC_DIMENSION_COUNT}-dim rubric`,  tooltip: `Scored across ${RUBRIC_DIMENSION_COUNT} dimensions by the standard LumiKin rubric.` },
  ugc_adapted:  { label: 'UGC adapted',    tooltip: 'Scored on 9 dimensions adapted from the standard rubric. Risk and benefit weights match; granularity is coarser.' },
  hand_curated: { label: 'Hand-curated',   tooltip: 'Scored by an editor rather than the automated pipeline.' },
}

type Props = {
  calculatedAt: string
  methodologyVersion: string | null
  scoringMethod: string | null
  updatedAt: string | null
  locale: string
}

export function ScoreMetaLine({ calculatedAt, methodologyVersion, scoringMethod, updatedAt, locale }: Props) {
  const scoredLabel  = relativeDate(calculatedAt)
  const updatedLabel = updatedAt ? relativeDate(updatedAt) : null
  const method       = scoringMethod ? SCORING_METHOD_LABEL[scoringMethod] : null

  return (
    <p className="text-[13px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
      Scored {scoredLabel}
      {methodologyVersion && (
        <>
          {' · '}
          <Link
            href={`/${locale}/methodology?version=${methodologyVersion}`}
            className="hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-2 decoration-slate-300 dark:decoration-slate-600 transition-colors"
          >
            Methodology v{methodologyVersion}
          </Link>
        </>
      )}
      {method && (
        <>
          {' · '}
          <span
            title={method.tooltip}
            className="cursor-help underline underline-offset-2 decoration-dotted decoration-slate-300 dark:decoration-slate-600"
          >
            {method.label}
          </span>
        </>
      )}
      {updatedLabel && (
        <>{' · '}Last updated {updatedLabel}</>
      )}
    </p>
  )
}
