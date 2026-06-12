'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { Monitor, Sun, Moon } from 'lucide-react'

// Lets the user pin a light/dark preference, or fall back to the OS setting.
// next-themes is configured in app/layout.tsx with defaultTheme="system" +
// enableSystem, so "System" stays the default until the user picks otherwise.
const OPTIONS = [
  { value: 'system', icon: Monitor, label: 'themeSystem' },
  { value: 'light',  icon: Sun,     label: 'themeLight'  },
  { value: 'dark',   icon: Moon,    label: 'themeDark'   },
] as const

export default function ThemeToggle() {
  const t = useTranslations('account')
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Theme is unknown on the server; wait for mount to avoid a hydration flash.
  useEffect(() => setMounted(true), [])

  const active = mounted ? (theme ?? 'system') : 'system'

  return (
    <div className="border border-rule px-5 py-4 space-y-3">
      <div
        role="radiogroup"
        aria-label={t('appearance')}
        className="grid grid-cols-3 gap-2"
      >
        {OPTIONS.map(({ value, icon: IconCmp, label }) => {
          const selected = active === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={`flex flex-col items-center gap-1.5 py-3 border text-kicker uppercase font-semibold transition-colors ${
                selected
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule text-ink/70 hover:border-ink hover:text-ink'
              }`}
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              <IconCmp size={18} strokeWidth={2} aria-hidden="true" />
              {t(label)}
            </button>
          )
        })}
      </div>
      <p className="text-sm text-muted">{t('appearanceHint')}</p>
    </div>
  )
}
