'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Icon from '@/components/Icon'

export default function GameError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common')

  useEffect(() => {
    console.error('[game-page] render error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-paper text-ink flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <p className="mb-4 flex justify-center"><Icon name="warning" size={48} aria-hidden="true" className="text-warm" /></p>
        <h1 className="font-serif text-display-sm text-ink mb-2">
          {t('error')}
        </h1>
        <p className="text-sm text-muted mb-6">
          {t('errorGameBody')}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-kicker uppercase font-semibold bg-ink hover:bg-accent text-paper transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('tryAgain')}
          </button>
          <Link
            href="/"
            className="px-4 py-2 text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('goHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
