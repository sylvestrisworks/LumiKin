'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useTranslations, useLocale } from 'next-intl'

type Props = {
  name?: string | null
  email?: string | null
  image?: string | null
}

/**
 * Signed-in account dropdown. Personal destinations (My Library, Family
 * Dashboard, Account) live here rather than in the public nav, so logged-out
 * visitors never see dead-end links. Sign-out runs client-side via next-auth.
 */
export default function AccountMenu({ name, email, image }: Props) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [])

  const initials = (name ?? email ?? '?')
    .split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')

  const items: { href: string; label: string }[] = [
    { href: `/${locale}/library`,   label: t('myLibrary') },
    { href: `/${locale}/dashboard`, label: t('familyDashboard') },
    { href: `/${locale}/account`,   label: t('account') },
  ]

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('account')}
        className="block rounded-full ring-1 ring-rule hover:ring-ink transition-all"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-ink text-paper text-xs font-bold flex items-center justify-center select-none">
            {initials}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-52 bg-paper border border-ink shadow-lg z-[60] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-rule/60">
            {name && <p className="font-serif text-sm text-ink truncate">{name}</p>}
            <p className="text-xs text-muted truncate">{email}</p>
          </div>
          {items.map(it => (
            <a
              key={it.href}
              href={it.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-kicker uppercase font-semibold text-ink hover:bg-ink/[0.04] hover:text-accent border-b border-rule/40 transition-colors"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {it.label}
            </a>
          ))}
          <button
            role="menuitem"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full text-left px-4 py-3 text-kicker uppercase font-semibold text-muted hover:bg-ink/[0.04] hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('signOut')}
          </button>
        </div>
      )}
    </div>
  )
}
