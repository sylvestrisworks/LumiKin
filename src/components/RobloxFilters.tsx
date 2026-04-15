'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RobloxFilterState = {
  q:    string
  sort: string   // 'active' | 'curascore' | 'visits'
  risk: string   // '' | 'low' | 'medium'
  time: string   // '' | '30' | '60'
}

// ─── Chip button ──────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500'
          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500'
      }`}
    >
      {label}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RobloxFilters({ active, total }: { active: RobloxFilterState; total: number }) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const inputRef     = useRef<HTMLInputElement>(null)
  const t            = useTranslations('roblox')

  function push(updates: Partial<RobloxFilterState>) {
    const merged = { ...active, ...updates }
    const params = new URLSearchParams(searchParams.toString())
    if (merged.q)                        params.set('q',    merged.q)    ; else params.delete('q')
    if (merged.sort && merged.sort !== 'active') params.set('sort', merged.sort); else params.delete('sort')
    if (merged.risk)                     params.set('risk', merged.risk)  ; else params.delete('risk')
    if (merged.time)                     params.set('time', merged.time)  ; else params.delete('time')
    router.push(`${pathname}?${params.toString()}`)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    push({ q: inputRef.current?.value.trim() ?? '' })
  }

  const hasFilters = !!(active.q || active.risk || active.time || (active.sort && active.sort !== 'active'))

  return (
    <div className="space-y-3">
      {/* Search */}
      <form onSubmit={submitSearch} className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          defaultValue={active.q}
          placeholder="Search Roblox experiences…"
          className="w-full pl-10 pr-20 py-2.5 text-sm rounded-xl
            border border-slate-200 dark:border-slate-600
            bg-white dark:bg-slate-800
            text-slate-900 dark:text-slate-100
            shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
            placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Search
        </button>
      </form>

      {/* Filter + sort chips */}
      <div className="flex flex-wrap gap-2 items-center">

        {/* Sort */}
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0">{t('sortLabel')}</span>
        <Chip label={t('sortMostActive')}  active={!active.sort || active.sort === 'active'}    onClick={() => push({ sort: 'active' })} />
        <Chip label={t('sortTopRated')}    active={active.sort === 'curascore'}                  onClick={() => push({ sort: 'curascore' })} />
        <Chip label={t('sortMostVisited')} active={active.sort === 'visits'}                    onClick={() => push({ sort: 'visits' })} />

        <span className="text-slate-200 dark:text-slate-700 shrink-0">|</span>

        {/* Risk */}
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0">{t('riskLabel')}</span>
        <Chip label={t('filterLowRisk')}    active={active.risk === 'low'}    onClick={() => push({ risk: active.risk === 'low'    ? '' : 'low' })} />
        <Chip label={t('filterMediumRisk')} active={active.risk === 'medium'} onClick={() => push({ risk: active.risk === 'medium' ? '' : 'medium' })} />

        <span className="text-slate-200 dark:text-slate-700 shrink-0">|</span>

        {/* Time */}
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0">{t('timeLabel')}</span>
        <Chip label={t('timeMax30')} active={active.time === '30'} onClick={() => push({ time: active.time === '30' ? '' : '30' })} />
        <Chip label={t('timeMax60')} active={active.time === '60'} onClick={() => push({ time: active.time === '60' ? '' : '60' })} />

        {/* Clear all */}
        {hasFilters && (
          <button
            onClick={() => router.push(pathname)}
            className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-1 shrink-0"
          >
            {t('clearAll')}
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {total} experience{total !== 1 ? 's' : ''}{active.q ? ` matching "${active.q}"` : ''}
      </p>
    </div>
  )
}
