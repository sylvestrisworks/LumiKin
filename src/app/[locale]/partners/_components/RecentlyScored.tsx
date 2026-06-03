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
  if (score === null) return 'text-muted'
  if (score >= 60) return 'text-ivy'
  if (score >= 40) return 'text-warm'
  return 'text-accent'
}

export default function RecentlyScored({ scores, locale }: Props) {
  if (scores.length === 0) return null

  return (
    <section className="max-w-5xl mx-auto px-6 py-12">
      <p className="text-kicker uppercase font-semibold text-muted mb-6" style={{ fontVariantCaps: 'all-small-caps' }}>
        Recently scored
      </p>
      <div className="divide-y divide-rule/50">
        {scores.map((s) => (
          <Link
            key={s.game_id}
            href={`/${locale}/game/${s.slug}`}
            className="flex items-center gap-3 py-3 -mx-3 px-3 hover:bg-ink/[0.03] transition-colors group"
          >
            <span className="flex-1 min-w-0 text-sm font-serif text-ink truncate group-hover:text-accent transition-colors">
              {s.name}
            </span>
            {s.platform && (
              <span className="hidden sm:inline-block shrink-0 text-kicker uppercase text-muted px-2 py-0.5" style={{ fontVariantCaps: 'all-small-caps' }}>
                {s.platform}
              </span>
            )}
            <span className={`shrink-0 font-serif text-sm font-semibold tabular-nums ${scorePillClass(s.score)}`}>
              {s.score !== null ? Math.round(s.score) : '—'}
            </span>
            <span className="shrink-0 text-xs text-muted w-16 text-right tabular-nums">
              {relativeTime(s.scored_at)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
