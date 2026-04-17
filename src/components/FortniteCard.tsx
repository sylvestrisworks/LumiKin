'use client'

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { curascoreBg } from '@/lib/ui'
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
  const t = useTranslations('fortnite')
  const locale = useLocale()
  const hasHighStrangerRisk = (exp.strangerRisk ?? 0) >= 2
  const hasHighMonetization = (exp.monetizationScore ?? 0) >= 2

  return (
    <Link
      href={`/${locale}/game/fortnite-creative/${exp.slug}`}
      className="group flex flex-col bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500 transition-all"
    >
      {/* Thumbnail */}
      <div className="relative h-28 bg-blue-50 dark:bg-blue-900/40 overflow-hidden shrink-0">
        {exp.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exp.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-violet-100 dark:from-blue-900/40 dark:to-violet-900/40">
            <span className="text-2xl font-black text-blue-300 dark:text-blue-500 select-none">
              {exp.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* LumiScore chip — top right */}
        {exp.curascore != null && (
          <div className={`absolute top-1.5 right-1.5 ${curascoreBg(exp.curascore)} text-white text-xs font-black px-1.5 py-0.5 rounded-full`}>
            {exp.curascore}
          </div>
        )}

        {/* Min age badge — bottom left */}
        {exp.recommendedMinAge != null && (
          <div className="absolute bottom-1.5 left-1.5 bg-slate-700 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
            {exp.recommendedMinAge}+
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight line-clamp-2 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
          {exp.title}
        </p>

        {exp.creatorName && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 px-1.5 py-0.5 rounded-full truncate max-w-full">
              {exp.creatorName}
            </span>
          </div>
        )}

        {exp.timeRecommendationMinutes != null && (
          <div className="mt-auto pt-1">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {exp.timeRecommendationMinutes} min/day
            </span>
          </div>
        )}

        {(hasHighStrangerRisk || hasHighMonetization) && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {hasHighStrangerRisk && (
              <span className="text-xs text-amber-600 dark:text-amber-400">👥 {t('strangerRisk')}</span>
            )}
            {hasHighMonetization && (
              <span className="text-xs text-amber-600 dark:text-amber-400">💰 {t('vBucksPressure')}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
