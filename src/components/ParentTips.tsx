import { db } from '@/lib/db'
import { gameTips, gameTipVotes } from '@/lib/db/schema'
import { eq, and, count, desc } from 'drizzle-orm'
import TipForm from './TipForm'
import TipVoteButton from './TipVoteButton'

const TYPE_CONFIG = {
  praise:  { label: 'Praise',  icon: '★', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  tip:     { label: 'Tip',     icon: '💡', className: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  warning: { label: 'Warning', icon: '⚠', className: 'text-amber-700 bg-amber-50 border-amber-200' },
} as const

type Props = {
  gameId: number
  uid: string | null
}

export default async function ParentTips({ gameId, uid }: Props) {
  // Fetch approved tips with vote counts
  const tips = await db
    .select({
      id:         gameTips.id,
      content:    gameTips.content,
      tipType:    gameTips.tipType,
      authorName: gameTips.authorName,
      createdAt:  gameTips.createdAt,
      voteCount:  count(gameTipVotes.id),
    })
    .from(gameTips)
    .leftJoin(gameTipVotes, eq(gameTipVotes.tipId, gameTips.id))
    .where(and(eq(gameTips.gameId, gameId), eq(gameTips.status, 'approved')))
    .groupBy(gameTips.id)
    .orderBy(desc(count(gameTipVotes.id)), desc(gameTips.createdAt))

  // Which tips has the current user voted on?
  const userVotedIds = new Set<number>()
  if (uid && tips.length > 0) {
    const votes = await db
      .select({ tipId: gameTipVotes.tipId })
      .from(gameTipVotes)
      .where(eq(gameTipVotes.userId, uid))
    votes.forEach(v => userVotedIds.add(v.tipId))
  }

  return (
    <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 space-y-4">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
        Parent Tips {tips.length > 0 && <span className="text-slate-400 normal-case font-normal">· {tips.length}</span>}
      </h2>

      {/* Existing tips */}
      {tips.length > 0 ? (
        <ul className="space-y-3">
          {tips.map(tip => {
            const cfg = TYPE_CONFIG[tip.tipType as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.tip
            return (
              <li key={tip.id} className="flex gap-3">
                {/* Vote button */}
                <div className="pt-0.5 shrink-0">
                  {uid ? (
                    <TipVoteButton
                      tipId={tip.id}
                      initialCount={Number(tip.voteCount)}
                      initialVoted={userVotedIds.has(tip.id)}
                    />
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-slate-400 px-2.5 py-1">
                      ▲ {Number(tip.voteCount) > 0 && Number(tip.voteCount)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.className}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                    <span className="text-[11px] text-slate-400">{tip.authorName}</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-snug">{tip.content}</p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">No tips yet — be the first to help other parents.</p>
      )}

      {/* Submit form — only shown when logged in */}
      {uid && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-3">Share a tip with other parents</p>
          <TipForm gameId={gameId} />
        </div>
      )}

      {!uid && (
        <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">
          <a href="/login" className="text-indigo-600 hover:underline">Sign in</a> to leave a tip or vote.
        </p>
      )}
    </div>
  )
}
