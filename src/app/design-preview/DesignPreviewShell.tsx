'use client'

import { useEffect, useState } from 'react'

type Mode = 'morning' | 'evening'
const STORAGE_KEY = 'lumikin-design-preview-mode'

export default function DesignPreviewShell({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('morning')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    if (stored === 'evening' || stored === 'morning') setMode(stored)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode, hydrated])

  return (
    <div className={mode === 'evening' ? 'evening' : ''}>
      <div className="bg-paper text-ink border-b border-ink/20">
        <div className="mx-auto max-w-7xl px-8 py-2 flex items-center justify-between gap-4">
          <span
            className="text-kicker uppercase text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Design preview · not indexed
          </span>
          <div
            className="flex items-stretch border border-ink/40 leading-none"
            role="group"
            aria-label="Editorial palette"
          >
            {(['morning', 'evening'] as const).map((m) => {
              const active = mode === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={active}
                  className={
                    (active
                      ? 'bg-ink text-paper '
                      : 'text-muted hover:text-ink ') +
                    'px-3 py-1 text-kicker uppercase font-semibold transition-colors'
                  }
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  {m === 'morning' ? 'Morning' : 'Eventide'}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}
