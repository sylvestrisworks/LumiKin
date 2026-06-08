'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { usePathname, useRouter } from '@/navigation'
import { useTranslations } from 'next-intl'

// Search-within-library box. Pushes a debounced `?q=` onto the URL (preserving
// every other filter) so the server component can filter by title. Kept tiny and
// client-only so the Library page itself stays server-rendered.
export default function LibrarySearch() {
  const t = useTranslations('library')
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [value, setValue] = useState(params.get('q') ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the input in sync if the URL changes underneath us (e.g. clear filters).
  useEffect(() => {
    setValue(params.get('q') ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  function push(next: string) {
    const sp = new URLSearchParams(params.toString())
    const trimmed = next.trim()
    if (trimmed) sp.set('q', trimmed)
    else sp.delete('q')
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  function onChange(next: string) {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => push(next), 300)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label
        htmlFor="library-search"
        className="text-kicker uppercase text-muted w-14 shrink-0"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {t('searchLabel')}
      </label>
      <input
        id="library-search"
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="text-sm px-3 min-h-[44px] border border-rule bg-paper text-ink placeholder:text-muted focus:border-ink focus:outline-none transition-colors flex-1 min-w-[12rem]"
      />
    </div>
  )
}
