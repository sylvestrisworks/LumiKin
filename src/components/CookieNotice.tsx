'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'ps-cookie-dismissed'

export default function CookieNotice() {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(t)
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
      aria-label="Cookie notice"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm
        transition-all duration-400 ease-in-out
        ${leaving ? 'opacity-0 translate-y-6' : 'opacity-100 translate-y-0'}`}
    >
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">

        {/* XP bar accent at top */}
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />

        <div className="px-4 pt-3 pb-4 space-y-2">

          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none select-none" aria-hidden="true">🍪</span>
            <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
              Achievement unlocked: Cookie notice
            </p>
          </div>

          {/* Body */}
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Unlike some of the games we review, we only use{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">one cookie</span>
            {' '}— a session cookie that keeps you logged in.
            No tracking. No ads. No loot box odds. Zero dark patterns.
          </p>

          {/* Stats row — mock "cookie stats" */}
          <div className="flex gap-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Strictly necessary: 1
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
              Tracking: 0
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
              Ads: 0
            </span>
          </div>

          {/* Action */}
          <button
            onClick={dismiss}
            className="w-full mt-1 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-black rounded-xl transition-all"
          >
            Got it — claim reward
          </button>
        </div>
      </div>
    </div>
  )
}
