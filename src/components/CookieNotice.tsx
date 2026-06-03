'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

const STORAGE_KEY = 'ps-cookie-dismissed'

export default function CookieNotice() {
  const t = useTranslations('cookie')
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const timer = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  function dismiss() {
    setLeaving(true)
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, '1')
      setVisible(false)
    }, 400)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label={t('title')}
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm
        transition-all duration-400 ease-in-out
        ${leaving ? 'opacity-0 translate-y-6' : 'opacity-100 translate-y-0'}`}
    >
      <div className="relative bg-paper border-2 border-ink shadow-xl overflow-hidden">

        {/* accent rule at top */}
        <div className="h-1 w-full bg-accent" />

        <div className="px-4 pt-3 pb-4 space-y-2">

          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none select-none" aria-hidden="true">🍪</span>
            <p className="font-serif text-base text-ink tracking-tight">
              {t('title')}
            </p>
          </div>

          {/* Body */}
          <p className="text-xs text-muted leading-relaxed">
            {t.rich('body', {
              bold: (chunks) => <span className="font-semibold text-ink">{chunks}</span>,
            })}
          </p>

          {/* Stats row */}
          <div className="flex gap-3 text-[10px] font-semibold text-muted">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-ivy inline-block" />
              {t('statSession')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-warm inline-block" />
              {t('statAnalytics')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rule inline-block" />
              {t('statAds')}
            </span>
          </div>

          {/* Action */}
          <button
            onClick={dismiss}
            className="w-full mt-1 py-2 bg-ink hover:bg-accent active:scale-95 text-paper text-kicker uppercase font-semibold transition-all"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
