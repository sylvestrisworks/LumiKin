export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { gameFeedback, games } from '@/lib/db/schema'

const TYPE_LABELS: Record<string, string> = {
  too_high:     'Score too high',
  too_low:      'Score too low',
  outdated:     'Score outdated',
  missing_info: 'Missing info',
  other:        'Other',
}

const TYPE_COLORS: Record<string, string> = {
  too_high:     'border border-accent text-accent',
  too_low:      'border border-warm text-warm',
  outdated:     'border border-rule text-ink/80',
  missing_info: 'border border-rule text-muted',
  other:        'border border-rule text-ink/80',
}

export default async function FeedbackInboxPage() {
  const session = await auth()
  if (!session) redirect('/login?callbackUrl=/review/feedback')

  const rows = await db
    .select({
      id:        gameFeedback.id,
      type:      gameFeedback.type,
      comment:   gameFeedback.comment,
      status:    gameFeedback.status,
      createdAt: gameFeedback.createdAt,
      gameSlug:  games.slug,
      gameTitle: games.title,
    })
    .from(gameFeedback)
    .innerJoin(games, eq(games.id, gameFeedback.gameId))
    .orderBy(desc(gameFeedback.createdAt))
    .limit(200)

  const pending  = rows.filter(r => r.status === 'pending')
  const reviewed = rows.filter(r => r.status !== 'pending')

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="bg-paper border-b border-ink sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <a href="/" className="font-serif text-lg text-ink tracking-tight">LumiKin</a>
          <span className="text-rule">/</span>
          <span className="text-sm font-medium text-ink/80">Feedback inbox</span>
          <span className="ml-2 text-kicker uppercase font-semibold border border-accent text-accent px-2 py-0.5" style={{ fontVariantCaps: 'all-small-caps' }}>
            {pending.length} pending
          </span>
          <a href="/review" className="ml-auto text-sm text-muted hover:text-accent transition-colors">
            ← Review tool
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {rows.length === 0 && (
          <div className="text-center py-20 text-muted">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-serif text-lg text-ink">No feedback yet</p>
            <p className="text-sm mt-1">Submissions from game pages will appear here.</p>
          </div>
        )}

        {pending.length > 0 && (
          <section>
            <h2 className="text-kicker uppercase font-semibold text-muted mb-4" style={{ fontVariantCaps: 'all-small-caps' }}>
              Pending ({pending.length})
            </h2>
            <div className="space-y-3">
              {pending.map(row => (
                <FeedbackRow key={row.id} row={row} />
              ))}
            </div>
          </section>
        )}

        {reviewed.length > 0 && (
          <section>
            <h2 className="text-kicker uppercase font-semibold text-muted mb-4" style={{ fontVariantCaps: 'all-small-caps' }}>
              Reviewed ({reviewed.length})
            </h2>
            <div className="space-y-3 opacity-60">
              {reviewed.map(row => (
                <FeedbackRow key={row.id} row={row} />
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}

function FeedbackRow({ row }: {
  row: {
    id: number
    type: string
    comment: string | null
    status: string | null
    createdAt: Date | null
    gameSlug: string
    gameTitle: string
  }
}) {
  const typeColor = TYPE_COLORS[row.type] ?? 'border border-rule text-muted'
  const typeLabel = TYPE_LABELS[row.type] ?? row.type

  return (
    <div className="border border-rule px-5 py-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <a
            href={`/game/${row.gameSlug}`}
            className="font-serif text-sm text-ink hover:text-accent transition-colors"
          >
            {row.gameTitle}
          </a>
          <span className={`text-kicker uppercase font-semibold px-2 py-0.5 ${typeColor}`} style={{ fontVariantCaps: 'all-small-caps' }}>
            {typeLabel}
          </span>
        </div>
        {row.comment && (
          <p className="text-sm text-ink/80 leading-relaxed mt-1">{row.comment}</p>
        )}
        <p className="text-xs text-muted mt-2">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          }) : ''}
        </p>
      </div>
      <span className={`shrink-0 text-kicker uppercase font-semibold px-2 py-1 ${
        row.status === 'pending'  ? 'border border-warm text-warm' :
        row.status === 'actioned' ? 'border border-ivy text-ivy' :
                                    'border border-rule text-muted'
      }`} style={{ fontVariantCaps: 'all-small-caps' }}>
        {row.status}
      </span>
    </div>
  )
}
