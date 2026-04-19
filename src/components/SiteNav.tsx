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

  const NAV_LINKS = [
    { href: `/${locale}/discover`,   label: t('discover')  },
    { href: `/${locale}/browse`,     label: t('browse')    },
    { href: `/${locale}/learn`,      label: t('learn')     },
    { href: `/${locale}/dashboard`,  label: t('library')   },
  ]

  function focusHeroSearch() {
    const heroInput = document.querySelector<HTMLInputElement>('.hero-gradient input[type="text"]')
    heroInput?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">

      {/* ── Main row ───────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">

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
            height={32}
            width={131}
            className="dark:hidden"
            style={{ height: 32, width: 'auto' }}
          />
          <img
            src="/lumikin-logo-dark.svg"
            alt="LumiKin"
            height={32}
            width={131}
            className="hidden dark:block"
            style={{ height: 32, width: 'auto' }}
          />
        </a>

        {/* Search — hidden on mobile (shown in second row) */}
        <div className="hidden sm:flex flex-1 max-w-md items-center">
          {collapseNavSearch ? (
            <button
              onClick={focusHeroSearch}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              aria-label={t('search')}
            >
              <Search size={20} />
            </button>
          ) : (
            <SearchBar placeholder={t('discover') + '…'} />
          )}
        </div>

        {/* Desktop nav links */}
        <nav className="hidden sm:flex items-center gap-5 text-sm font-medium text-slate-600 dark:text-slate-300 ml-auto shrink-0">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors">
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
          className="sm:hidden ml-auto p-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Mobile search row ──────────────────────────────────────────────── */}
      <div className="sm:hidden px-4 pb-3">
        <SearchBar placeholder={t('discover') + '…'} />
      </div>

      {/* ── Mobile nav dropdown ────────────────────────────────────────────── */}
      {menuOpen && (
        <nav className="sm:hidden border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900">
          {NAV_LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center px-4 py-4 text-sm font-medium text-slate-700 dark:text-slate-300
                hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-400 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
            >
              {l.label}
            </a>
          ))}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-4">
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
