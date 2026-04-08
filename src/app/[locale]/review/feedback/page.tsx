export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
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
  too_high:     'bg-red-100 text-red-700',
  too_low:      'bg-amber-100 text-amber-700',
  outdated:     'bg-blue-100 text-blue-700',
  missing_info: 'bg-slate-100 text-slate-600',
  other:        'bg-purple-100 text-purple-700',
}

export default async function FeedbackInboxPage() {
  const session = await getServerSession(authOptions)
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <a href="/" className="text-lg font-bold text-indigo-700 tracking-tight">PlaySmart</a>
          <span className="text-slate-400">/</span>
          <span className="text-sm font-medium text-slate-700">Feedback inbox</span>
          <span className="ml-2 text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
            {pending.length} pending
          </span>
          <a href="/review" className="ml-auto text-sm text-slate-500 hover:text-indigo-700 transition-colors">
            ← Review tool
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {rows.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-medium text-slate-600">No feedback yet</p>
            <p className="text-sm mt-1">Submissions from game pages will appear here.</p>
          </div>
        )}

        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
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
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
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
  const typeColor = TYPE_COLORS[row.type] ?? 'bg-slate-100 text-slate-600'
  const typeLabel = TYPE_LABELS[row.type] ?? row.type

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <a
            href={`/game/${row.gameSlug}`}
            className="text-sm font-semibold text-slate-800 hover:text-indigo-700 transition-colors"
          >
            {row.gameTitle}
          </a>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
            {typeLabel}
          </span>
        </div>
        {row.comment && (
          <p className="text-sm text-slate-600 leading-relaxed mt-1">{row.comment}</p>
        )}
        <p className="text-xs text-slate-400 mt-2">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          }) : ''}
        </p>
      </div>
      <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-lg ${
        row.status === 'pending'  ? 'bg-amber-50 text-amber-700 border border-amber-200' :
        row.status === 'actioned' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                    'bg-slate-50 text-slate-500 border border-slate-200'
      }`}>
        {row.status}
      </span>
    </div>
  )
}
