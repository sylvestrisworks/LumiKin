export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { desc, eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, reviews, gameScores } from '@/lib/db/schema'

export const metadata = {
  title: 'Reviewer Dashboard — Good Game Parent',
}

type GameRow = {
  id: number
  slug: string
  title: string
  esrbRating: string | null
  backgroundImage: string | null
  reviewStatus: string | null
  reviewId: number | null
  bds: number | null
  ris: number | null
}

async function getDashboardGames(): Promise<GameRow[]> {
  const rows = await db
    .select({
      id:              games.id,
      slug:            games.slug,
      title:           games.title,
      esrbRating:      games.esrbRating,
      backgroundImage: games.backgroundImage,
      reviewStatus:    reviews.status,
      reviewId:        reviews.id,
      bds:             gameScores.bds,
      ris:             gameScores.ris,
    })
    .from(games)
    .leftJoin(reviews, eq(reviews.gameId, games.id))
    .leftJoin(gameScores, eq(gameScores.gameId, games.id))
    .orderBy(desc(games.metacriticScore))
    .limit(200)

  return rows as GameRow[]
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
        Not reviewed
      </span>
    )
  }
  const map: Record<string, string> = {
    approved: 'bg-emerald-100 text-emerald-700',
    draft:    'bg-amber-100 text-amber-700',
    submitted:'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-600',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function ScorePill({ value, label, good }: { value: number | null; label: string; good: boolean }) {
  if (value === null) return null
  const pct = Math.round(value * 100)
  const color = good
    ? pct >= 60 ? 'text-emerald-700' : pct >= 35 ? 'text-blue-600' : 'text-slate-500'
    : pct <= 30 ? 'text-emerald-700' : pct <= 55 ? 'text-amber-600' : 'text-red-600'
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {label} {pct}
    </span>
  )
}

export default async function ReviewDashboard() {
  const session = await auth()
  if (!session) redirect('/login?callbackUrl=/review')

  const rows = await getDashboardGames()

  const unreviewed = rows.filter(r => !r.reviewId)
  const drafts     = rows.filter(r => r.reviewStatus === 'draft')
  const approved   = rows.filter(r => r.reviewStatus === 'approved')
  const total      = rows.length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <a href="/" className="text-2xl font-extrabold text-indigo-700">Good Game Parent</a>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-600">Reviewer Dashboard</span>
        </div>
        <a href="/api/auth/signout" className="text-sm text-slate-500 hover:text-slate-700">
          Sign out
        </a>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total games', value: total, color: 'text-slate-700' },
            { label: 'Unreviewed',  value: unreviewed.length, color: 'text-amber-600' },
            { label: 'Drafts',      value: drafts.length,     color: 'text-blue-600' },
            { label: 'Approved',    value: approved.length,   color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Priority: unreviewed first */}
        {unreviewed.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Needs review ({unreviewed.length})
            </h2>
            <GameList games={unreviewed} />
          </section>
        )}

        {drafts.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Drafts ({drafts.length})
            </h2>
            <GameList games={drafts} />
          </section>
        )}

        {approved.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Approved ({approved.length})
            </h2>
            <GameList games={approved} />
          </section>
        )}
      </main>
    </div>
  )
}

function GameList({ games }: { games: GameRow[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      {games.map(game => (
        <a
          key={game.id}
          href={`/review/${game.slug}`}
          className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
        >
          {/* Thumbnail */}
          <div className="w-12 h-8 rounded overflow-hidden bg-slate-100 shrink-0">
            {game.backgroundImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={game.backgroundImage}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-200 to-purple-200" />
            )}
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-slate-800 group-hover:text-indigo-700 truncate block">
              {game.title}
            </span>
            {game.esrbRating && (
              <span className="text-xs text-slate-400">{game.esrbRating}</span>
            )}
          </div>

          {/* Scores */}
          <div className="flex items-center gap-3 shrink-0">
            <ScorePill value={game.bds} label="BDS" good={true} />
            <ScorePill value={game.ris} label="RIS" good={false} />
          </div>

          {/* Status */}
          <div className="shrink-0">
            <StatusBadge status={game.reviewStatus} />
          </div>

          <span className="text-slate-300 group-hover:text-indigo-400 text-sm shrink-0">→</span>
        </a>
      ))}
    </div>
  )
}
