'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import SearchBar from './SearchBar'
import LanguageSwitcher from './LanguageSwitcher'

export default function SiteNav({ authSlot, notifSlot }: { authSlot?: React.ReactNode; notifSlot?: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const t      = useTranslations('nav')
  const locale = useLocale()

  // Primary nav maps to how parents actually arrive: explore the catalogue,
  // by their child's age, by platform ("is Roblox ok?"), or read guidance.
  // Personal destinations (library, family dashboard, account) live in the
  // account menu so logged-out visitors never hit dead-ends.
  const NAV_LINKS: { href: string; label: string; prominent?: boolean }[] = [
    { href: `/${locale}/browse`,   label: t('browse'),    prominent: true },
    { href: `/${locale}/age`,      label: t('byAge')                      },
    { href: `/${locale}/platform`, label: t('platforms')                  },
    { href: `/${locale}/learn`,    label: t('learn')                      },
  ]

  return (
    <header className="bg-paper text-ink border-b border-ink sticky top-0 z-50">

      {/* ── Main row ───────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-8 h-14 flex items-center gap-4">

        {/* Logo — editorial nameplate. Live Fraunces text + a superscript
            accent-red colophon spark; ink/accent tokens flip in dark mode,
            so no separate asset is needed. */}
        <a
          href={`/${locale}`}
          className="shrink-0 leading-none"
          onClick={() => setMenuOpen(false)}
          aria-label="LumiKin — home"
        >
          <span
            className="font-serif text-[1.7rem] tracking-tight text-ink"
            style={{ fontOpticalSizing: 'auto' }}
          >
            LumiKin
            <span className="align-super text-[0.5em] text-accent ml-[0.04em]" aria-hidden="true">
              ✦
            </span>
          </span>
        </a>

        {/* Search — hidden on mobile (shown in second row) */}
        <div className="hidden sm:flex flex-1 max-w-md items-center">
          <SearchBar placeholder={t('discover') + '…'} variant="editorial" />
        </div>

        {/* Desktop nav links */}
        <nav className="hidden sm:flex items-center gap-6 text-kicker uppercase font-semibold ml-auto shrink-0">
          {NAV_LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              className={(l.prominent ? 'text-accent ' : 'text-ink ') + 'hover:text-accent transition-colors'}
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {l.label}
            </a>
          ))}
          <LanguageSwitcher />
          {notifSlot}
          {authSlot}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden ml-auto p-2.5 text-muted hover:text-ink hover:bg-ink/[0.04] transition-colors"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Mobile search row ──────────────────────────────────────────────── */}
      <div className="sm:hidden px-4 pb-3">
        <SearchBar placeholder={t('discover') + '…'} variant="editorial" />
      </div>

      {/* ── Mobile nav dropdown ────────────────────────────────────────────── */}
      {menuOpen && (
        <nav className="sm:hidden border-t border-ink/30 bg-paper">
          {NAV_LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={
                'flex items-center px-4 py-4 text-kicker uppercase font-semibold ' +
                (l.prominent ? 'text-accent ' : 'text-ink ') +
                'hover:bg-ink/[0.04] hover:text-accent border-b border-ink/20 last:border-0 transition-colors'
              }
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {l.label}
            </a>
          ))}
          <div className="px-4 py-3 border-t border-ink/30 flex items-center justify-between gap-4">
            <LanguageSwitcher />
            {notifSlot}
            {authSlot}
          </div>
        </nav>
      )}
    </header>
  )
}
