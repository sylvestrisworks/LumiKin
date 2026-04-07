'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'

// ─── Filter definitions ───────────────────────────────────────────────────────

export const AGE_OPTIONS = [
  { value: 'E',   label: 'Under 6 (E)' },
  { value: 'E10', label: '6–9 (E10+)' },
  { value: 'T',   label: '10–12 (T)' },
  { value: 'M',   label: '13+ (M)' },
]

export const GENRE_OPTIONS = [
  'Action', 'Adventure', 'Puzzle', 'RPG', 'Strategy',
  'Simulation', 'Sports', 'Platformer', 'Shooter', 'Racing',
]

export const PLATFORM_OPTIONS = [
  { value: 'PC',          label: 'PC' },
  { value: 'PlayStation', label: 'PlayStation' },
  { value: 'Xbox',        label: 'Xbox' },
  { value: 'Switch',      label: 'Nintendo Switch' },
  { value: 'iOS',         label: 'iOS' },
  { value: 'Android',     label: 'Android' },
]

export const COMPLIANCE_OPTIONS = [
  { value: 'DSA',    label: 'DSA compliant' },
  { value: 'GDPR-K', label: 'GDPR-K compliant' },
  { value: 'ODDS',   label: 'ODDS compliant' },
]

export const BENEFIT_OPTIONS = [
  { value: 'problem-solving', label: 'Problem Solving' },
  { value: 'spatial',         label: 'Spatial Awareness' },
  { value: 'teamwork',        label: 'Teamwork' },
  { value: 'creativity',      label: 'Creativity' },
  { value: 'communication',   label: 'Communication' },
]

export const SORT_OPTIONS = [
  { value: 'curascore',  label: 'Curascore' },
  { value: 'benefit',    label: 'Best benefit score' },
  { value: 'safest',     label: 'Lowest risk' },
  { value: 'metacritic', label: 'Metacritic score' },
  { value: 'newest',     label: 'Newest' },
  { value: 'alpha',      label: 'A–Z' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActiveFilters = {
  age?: string
  genres: string[]
  platforms: string[]
  benefits: string[]
  compliance: string[]
  risk?: string
  time?: string
  price?: string
  sort: string
  q?: string
}

type Props = {
  active: ActiveFilters
  totalCount: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BrowseFilters({ active, totalCount }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const push = useCallback((updates: Partial<ActiveFilters>) => {
    const merged = { ...active, ...updates }
    const params = new URLSearchParams()
    if (merged.age)               params.set('age',        merged.age)
    if (merged.genres.length)     params.set('genres',     merged.genres.join(','))
    if (merged.platforms.length)  params.set('platforms',  merged.platforms.join(','))
    if (merged.benefits.length)   params.set('benefits',   merged.benefits.join(','))
    if (merged.compliance.length) params.set('compliance', merged.compliance.join(','))
    if (merged.risk)              params.set('risk',       merged.risk)
    if (merged.time)              params.set('time',       merged.time)
    if (merged.price)             params.set('price',      merged.price)
    if (merged.sort && merged.sort !== 'curascore') params.set('sort', merged.sort)
    if (merged.q)                 params.set('q',          merged.q)
    router.push(`${pathname}?${params.toString()}`)
  }, [active, pathname, router])

  const toggle = (key: 'genres' | 'platforms' | 'benefits' | 'compliance', value: string) => {
    const arr = active[key]
    push({ [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] })
  }

  const clearAll = () => router.push(pathname)

  const hasFilters = !!(active.age || active.genres.length || active.platforms.length ||
    active.benefits.length || active.compliance.length || active.risk || active.time || active.price)

  const activeCount = [
    active.age, ...active.genres, ...active.platforms,
    ...active.benefits, ...active.compliance, active.risk, active.time, active.price,
  ].filter(Boolean).length

  // ── Shared filter content ──────────────────────────────────────────────────

  const filterSections = (compact: boolean) => (
    <>
      <Accordion title="Age range" dot={!!active.age} compact={compact}>
        <PillGroup>
          {AGE_OPTIONS.map(o => (
            <Pill key={o.value} label={o.label} active={active.age === o.value} compact={compact}
              onClick={() => push({ age: active.age === o.value ? undefined : o.value })} />
          ))}
        </PillGroup>
      </Accordion>

      <Accordion title="Platform" dot={active.platforms.length > 0} compact={compact}>
        <PillGroup>
          {PLATFORM_OPTIONS.map(o => (
            <Pill key={o.value} label={o.label} active={active.platforms.includes(o.value)} compact={compact}
              onClick={() => toggle('platforms', o.value)} />
          ))}
        </PillGroup>
      </Accordion>

      <Accordion title="Genre" dot={active.genres.length > 0} compact={compact}>
        <PillGroup>
          {GENRE_OPTIONS.map(g => (
            <Pill key={g} label={g} active={active.genres.includes(g)} compact={compact}
              onClick={() => toggle('genres', g)} />
          ))}
        </PillGroup>
      </Accordion>

      <Accordion title="Benefit focus" note="Requires a review" dot={active.benefits.length > 0} compact={compact}>
        <PillGroup>
          {BENEFIT_OPTIONS.map(o => (
            <Pill key={o.value} label={o.label} active={active.benefits.includes(o.value)} compact={compact}
              onClick={() => toggle('benefits', o.value)} />
          ))}
        </PillGroup>
      </Accordion>

      <Accordion title="Max risk" note="Requires a review" dot={!!active.risk} compact={compact}>
        <PillGroup>
          {[
            { value: 'low',    label: 'Low (RIS < 0.30)' },
            { value: 'medium', label: 'Low–Medium (RIS < 0.60)' },
          ].map(o => (
            <Pill key={o.value} label={o.label} active={active.risk === o.value} compact={compact}
              onClick={() => push({ risk: active.risk === o.value ? undefined : o.value })} />
          ))}
        </PillGroup>
      </Accordion>

      <Accordion title="Min. daily time" note="Requires a review" dot={!!active.time} compact={compact}>
        <PillGroup>
          {[
            { value: '30', label: '30+ min' },
            { value: '60', label: '60+ min' },
            { value: '90', label: '90+ min' },
          ].map(o => (
            <Pill key={o.value} label={o.label} active={active.time === o.value} compact={compact}
              onClick={() => push({ time: active.time === o.value ? undefined : o.value })} />
          ))}
        </PillGroup>
      </Accordion>

      <Accordion title="Price" dot={!!active.price} compact={compact}>
        <PillGroup>
          {[
            { value: 'free', label: 'Free to play' },
            { value: '20',   label: 'Under $20' },
            { value: '40',   label: 'Under $40' },
          ].map(o => (
            <Pill key={o.value} label={o.label} active={active.price === o.value} compact={compact}
              onClick={() => push({ price: active.price === o.value ? undefined : o.value })} />
          ))}
        </PillGroup>
      </Accordion>

      <Accordion title="Compliance" note="Estimated" dot={active.compliance.length > 0} compact={compact}>
        <PillGroup>
          {COMPLIANCE_OPTIONS.map(o => (
            <Pill key={o.value} label={o.label} active={active.compliance.includes(o.value)} compact={compact}
              onClick={() => toggle('compliance', o.value)} />
          ))}
        </PillGroup>
      </Accordion>
    </>
  )

  // ── Mobile bar (top, collapsible) ──────────────────────────────────────────

  const mobileBar = (
    <div className="md:hidden mb-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMobileOpen(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
            hasFilters
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 10h10M11 16h2" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="bg-white text-indigo-600 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
              {activeCount}
            </span>
          )}
          <span className="text-xs opacity-70">{mobileOpen ? '▲' : '▼'}</span>
        </button>

        <select
          value={active.sort}
          onChange={e => push({ sort: e.target.value })}
          className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {hasFilters && (
          <button onClick={clearAll} className="text-xs text-indigo-600 font-semibold px-2 shrink-0">
            Clear
          </button>
        )}
      </div>

      {/* Collapsible panel */}
      {mobileOpen && (
        <div className="mt-3 bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
          {filterSections(true)}
          <p className="text-xs text-slate-400 px-4 py-3">
            {totalCount} game{totalCount !== 1 ? 's' : ''} found
          </p>
        </div>
      )}
    </div>
  )

  // ── Desktop sidebar ────────────────────────────────────────────────────────

  const desktopSidebar = (
    <aside className="hidden md:block w-64 shrink-0 space-y-1">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-slate-800">Filters</h2>
        {hasFilters && (
          <button onClick={clearAll} className="text-xs text-indigo-600 hover:text-indigo-800">
            Clear all
          </button>
        )}
      </div>

      {/* Sort */}
      <div className="pb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sort by</p>
        <select
          value={active.sort}
          onChange={e => push({ sort: e.target.value })}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="divide-y divide-slate-100">
        {filterSections(false)}
      </div>

      <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
        {totalCount} game{totalCount !== 1 ? 's' : ''} found
      </p>
    </aside>
  )

  return (
    <>
      {mobileBar}
      {desktopSidebar}
    </>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Accordion({
  title, note, dot, compact, children,
}: {
  title: string; note?: string; dot: boolean; compact: boolean; children: React.ReactNode
}) {
  return (
    <details className="group" open={dot || !compact}>
      <summary className={`flex items-center justify-between cursor-pointer select-none list-none ${
        compact ? 'px-4 py-3' : 'py-2.5'
      } text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors`}>
        <span className="flex items-center gap-1.5">
          {title}
          {note && <span className="font-normal normal-case text-slate-400">({note})</span>}
          {dot && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />}
        </span>
        <svg className="w-3.5 h-3.5 text-slate-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className={compact ? 'px-4 pb-3' : 'pb-3'}>
        {children}
      </div>
    </details>
  )
}

function PillGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5 pt-1">{children}</div>
}

function Pill({ label, active, compact, onClick }: { label: string; active: boolean; compact: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm border rounded-lg transition-colors ${
        compact
          ? 'px-2.5 py-1 text-xs'
          : 'w-full text-left px-3 py-1.5'
      } ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
      }`}
    >
      {label}
    </button>
  )
}
