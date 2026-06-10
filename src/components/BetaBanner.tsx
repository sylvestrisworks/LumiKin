'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { COOKIE_DISMISSED_EVENT } from './CookieNotice'

const STORAGE_KEY = 'lumikin_beta_dismissed'
const COOKIE_KEY  = 'ps-cookie-dismissed'

export default function BetaBanner() {
  const t = useTranslations('banner')
  const [visible, setVisible] = useState(false)

  // One bottom overlay at a time: the cookie notice goes first, so only show
  // the beta strip once cookies are already handled (or as soon as the cookie
  // card is dismissed in this session).
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return

    if (localStorage.getItem(COOKIE_KEY)) {
      setVisible(true)
      return
    }
    const onCookieDismissed = () => setVisible(true)
    window.addEventListener(COOKIE_DISMISSED_EVENT, onCookieDismissed)
    return () => window.removeEventListener(COOKIE_DISMISSED_EVENT, onCookieDismissed)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 px-4 pb-4 pointer-events-none">
      <div className="max-w-2xl mx-auto bg-ink text-paper px-5 py-4 flex items-center gap-4 pointer-events-auto border-t-2 border-accent">
        <span className="text-lg">🚧</span>
        <p className="flex-1 text-sm text-paper/80">
          <span className="font-serif text-paper">{t('betaTitle')}</span> &mdash; {t('betaBody')}{' '}
          <a
            href="/review/feedback"
            className="underline text-paper hover:text-accent transition-colors"
          >
            {t('shareFeedback')}
          </a>
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-paper/60 hover:text-paper transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
