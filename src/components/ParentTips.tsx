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
      <div className="mt-4 border-t border-ink pt-4 space-y-3">
        <h2
          className="text-kicker uppercase font-semibold text-muted"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {t('heading')}
        </h2>
        <p className="text-sm text-ink/80 leading-snug border-l-2 border-rule pl-3">
          <a href="/login" className="text-accent hover:underline font-medium">{t('signIn')}</a>{' '}{t('signInToView')}
        </p>
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
    praise:  { labelKey: 'typePraise',  icon: '★', className: 'text-ivy' },
    tip:     { labelKey: 'typeTip',     icon: '💡', className: 'text-muted' },
    warning: { labelKey: 'typeWarning', icon: '⚠',  className: 'text-warm' },
  }

  return (
    <div className="mt-4 border-t border-ink pt-4 space-y-4">
      <h2
        className="text-kicker uppercase font-semibold text-muted"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {t('heading')} {tips.length > 0 && <span className="text-muted normal-case font-normal">· {tips.length}</span>}
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
                    <span
                      className={`text-kicker uppercase font-semibold ${cfg.className}`}
                      style={{ fontVariantCaps: 'all-small-caps' }}
                    >
                      {cfg.icon} {t(cfg.labelKey)}
                    </span>
                    <span className="text-[11px] text-muted">{tip.authorName}</span>
                  </div>
                  <p className="text-sm text-ink/85 leading-snug">{tip.content}</p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="space-y-3">
          <div className="border-l-2 border-accent pl-3">
            <p
              className="text-kicker uppercase font-semibold text-accent mb-1"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              LumiKin
            </p>
            <p className="text-sm text-ink/85 leading-snug font-serif italic">{t('editorialFallback')}</p>
          </div>
          <p className="text-xs text-muted">{t('noTips')}</p>
        </div>
      )}

      <div className="pt-3 border-t border-rule/50">
        <p className="text-xs text-muted mb-3">{t('sharePrompt')}</p>
        <TipForm gameId={gameId} />
      </div>
    </div>
  )
}
