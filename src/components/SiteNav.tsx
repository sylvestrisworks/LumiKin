'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import SearchBar from './SearchBar'

const NAV_LINKS = [
  { href: '/discover', label: 'Discover' },
  { href: '/browse',   label: 'Browse'   },
  { href: '/compare',  label: 'Compare'  },
]

export default function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">

      {/* ── Main row ───────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">

        {/* Logo */}
        <Link
          href="/"
          className="font-black tracking-tight text-indigo-700 shrink-0 hover:text-indigo-900 transition-colors text-base"
          onClick={() => setMenuOpen(false)}
        >
          Good Game Parent
        </Link>

        {/* Search — hidden on mobile (shown in second row) */}
        <div className="hidden sm:block flex-1 max-w-md">
          <SearchBar placeholder="Search games…" />
        </div>

        {/* Desktop nav links */}
        <nav className="hidden sm:flex items-center gap-5 text-sm font-medium text-slate-600 ml-auto shrink-0">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} className="hover:text-indigo-700 transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden ml-auto p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Mobile search row ──────────────────────────────────────────────── */}
      <div className="sm:hidden px-4 pb-3">
        <SearchBar placeholder="Search games…" />
      </div>

      {/* ── Mobile nav dropdown ────────────────────────────────────────────── */}
      {menuOpen && (
        <nav className="sm:hidden border-t border-slate-100 bg-white">
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center px-4 py-3.5 text-sm font-medium text-slate-700
                hover:bg-indigo-50 hover:text-indigo-700 border-b border-slate-100 last:border-0 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
