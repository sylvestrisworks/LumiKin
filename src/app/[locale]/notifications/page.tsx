'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Bell, ArrowUpRight, TrendingUp } from 'lucide-react'

type Notification = {
  id: number
  gameId: number
  type: string
  title: string
  body: string
  read: boolean
  createdAt: string
  game?: { slug: string; title: string; backgroundImage: string | null }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (days > 0)  return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0)  return `${mins}m ago`
  return 'just now'
}

function typeIcon(type: string) {
  if (type === 'first_score') return '🎉'
  if (type === 'score_up')    return <TrendingUp size={20} aria-hidden="true" className="text-ivy" />
  if (type === 'score_down')  return '📉'
  return '📊'
}

export default function NotificationsPage() {
  const [notifs, setNotifs]   = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const locale = useLocale()
  const t = useTranslations('notifications')
  const tCommon = useTranslations('common')

  useEffect(() => {
    fetch('/api/user/notifications')
      .then(r => r.ok ? r.json() : { notifications: [] })
      .then(d => { setNotifs(d.notifications ?? []); setLoading(false) })
      .catch(() => setLoading(false))

    // Mark all as read
    fetch('/api/user/notifications/read', { method: 'POST' }).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="max-w-lg mx-auto px-4 py-8 space-y-4">

        <div className="flex items-center gap-3 border-b border-ink pb-4">
          <Bell size={20} className="text-accent shrink-0" />
          <h1 className="font-serif text-display-sm text-ink">{t('title')}</h1>
        </div>

        {loading && (
          <p className="text-sm text-muted py-8 text-center">{tCommon('loading')}</p>
        )}

        {!loading && notifs.length === 0 && (
          <div className="border border-rule px-5 py-10 text-center space-y-2">
            <p className="text-2xl">🔔</p>
            <p className="font-serif text-lg text-ink">{t('allCaughtUp')}</p>
            <p className="text-sm text-muted">
              {t('allCaughtUpDesc')}
            </p>
            <Link href={`/${locale}/dashboard`} className="inline-block mt-2 text-kicker uppercase font-semibold text-accent hover:underline" style={{ fontVariantCaps: 'all-small-caps' }}>
              Go to my library →
            </Link>
          </div>
        )}

        {!loading && notifs.length > 0 && (
          <div className="space-y-2">
            {notifs.map(n => (
              <Link
                key={n.id}
                href={n.game ? `/${locale}/game/${n.game.slug}` : `/${locale}/dashboard`}
                className="flex items-start gap-3 border border-rule px-4 py-3.5 hover:border-ink transition-colors group"
              >
                <span className="text-xl leading-none mt-0.5 shrink-0" aria-hidden="true">
                  {typeIcon(n.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-sm text-ink leading-snug group-hover:text-accent transition-colors">
                    {n.title}
                  </p>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">
                    {n.body}
                  </p>
                  <p className="text-[10px] text-rule mt-1">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
                <ArrowUpRight size={14} className="shrink-0 mt-1 text-rule group-hover:text-accent transition-colors" />
              </Link>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
