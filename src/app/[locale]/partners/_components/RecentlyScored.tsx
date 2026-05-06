import Link from 'next/link'
import type { RecentScore } from '@/lib/stats'

type Props = {
  scores: RecentScore[]
  locale: string
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffHrs = Math.floor(diffMs / 3_600_000)
  if (diffHrs < 1) return 'just now'
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

function scorePillClass(score: number | null): string {
  if (score === null) return 'text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800'
  if (score >= 60) return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
  if (score >= 40) return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30'
  return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
}

export default function RecentlyScored({ scores, locale }: Props) {
  if (scores.length === 0) return null

  return (
    <section className="max-w-5xl mx-auto px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-6">
        Recently scored
      </p>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {scores.map((s) => (
          <Link
            key={s.game_id}
            href={`/${locale}/game/${s.slug}`}
            className="flex items-center gap-3 py-3 -mx-3 px-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group"
          >
            <span className="flex-1 min-w-0 text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
              {s.name}
            </span>
            {s.platform && (
              <span className="hidden sm:inline-block shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                {s.platform}
              </span>
            )}
            <span className={`shrink-0 text-sm font-black tabular-nums px-2.5 py-0.5 rounded ${scorePillClass(s.score)}`}>
              {s.score !== null ? Math.round(s.score) : '—'}
            </span>
            <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500 w-16 text-right tabular-nums">
              {relativeTime(s.scored_at)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
