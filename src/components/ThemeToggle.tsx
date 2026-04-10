'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const themes = ['system', 'light', 'dark'] as const

const ICONS: Record<string, string> = {
  system: '💻',
  light:  '☀️',
  dark:   '🌙',
}

const LABELS: Record<string, string> = {
  system: 'System',
  light:  'Light',
  dark:   'Dark',
}

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — only render after mount
  useEffect(() => setMounted(true), [])
  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
    )
  }

  function cycle() {
    const current = theme ?? 'system'
    const idx = themes.indexOf(current as typeof themes[number])
    const next = themes[(idx + 1) % themes.length]
    setTheme(next)
  }

  const current = theme ?? 'system'

  return (
    <button
      onClick={cycle}
      title={`Theme: ${LABELS[current]} — click to switch`}
      className="
        group relative flex items-center justify-center w-8 h-8 rounded-lg 
        text-slate-600 dark:text-slate-400
        bg-slate-100 dark:bg-slate-800
        hover:bg-indigo-100 dark:hover:bg-indigo-900/30
        hover:text-indigo-600 dark:hover:text-indigo-400
        active:scale-95
        transition-all duration-200
        text-base
        ring-1 ring-slate-200 dark:ring-slate-700
        hover:ring-indigo-300 dark:hover:ring-indigo-600
      "
      aria-label={`Switch theme (currently ${LABELS[current]})`}
    >
      <span className="transform group-hover:scale-110 transition-transform duration-200">
        {ICONS[current]}
      </span>
      
      {/* Tooltip */}
      <span className="
        absolute -bottom-10 left-1/2 -translate-x-1/2
        px-2 py-1 rounded text-xs font-medium
        bg-slate-900 dark:bg-slate-100
        text-white dark:text-slate-900
        opacity-0 group-hover:opacity-100
        pointer-events-none
        transition-opacity duration-200
        whitespace-nowrap
        shadow-lg
        z-50
      ">
        {LABELS[current]}
        <span className="
          absolute top-full left-1/2 -translate-x-1/2 -mt-1
          border-4 border-transparent border-t-slate-900 dark:border-t-slate-100
        " />
      </span>
    </button>
  )
}
