'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FortniteFilterState = {
  q:    string
  sort: string   // 'curascore' | 'newest'
  risk: string   // '' | 'low' | 'medium'
  time: string   // '' | '30' | '60'
}

// ─── Chip button ──────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-xs font-semibold px-3 py-1.5 border transition-colors ${
        active
          ? 'bg-ink text-paper border-ink'
          : 'text-ink border-rule hover:border-ink hover:text-accent'
      }`}
    >
      {label}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FortniteFilters({ active, total }: { active: FortniteFilterState; total: number }) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const inputRef     = useRef<HTMLInputElement>(null)
  const t            = useTranslations('fortnite')

  function push(updates: Partial<FortniteFilterState>) {
    const merged = { ...active, ...updates }
    const params = new URLSearchParams(searchParams.toString())
    if (merged.q)                               params.set('q',    merged.q)    ; else params.delete('q')
    if (merged.sort && merged.sort !== 'curascore') params.set('sort', merged.sort); else params.delete('sort')
    if (merged.risk)                            params.set('risk', merged.risk)  ; else params.delete('risk')
    if (merged.time)                            params.set('time', merged.time)  ; else params.delete('time')
    router.push(`${pathname}?${params.toString()}`)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    push({ q: inputRef.current?.value.trim() ?? '' })
  }

  const hasFilters = !!(active.q || active.risk || active.time || (active.sort && active.sort !== 'curascore'))

  return (
    <div className="space-y-3">
      {/* Search */}
      <form onSubmit={submitSearch} className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          defaultValue={active.q}
          placeholder={t('searchPlaceholder')}
          className="w-full pl-10 pr-20 py-2.5 text-sm
            border border-rule bg-paper text-ink
            focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink
            placeholder:text-muted"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-ink hover:bg-accent text-paper text-kicker uppercase font-semibold transition-colors"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {t('searchButton')}
        </button>
      </form>

      {/* Filter + sort chips */}
      <div className="flex flex-wrap gap-2 items-center">

        {/* Sort */}
        <span className="text-kicker uppercase text-muted shrink-0" style={{ fontVariantCaps: 'all-small-caps' }}>{t('sortLabel')}</span>
        <Chip label={t('sortTopRated')} active={!active.sort || active.sort === 'curascore'} onClick={() => push({ sort: 'curascore' })} />
        <Chip label={t('sortNewest')}   active={active.sort === 'newest'}                    onClick={() => push({ sort: 'newest' })} />

        <span className="text-rule shrink-0">|</span>

        {/* Risk */}
        <span className="text-kicker uppercase text-muted shrink-0" style={{ fontVariantCaps: 'all-small-caps' }}>{t('riskLabel')}</span>
        <Chip label={t('filterLowRisk')}    active={active.risk === 'low'}    onClick={() => push({ risk: active.risk === 'low'    ? '' : 'low' })} />
        <Chip label={t('filterMediumRisk')} active={active.risk === 'medium'} onClick={() => push({ risk: active.risk === 'medium' ? '' : 'medium' })} />

        <span className="text-rule shrink-0">|</span>

        {/* Time */}
        <span className="text-kicker uppercase text-muted shrink-0" style={{ fontVariantCaps: 'all-small-caps' }}>{t('timeLabel')}</span>
        <Chip label={t('timeMax30')} active={active.time === '30'} onClick={() => push({ time: active.time === '30' ? '' : '30' })} />
        <Chip label={t('timeMax60')} active={active.time === '60'} onClick={() => push({ time: active.time === '60' ? '' : '60' })} />

        {/* Clear all */}
        {hasFilters && (
          <button
            onClick={() => router.push(pathname)}
            className="text-kicker uppercase text-muted hover:text-accent transition-colors ml-1 shrink-0" style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('clearAll')}
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs text-muted">
        {t('resultCount', { count: total })}{active.q ? t('resultMatching', { query: active.q }) : ''}
      </p>
    </div>
  )
}
