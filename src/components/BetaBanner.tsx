'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

const STORAGE_KEY = 'lumikin_beta_dismissed'

export default function BetaBanner() {
  const t = useTranslations('banner')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
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
