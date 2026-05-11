import type { SiteStats } from '@/lib/stats'

type Props = {
  stats: SiteStats
  variant?: 'partner' | 'parent'
}

export default function CoverageStrip({ stats, variant = 'partner' }: Props) {
  const totalTitles = stats.total_games_scored + stats.total_ugc_experiences_scored
  const platformCount = stats.platforms.length
  const languageCount = stats.languages.length

  const items = variant === 'parent'
    ? [
        { value: totalTitles.toLocaleString('en'), label: 'Games rated' },
        { value: stats.scored_last_7_days.toLocaleString('en'), label: 'Rated this week' },
        { value: platformCount.toLocaleString('en'), label: 'Platforms covered' },
      ]
    : [
        { value: totalTitles.toLocaleString('en'), label: 'Titles scored' },
        { value: stats.scored_last_7_days.toLocaleString('en'), label: 'Scored last 7 days' },
        { value: platformCount.toLocaleString('en'), label: 'Platforms covered' },
        { value: languageCount.toLocaleString('en'), label: 'Languages' },
      ]

  const gridCols = items.length === 3 ? 'grid-cols-3 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'

  return (
    <div className="border-y border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
      <div className={`max-w-5xl mx-auto px-6 py-10 grid ${gridCols} gap-8 md:gap-0 md:divide-x md:divide-slate-200 md:dark:divide-slate-700`}>
        {items.map(({ value, label }) => (
          <div key={label} className="md:px-8 first:pl-0 last:pr-0 flex flex-col gap-1">
            <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {value}
            </span>
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
