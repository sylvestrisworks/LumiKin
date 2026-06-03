'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { curascoreTextEditorial } from '@/lib/ui'
import { CONFIDENCE_THRESHOLD } from '@/lib/scoring/experience-risk'
import type { ExperienceSummary } from '@/components/ExperienceCard'

export type { ExperienceSummary }

function formatCount(n: number | null): string {
  if (n == null) return ''
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function FortniteCard({ exp }: { exp: ExperienceSummary }) {
  const t  = useTranslations('fortnite')
  const tc = useTranslations('common')
  const locale = useLocale()
  const hasHighStrangerRisk = (exp.strangerRisk ?? 0) >= 2
  const hasHighMonetization = (exp.monetizationScore ?? 0) >= 2
  const isPending = (exp.inputConfidence ?? 0) < CONFIDENCE_THRESHOLD

  return (
    <Link
      href={`/${locale}/game/fortnite-creative/${exp.slug}`}
      className={`group flex flex-col border border-rule overflow-hidden hover:border-ink transition-colors ${isPending ? 'grayscale opacity-75 hover:opacity-100 hover:grayscale-0' : ''}`}
    >
      {/* Thumbnail */}
      <div className="relative h-28 bg-rule/30 overflow-hidden shrink-0">
        {exp.thumbnailUrl ? (
          <Image
            src={exp.thumbnailUrl}
            alt=""
            fill
            sizes="160px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-rule/40">
            <span className="text-2xl font-serif text-muted select-none">
              {exp.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {!isPending && exp.recommendedMinAge != null && (
          <div
            className="absolute bottom-1.5 left-1.5 bg-paper text-ink text-kicker uppercase font-semibold px-1.5 py-0.5 leading-none"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {exp.recommendedMinAge}+
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 flex flex-col gap-1 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-serif text-sm text-ink leading-tight line-clamp-2 group-hover:text-accent transition-colors">
            {exp.title}
          </p>
          {!isPending && exp.curascore != null && (
            <span className={`font-serif text-base font-semibold tabular-nums leading-none shrink-0 ${curascoreTextEditorial(exp.curascore)}`}>
              {exp.curascore}
            </span>
          )}
        </div>

        {exp.creatorName && (
          <span className="text-kicker uppercase text-muted truncate max-w-full" style={{ fontVariantCaps: 'all-small-caps' }}>
            {exp.creatorName}
          </span>
        )}

        {isPending ? (
          <div className="mt-auto pt-1">
            <span className="text-xs italic text-muted">
              {tc('notEnoughInfo')}
            </span>
          </div>
        ) : exp.timeRecommendationMinutes != null && (
          <div className="mt-auto pt-1">
            <span className="text-xs text-muted">
              {tc('minPerDay', { n: exp.timeRecommendationMinutes })}
            </span>
          </div>
        )}

        {!isPending && (hasHighStrangerRisk || hasHighMonetization) && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {hasHighStrangerRisk && (
              <span className="text-xs text-warm">👥 {t('strangerRisk')}</span>
            )}
            {hasHighMonetization && (
              <span className="text-xs text-warm">💰 {t('vBucksPressure')}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
