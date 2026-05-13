import { db } from '@/lib/db'
import { gameTips, gameTipVotes } from '@/lib/db/schema'
import { eq, and, count, desc } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import TipForm from './TipForm'
import TipVoteButton from './TipVoteButton'

type Props = {
  gameId: number
  uid: string | null
}

export default async function ParentTips({ gameId, uid }: Props) {
  const t = await getTranslations('parentTips')

  if (!uid) {
    return (
      <div className="mt-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          {t('heading')}
        </h2>
        <div className="bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 flex items-start gap-2">
          <span aria-hidden className="text-slate-400 dark:text-slate-500">🔒</span>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">
            <a href="/login" className="text-indigo-600 hover:underline font-medium">{t('signIn')}</a>{' '}{t('signInToView')}
          </p>
        </div>
      </div>
    )
  }

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

  const userVotedIds = new Set<number>()
  if (tips.length > 0) {
    const votes = await db
      .select({ tipId: gameTipVotes.tipId })
      .from(gameTipVotes)
      .where(eq(gameTipVotes.userId, uid))
    votes.forEach(v => userVotedIds.add(v.tipId))
  }

  type TipType = 'praise' | 'tip' | 'warning'
  const TYPE_CONFIG: Record<TipType, { labelKey: 'typePraise' | 'typeTip' | 'typeWarning'; icon: string; className: string }> = {
    praise:  { labelKey: 'typePraise',  icon: '★', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    tip:     { labelKey: 'typeTip',     icon: '💡', className: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    warning: { labelKey: 'typeWarning', icon: '⚠',  className: 'text-amber-700 bg-amber-50 border-amber-200' },
  }

  return (
    <div className="mt-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 space-y-4">
      <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
        {t('heading')} {tips.length > 0 && <span className="text-slate-400 dark:text-slate-500 normal-case font-normal">· {tips.length}</span>}
      </h2>

      {tips.length > 0 ? (
        <ul className="space-y-3">
          {tips.map(tip => {
            const cfg = TYPE_CONFIG[tip.tipType as TipType] ?? TYPE_CONFIG.tip
            return (
              <li key={tip.id} className="flex gap-3">
                <div className="pt-0.5 shrink-0">
                  <TipVoteButton
                    tipId={tip.id}
                    initialCount={Number(tip.voteCount)}
                    initialVoted={userVotedIds.has(tip.id)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.className}`}>
                      {cfg.icon} {t(cfg.labelKey)}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">{tip.authorName}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{tip.content}</p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="space-y-3">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1">💡 LumiKin</p>
            <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-snug">{t('editorialFallback')}</p>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('noTips')}</p>
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('sharePrompt')}</p>
        <TipForm gameId={gameId} />
      </div>
    </div>
  )
}
