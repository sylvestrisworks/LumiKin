import { getTranslations } from 'next-intl/server'
import type { SiteStats } from '@/lib/stats'

type Props = {
  stats: SiteStats
  variant?: 'partner' | 'parent'
}

export default async function CoverageStrip({ stats, variant = 'partner' }: Props) {
  const totalTitles = stats.total_games_scored + stats.total_ugc_experiences_scored
  const platformCount = stats.platforms.length
  const languageCount = stats.languages.length

  let items: { value: string; label: string }[]

  if (variant === 'parent') {
    const t = await getTranslations('home')
    items = [
      { value: stats.total_games_scored.toLocaleString('en'),  label: t('coverageGamesRated') },
      { value: stats.scored_last_7_days.toLocaleString('en'),  label: t('coverageRatedThisWeek') },
      { value: platformCount.toLocaleString('en'),             label: t('coveragePlatforms') },
    ]
  } else {
    items = [
      { value: totalTitles.toLocaleString('en'),               label: 'Titles scored' },
      { value: stats.scored_last_7_days.toLocaleString('en'),  label: 'Scored last 7 days' },
      { value: platformCount.toLocaleString('en'),             label: 'Platforms covered' },
      { value: languageCount.toLocaleString('en'),             label: 'Languages' },
    ]
  }

  const gridCols = items.length === 3 ? 'grid-cols-3 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'

  return (
    <div className="border-y border-ink">
      <div className={`max-w-5xl mx-auto px-6 py-10 grid ${gridCols} gap-8 md:gap-0 md:divide-x md:divide-rule`}>
        {items.map(({ value, label }) => (
          <div key={label} className="md:px-8 first:pl-0 last:pr-0 flex flex-col gap-1">
            <span className="font-serif text-4xl tracking-tight text-ink tabular-nums">
              {value}
            </span>
            <span className="text-kicker uppercase font-semibold text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
