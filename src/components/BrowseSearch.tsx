'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'

export default function BrowseSearch({ initialValue }: { initialValue: string }) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const inputRef     = useRef<HTMLInputElement>(null)
  const t            = useTranslations('browse')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = inputRef.current?.value.trim() ?? ''
    const params = new URLSearchParams(searchParams.toString())
    if (q) { params.set('q', q) } else { params.delete('q') }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <form onSubmit={submit} className="relative w-full">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        defaultValue={initialValue}
        placeholder={t('searchPlaceholder')}
        className="w-full pl-11 pr-20 py-3 text-sm
          border border-rule bg-paper text-ink
          focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink
          placeholder:text-muted"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-ink hover:bg-accent
          text-paper text-kicker uppercase font-semibold transition-colors"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {t('searchButton')}
      </button>
    </form>
  )
}
