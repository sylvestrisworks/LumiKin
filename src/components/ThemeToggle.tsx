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
  if (!mounted) return <div className="w-8 h-8" />

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
      className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-base"
      aria-label={`Switch theme (currently ${LABELS[current]})`}
    >
      {ICONS[current]}
    </button>
  )
}
