'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { RUBRIC_DIMENSION_COUNT } from '@/lib/methodology'

type Props = {
  calculatedAt: string
  methodologyVersion: string | null
  scoringMethod: string | null
  updatedAt: string | null
  locale: string
}

export function ScoreMetaLine({ calculatedAt, methodologyVersion, scoringMethod, updatedAt, locale }: Props) {
  const t = useTranslations('scoreMeta')

  const relativeLabel = (iso: string): string => {
    const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 1) return t('scoredToday')
    if (diffDays < 7) return t('scoredDaysAgo',  { n: diffDays })
    if (diffDays < 60) return t('scoredWeeksAgo', { n: Math.floor(diffDays / 7) })
    return new Date(iso).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
  }

  const methodFor = (method: string | null): { label: string; tooltip: string } | null => {
    if (method === 'full_rubric')  return { label: t('methodFullRubricLabel', { n: RUBRIC_DIMENSION_COUNT }), tooltip: t('methodFullRubricTooltip', { n: RUBRIC_DIMENSION_COUNT }) }
    if (method === 'ugc_adapted')  return { label: t('methodUgcLabel'),  tooltip: t('methodUgcTooltip')  }
    if (method === 'hand_curated') return { label: t('methodHandLabel'), tooltip: t('methodHandTooltip') }
    return null
  }

  const scoredLabel  = relativeLabel(calculatedAt)
  const updatedLabel = updatedAt ? relativeLabel(updatedAt) : null
  const method       = methodFor(scoringMethod)

  return (
    <p className="text-[13px] text-muted text-center leading-relaxed">
      {t('scoredPrefix', { when: scoredLabel })}
      {methodologyVersion && (
        <>
          {' · '}
          <Link
            href={`/${locale}/methodology?version=${methodologyVersion}`}
            className="hover:text-ink underline underline-offset-2 decoration-rule transition-colors"
          >
            {t('methodologyVersion', { version: methodologyVersion })}
          </Link>
        </>
      )}
      {method && (
        <>
          {' · '}
          <span
            title={method.tooltip}
            className="cursor-help underline underline-offset-2 decoration-dotted decoration-rule"
          >
            {method.label}
          </span>
        </>
      )}
      {updatedLabel && (
        <>{' · '}{t('lastUpdated', { when: updatedLabel })}</>
      )}
    </p>
  )
}
