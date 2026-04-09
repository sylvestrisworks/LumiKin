'use client'

import { useState, useEffect } from 'react'
import { Menu, X, Search } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import SearchBar from './SearchBar'
import LanguageSwitcher from './LanguageSwitcher'

export default function SiteNav({ authSlot }: { authSlot?: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [atTop, setAtTop]       = useState(true)
  const t      = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()

  // Detect homepage (hero search already visible at top)
  const isHomepage = pathname === `/${locale}` || pathname === `/${locale}/`

  // Track whether we're still in the hero zone (first ~220 px)
  useEffect(() => {
    if (!isHomepage) return
    const onScroll = () => setAtTop(window.scrollY < 220)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHomepage])

  // On homepage while hero is visible, collapse nav search to an icon
  const collapseNavSearch = isHomepage && atTop

  const NAV_LINKS = [
    { href: `/${locale}/discover`, label: t('discover') },
    { href: `/${locale}/browse`,   label: t('browse')   },
    { href: `/${locale}/compare`,  label: t('compare')  },
    { href: `/${locale}/library`,  label: t('library')  },
  ]

  function focusHeroSearch() {
    const heroInput = document.querySelector<HTMLInputElement>('.hero-gradient input[type="text"]')
    heroInput?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">

      {/* ── Main row ───────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">

        {/* Logo */}
        <a
          href={`/${locale}`}
          className="font-black tracking-tight text-indigo-700 shrink-0 hover:text-indigo-900 transition-colors text-base"
          onClick={() => setMenuOpen(false)}
        >
          {t('brand')} <span className="font-normal text-slate-400 text-sm">{t('brandSub')}</span>
        </a>

        {/* Search — hidden on mobile (shown in second row) */}
        <div className="hidden sm:flex flex-1 max-w-md items-center">
          {collapseNavSearch ? (
            <button
              onClick={focusHeroSearch}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
              aria-label={t('search')}
            >
              <Search size={20} />
            </button>
          ) : (
            <SearchBar placeholder={t('discover') + '…'} />
          )}
        </div>

        {/* Desktop nav links */}
        <nav className="hidden sm:flex items-center gap-5 text-sm font-medium text-slate-600 ml-auto shrink-0">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="hover:text-indigo-700 transition-colors">
              {l.label}
            </a>
          ))}
          <LanguageSwitcher />
          {authSlot}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden ml-auto p-2.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
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
        <nav className="sm:hidden border-t border-slate-100 bg-white">
          {NAV_LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center px-4 py-4 text-sm font-medium text-slate-700
                hover:bg-indigo-50 hover:text-indigo-700 border-b border-slate-100 last:border-0 transition-colors"
            >
              {l.label}
            </a>
          ))}
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-4">
            <LanguageSwitcher />
            {authSlot}
          </div>
        </nav>
      )}
    </header>
  )
}
