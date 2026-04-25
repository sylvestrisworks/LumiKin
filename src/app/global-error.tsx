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
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="mb-4 flex justify-center"><Icon name="warning" size={48} aria-hidden="true" className="text-amber-500" /></p>
          <h2 className="text-xl font-black text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-slate-500 text-sm mb-6">
            We&apos;ve been notified and are looking into it.
          </p>
          <button
            onClick={reset}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
