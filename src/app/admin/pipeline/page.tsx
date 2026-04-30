import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { cronRuns, games, gameScores, gameTranslations, platformExperiences, experienceScores } from '@/lib/db/schema'
import { desc, eq, isNull, isNotNull, sql, and, lte } from 'drizzle-orm'

// ─── Expected intervals per job (ms) — used for staleness detection ───────────

const JOB_INTERVALS: Record<string, number> = {
  'fetch-games':               30 * 60 * 1000,
  'review-games':              30 * 60 * 1000,
  'review-experiences':        60 * 60 * 1000,
  'debate-games':           2 * 60 * 60 * 1000,
  'translate-content':      2 * 60 * 60 * 1000,
  'fetch-roblox-experiences': 6 * 60 * 60 * 1000,
  'fetch-fortnite-maps':    24 * 60 * 60 * 1000,
  'fetch-fortnite-discovery': 24 * 60 * 60 * 1000,
  'sync-game-updates':      24 * 60 * 60 * 1000,
  'sync-youtube-trends':    24 * 60 * 60 * 1000,
  'sync-epic-library':      24 * 60 * 60 * 1000,
  'sync-nintendo':          24 * 60 * 60 * 1000,
}

const JOB_ORDER = Object.keys(JOB_INTERVALS)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

function timeAgo(date: Date | null): string {
  if (!date) return 'never'
  const diff = Date.now() - date.getTime()
  if (diff < 60_000)  return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function stalenessLevel(jobName: string, lastRun: Date | null): 'ok' | 'warn' | 'stale' {
  if (!lastRun) return 'stale'
  const interval = JOB_INTERVALS[jobName] ?? 24 * 60 * 60 * 1000
  const age = Date.now() - lastRun.getTime()
  if (age > interval * 4) return 'stale'
  if (age > interval * 2) return 'warn'
  return 'ok'
}

const STATUS_COLORS = {
  success: 'bg-green-500',
  partial: 'bg-yellow-500',
  error:   'bg-red-500',
} as const

const STALENESS_BADGE = {
  ok:    'text-green-400',
  warn:  'text-yellow-400',
  stale: 'text-red-400',
} as const

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PipelinePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  // Last 10 runs per job
  const allRuns = await db
    .select()
    .from(cronRuns)
    .orderBy(desc(cronRuns.startedAt))
    .limit(500)

  // Group by job
  const byJob: Record<string, typeof allRuns> = {}
  for (const run of allRuns) {
    if (!byJob[run.jobName]) byJob[run.jobName] = []
    if (byJob[run.jobName].length < 10) byJob[run.jobName].push(run)
  }

  // ── Backlog metrics ─────────────────────────────────────────────────────────

  const [totalGames] = await db
    .select({ count: sql<number>`count(*)` })
    .from(games)

  const [unreviewedGames] = await db
    .select({ count: sql<number>`count(*)` })
    .from(games)
    .leftJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNull(gameScores.curascore))

  const [undebatedGames] = await db
    .select({ count: sql<number>`count(*)` })
    .from(gameScores)
    .where(and(isNotNull(gameScores.curascore), isNull(gameScores.debateRounds)))

  const translationRows = await db
    .select({ locale: gameTranslations.locale, count: sql<number>`count(*)` })
    .from(gameTranslations)
    .groupBy(gameTranslations.locale)

  const [scoredCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(gameScores)
    .where(isNotNull(gameScores.curascore))

  const [totalExperiences] = await db
    .select({ count: sql<number>`count(*)` })
    .from(platformExperiences)

  const [unreviewedExperiences] = await db
    .select({ count: sql<number>`count(*)` })
    .from(platformExperiences)
    .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .where(isNull(experienceScores.curascore))

  const scoredTotal = Number(scoredCount.count)
  const translationCoverage: Record<string, number> = {}
  for (const row of translationRows) {
    translationCoverage[row.locale] = Number(row.count)
  }

  const now = new Date().toUTCString()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-mono text-sm">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold text-white">Pipeline</h1>
          <span className="text-gray-500 text-xs">{now}</span>
        </div>

        {/* Backlog */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Backlog</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Games total"          value={Number(totalGames.count)} />
            <Stat label="Unreviewed"           value={Number(unreviewedGames.count)} alert={Number(unreviewedGames.count) > 100} />
            <Stat label="Undebated"            value={Number(undebatedGames.count)} alert={Number(undebatedGames.count) > 50} />
            <Stat label="Experiences total"    value={Number(totalExperiences.count)} />
            <Stat label="Exp. unreviewed"      value={Number(unreviewedExperiences.count)} alert={Number(unreviewedExperiences.count) > 20} />
            <Stat label="sv translations"      value={translationCoverage['sv'] ?? 0} sub={`/ ${scoredTotal}`} />
            <Stat label="de translations"      value={translationCoverage['de'] ?? 0} sub={`/ ${scoredTotal}`} />
            <Stat label="fr translations"      value={translationCoverage['fr'] ?? 0} sub={`/ ${scoredTotal}`} />
            <Stat label="es translations"      value={translationCoverage['es'] ?? 0} sub={`/ ${scoredTotal}`} />
          </div>
        </section>

        {/* Jobs */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Jobs</h2>
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs">
                  <th className="text-left px-4 py-2">Job</th>
                  <th className="text-left px-4 py-2">Last run</th>
                  <th className="text-right px-4 py-2">Processed</th>
                  <th className="text-right px-4 py-2">Errors</th>
                  <th className="text-right px-4 py-2">Duration</th>
                  <th className="text-left px-4 py-2 w-32">Recent</th>
                </tr>
              </thead>
              <tbody>
                {JOB_ORDER.map((jobName) => {
                  const runs  = byJob[jobName] ?? []
                  const last  = runs[0] ?? null
                  const level = stalenessLevel(jobName, last?.finishedAt ?? null)

                  return (
                    <tr key={jobName} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                      <td className="px-4 py-2.5">
                        <span className={`font-medium ${STALENESS_BADGE[level]}`}>{jobName}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">
                        {last ? timeAgo(last.finishedAt ?? last.startedAt) : <span className="text-red-400">never</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-300">
                        {last?.itemsProcessed ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={last?.errors ? 'text-red-400' : 'text-gray-500'}>
                          {last?.errors ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-400">
                        {formatDuration(last?.durationMs ?? null)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          {runs.slice(0, 10).map((r, i) => (
                            <div
                              key={i}
                              title={`${r.status} — ${timeAgo(r.finishedAt ?? r.startedAt)} — ${r.itemsProcessed} processed, ${r.errors} errors`}
                              className={`w-2 h-2 rounded-full ${STATUS_COLORS[r.status as keyof typeof STATUS_COLORS] ?? 'bg-gray-600'}`}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  )
}

function Stat({ label, value, sub, alert }: { label: string; value: number; sub?: string; alert?: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
      <div className="text-gray-500 text-xs mb-1">{label}</div>
      <div className={`text-2xl font-bold ${alert ? 'text-yellow-400' : 'text-white'}`}>
        {value.toLocaleString()}
        {sub && <span className="text-sm text-gray-500 font-normal ml-1">{sub}</span>}
      </div>
    </div>
  )
}
