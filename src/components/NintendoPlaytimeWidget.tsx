'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Icon from '@/components/Icon'

type PlaytimeRow = {
  appId: string
  appTitle: string
  appImageUrl: string | null
  totalMinutes: number
  slug: string | null
  curascore: number | null
  timeRecommendationMinutes: number | null
}

type ApiResponse = {
  connected: boolean
  lastSyncedAt: string | null
  sinceDate: string
  rows: PlaytimeRow[]
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function Timebar({ actual, recommended }: { actual: number; recommended: number | null }) {
  if (!recommended) return null
  const pct = Math.min((actual / recommended) * 100, 100)
  const over = actual > recommended
  return (
    <div className="mt-1.5 h-1 w-full bg-rule/30 overflow-hidden">
      <div
        className={`h-full transition-all ${over ? 'bg-accent' : 'bg-ivy'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function NintendoPlaytimeWidget() {
  const [data,    setData]    = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const params = useParams()
  const locale = (params?.locale as string) ?? 'en'
  const t = useTranslations('nintendoWidget')
  const tCommon = useTranslations('common')

  useEffect(() => {
    fetch('/api/nintendo/playtime')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="border border-rule px-5 py-4">
        <div className="h-4 w-40 bg-rule/30 rounded animate-pulse mb-3" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-rule/20 animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!data?.connected) {
    return (
      <div className="border border-rule px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon name="switch" size={24} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-ink/80">Nintendo Switch</p>
            <p className="text-xs text-muted">{tCommon('loading')}</p>
          </div>
        </div>
        <Link
          href={`/${locale}/settings/nintendo`}
          className="text-kicker uppercase px-3 py-1.5 bg-ink hover:bg-accent text-paper font-semibold transition-colors" style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {t('connect')}
        </Link>
      </div>
    )
  }

  if (data.rows.length === 0) {
    return (
      <div className="border border-rule px-5 py-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Icon name="switch" size={16} aria-hidden="true" />
            <p className="text-sm font-semibold text-ink/80">{t('title')}</p>
          </div>
          <Link href={`/${locale}/settings/nintendo`} className="text-xs text-muted hover:text-accent">settings</Link>
        </div>
        <p className="text-xs text-muted mt-2">
          {t('noData')}{' '}
          {data.lastSyncedAt ? 'Next sync runs tonight at 04:30 UTC.' : 'First sync runs tonight at 04:30 UTC.'}
        </p>
      </div>
    )
  }

  const totalMinutes = data.rows.reduce((s, r) => s + r.totalMinutes, 0)

  return (
    <div className="border border-rule px-5 py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="switch" size={16} aria-hidden="true" />
          <p className="text-sm font-semibold text-ink/80">{t('title')}</p>
          <span className="text-xs text-muted font-normal">{t('last7Days')}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted">{formatTime(totalMinutes)} total</span>
          <Link href={`/${locale}/settings/nintendo`} className="text-xs text-muted hover:text-accent">settings</Link>
        </div>
      </div>

      {/* Game rows */}
      <ul className="space-y-2">
        {data.rows.slice(0, 6).map(row => {
          const over = row.timeRecommendationMinutes != null && row.totalMinutes > row.timeRecommendationMinutes
          const GameWrapper = row.slug
            ? ({ children }: { children: React.ReactNode }) => (
                <Link href={`/${locale}/game/${row.slug}`} className="flex items-center gap-3 group">
                  {children}
                </Link>
              )
            : ({ children }: { children: React.ReactNode }) => (
                <div className="flex items-center gap-3">
                  {children}
                </div>
              )

          return (
            <li key={row.appId}>
              <GameWrapper>
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-rule/30">
                  {row.appImageUrl
                    ? <img src={row.appImageUrl} alt={row.appTitle} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xs font-serif text-muted">
                        {row.appTitle.slice(0, 2).toUpperCase()}
                      </div>
                  }
                </div>

                {/* Title + bar */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${row.slug ? 'text-ink/80 group-hover:text-accent' : 'text-ink/80'}`}>
                    {row.appTitle}
                  </p>
                  <Timebar actual={row.totalMinutes} recommended={row.timeRecommendationMinutes} />
                </div>

                {/* Time + over indicator */}
                <div className="text-right shrink-0">
                  <p className={`text-xs font-semibold ${over ? 'text-accent' : 'text-muted'}`}>
                    {formatTime(row.totalMinutes)}
                  </p>
                  {row.timeRecommendationMinutes != null && (
                    <p className="text-[10px] text-rule">
                      / {formatTime(row.timeRecommendationMinutes)}
                    </p>
                  )}
                </div>
              </GameWrapper>
            </li>
          )
        })}
      </ul>

      {/* Legend */}
      {data.rows.some(r => r.timeRecommendationMinutes != null) && (
        <p className="text-[10px] text-muted border-t border-rule/50 pt-2">
          Bar shows weekly play vs LumiKin recommended time. Red = over recommendation.
        </p>
      )}
    </div>
  )
}
