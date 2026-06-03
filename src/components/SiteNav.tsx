'use client'

import { useState, useEffect } from 'react'
import { Menu, X, Search } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import SearchBar from './SearchBar'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggle from './ThemeToggle'

export default function SiteNav({ authSlot, notifSlot }: { authSlot?: React.ReactNode; notifSlot?: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [atTop, setAtTop]       = useState(true)
  const t      = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()

  const isHomepage = pathname === `/${locale}` || pathname === `/${locale}/`

  useEffect(() => {
    if (!isHomepage) return
    const onScroll = () => setAtTop(window.scrollY < 220)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHomepage])

  const collapseNavSearch = isHomepage && atTop

  const NAV_LINKS: { href: string; label: string; prominent?: boolean }[] = [
    { href: `/${locale}/browse`,     label: t('browse'),   prominent: true  },
    { href: `/${locale}/discover`,   label: t('discover')                   },
    { href: `/${locale}/learn`,      label: t('learn')                      },
    { href: `/${locale}/dashboard`,  label: t('library')                    },
  ]

  function focusHeroSearch() {
    const heroInput = document.querySelector<HTMLInputElement>('.hero-gradient input[type="text"]')
    heroInput?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <header className="bg-paper text-ink border-b border-ink sticky top-0 z-50">

      {/* ── Main row ───────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-8 h-14 flex items-center gap-4">

        {/* Logo */}
        <a
          href={`/${locale}`}
          className="shrink-0 flex items-center"
          onClick={() => setMenuOpen(false)}
          aria-label="LumiKin — home"
        >
          <img
            src="/lumikin-logo.svg"
            alt="LumiKin"
            height={28}
            width={115}
            className="dark:hidden"
            style={{ height: 28, width: 'auto' }}
          />
          <img
            src="/lumikin-logo-dark.svg"
            alt="LumiKin"
            height={28}
            width={115}
            className="hidden dark:block"
            style={{ height: 28, width: 'auto' }}
          />
        </a>

        {/* Search — hidden on mobile (shown in second row) */}
        <div className="hidden sm:flex flex-1 max-w-md items-center">
          {collapseNavSearch ? (
            <button
              onClick={focusHeroSearch}
              className="flex items-center justify-center w-10 h-10 text-muted hover:text-accent hover:bg-ink/[0.04] transition-colors"
              aria-label={t('search')}
            >
              <Search size={18} />
            </button>
          ) : (
            <SearchBar placeholder={t('discover') + '…'} variant="editorial" />
          )}
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
          <ThemeToggle />
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
            <ThemeToggle />
            {notifSlot}
            {authSlot}
          </div>
        </nav>
      )}
    </header>
  )
}
