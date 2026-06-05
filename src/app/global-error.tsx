'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import Icon from '@/components/Icon'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body className="min-h-screen bg-paper text-ink flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="mb-4 flex justify-center"><Icon name="warning" size={48} aria-hidden="true" className="text-warm" /></p>
          <h2 className="font-serif text-display-sm text-ink mb-2">Something went wrong</h2>
          <p className="text-muted text-sm mb-6">
            We&apos;ve been notified and are looking into it.
          </p>
          <button
            onClick={reset}
            className="bg-ink hover:bg-accent text-paper text-kicker uppercase font-semibold px-5 py-2.5 transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
