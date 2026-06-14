'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

/**
 * Surfaces how a score was reviewed — automated (spot-check audited), editor,
 * or community — as a small labelled badge next to the LumiScore, at the point
 * of decision. The methodology states some scores are `review_tier: automated`;
 * this puts that honesty in front of the parent instead of in the fine print.
 *
 * Each badge links to the relevant methodology anchor.
 */

type TierConfig = {
  labelKey:   string
  tooltipKey: string
  anchor:     string
  className:  string
}

const TIERS: Record<string, TierConfig> = {
  automated: {
    labelKey:   'automatedLabel',
    tooltipKey: 'automatedTooltip',
    // The "AI-generated scores" disclosure lives in the Limitations section.
    anchor:     'limitations-and-edge-cases',
    className:  'border-amber-300 text-amber-700 dark:text-amber-300 dark:border-amber-700',
  },
  expert: {
    labelKey:   'editorLabel',
    tooltipKey: 'editorTooltip',
    anchor:     'overview',
    className:  'border-emerald-300 text-emerald-700 dark:text-emerald-300 dark:border-emerald-700',
  },
  community: {
    labelKey:   'communityLabel',
    tooltipKey: 'communityTooltip',
    anchor:     'overview',
    className:  'border-sky-300 text-sky-700 dark:text-sky-300 dark:border-sky-700',
  },
}

export function ReviewTierBadge({ reviewTier }: { reviewTier: string | null }) {
  const t      = useTranslations('reviewTier')
  const locale = useLocale()

  const config = reviewTier ? TIERS[reviewTier] : null
  if (!config) return null

  return (
    <Link
      href={`/${locale}/methodology#${config.anchor}`}
      title={t(config.tooltipKey)}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors hover:bg-rule/10 ${config.className}`}
    >
      {t(config.labelKey)}
    </Link>
  )
}
