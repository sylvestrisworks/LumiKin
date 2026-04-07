'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'

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
  { value: 'PC',     label: 'PC' },
  { value: 'PlayStation', label: 'PlayStation' },
  { value: 'Xbox',   label: 'Xbox' },
  { value: 'Switch', label: 'Nintendo Switch' },
  { value: 'iOS',    label: 'iOS' },
  { value: 'Android',label: 'Android' },
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
  compliance: string[]  // 'DSA' | 'GDPR-K' | 'ODDS'
  risk?: string         // 'low' | 'medium' | ''
  time?: string         // '30' | '60' | '90' | ''
  price?: string        // 'free' | '20' | '40' | ''
  sort: string
  q?: string
}

type Props = {
  active: ActiveFilters
  totalCount: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BrowseFilters({ active, totalCount }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const push = useCallback((updates: Partial<ActiveFilters>) => {
    const merged = { ...active, ...updates }
    const params = new URLSearchParams()
    if (merged.age)               params.set('age', merged.age)
    if (merged.genres.length)     params.set('genres', merged.genres.join(','))
    if (merged.platforms.length)  params.set('platforms', merged.platforms.join(','))
    if (merged.benefits.length)   params.set('benefits', merged.benefits.join(','))
    if (merged.compliance.length) params.set('compliance', merged.compliance.join(','))
    if (merged.risk)              params.set('risk', merged.risk)
    if (merged.time)              params.set('time', merged.time)
    if (merged.price)             params.set('price', merged.price)
    if (merged.sort && merged.sort !== 'curascore') params.set('sort', merged.sort)
    if (merged.q)                 params.set('q', merged.q)
    router.push(`${pathname}?${params.toString()}`)
  }, [active, pathname, router])

  const toggle = (key: 'genres' | 'platforms' | 'benefits' | 'compliance', value: string) => {
    const arr = active[key]
    push({ [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] })
  }

  const clearAll = () => router.push(pathname)

  const hasFilters = active.age || active.genres.length || active.platforms.length ||
    active.benefits.length || active.compliance.length || active.risk || active.time || active.price

  return (
    <aside className="w-64 shrink-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800">Filters</h2>
        {hasFilters && (
          <button onClick={clearAll} className="text-xs text-indigo-600 hover:text-indigo-800">
            Clear all
          </button>
        )}
      </div>

      {/* Sort */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sort by</p>
        <select
          value={active.sort}
          onChange={e => push({ sort: e.target.value })}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Age / ESRB */}
      <FilterSection title="Age range">
        {AGE_OPTIONS.map(o => (
          <Chip
            key={o.value}
            label={o.label}
            active={active.age === o.value}
            onClick={() => push({ age: active.age === o.value ? undefined : o.value })}
          />
        ))}
      </FilterSection>

      {/* Genre */}
      <FilterSection title="Genre">
        <div className="flex flex-wrap gap-1.5">
          {GENRE_OPTIONS.map(g => (
            <Chip
              key={g}
              label={g}
              active={active.genres.includes(g)}
              onClick={() => toggle('genres', g)}
            />
          ))}
        </div>
      </FilterSection>

      {/* Platform */}
      <FilterSection title="Platform">
        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_OPTIONS.map(o => (
            <Chip
              key={o.value}
              label={o.label}
              active={active.platforms.includes(o.value)}
              onClick={() => toggle('platforms', o.value)}
            />
          ))}
        </div>
      </FilterSection>

      {/* Benefit focus */}
      <FilterSection title="Benefit focus" note="Requires a review">
        {BENEFIT_OPTIONS.map(o => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={active.benefits.includes(o.value)}
              onChange={() => toggle('benefits', o.value)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
            />
            <span className="text-sm text-slate-700 group-hover:text-slate-900">{o.label}</span>
          </label>
        ))}
      </FilterSection>

      {/* Regulatory compliance */}
      <FilterSection title="Compliance" note="Estimated">
        {COMPLIANCE_OPTIONS.map(o => (
          <Chip
            key={o.value}
            label={o.label}
            active={active.compliance.includes(o.value)}
            onClick={() => toggle('compliance', o.value)}
          />
        ))}
      </FilterSection>

      {/* Max risk */}
      <FilterSection title="Max risk level" note="Requires a review">
        {[
          { value: 'low',    label: 'Low only (RIS < 0.30)' },
          { value: 'medium', label: 'Low–Medium (RIS < 0.60)' },
        ].map(o => (
          <Chip
            key={o.value}
            label={o.label}
            active={active.risk === o.value}
            onClick={() => push({ risk: active.risk === o.value ? undefined : o.value })}
          />
        ))}
      </FilterSection>

      {/* Time recommendation */}
      <FilterSection title="Min. daily time" note="Requires a review">
        {[
          { value: '30',  label: '30+ min' },
          { value: '60',  label: '60+ min' },
          { value: '90',  label: '90+ min' },
        ].map(o => (
          <Chip
            key={o.value}
            label={o.label}
            active={active.time === o.value}
            onClick={() => push({ time: active.time === o.value ? undefined : o.value })}
          />
        ))}
      </FilterSection>

      {/* Price */}
      <FilterSection title="Price">
        {[
          { value: 'free', label: 'Free to play' },
          { value: '20',   label: 'Under $20' },
          { value: '40',   label: 'Under $40' },
        ].map(o => (
          <Chip
            key={o.value}
            label={o.label}
            active={active.price === o.value}
            onClick={() => push({ price: active.price === o.value ? undefined : o.value })}
          />
        ))}
      </FilterSection>

      {/* Count */}
      <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        {totalCount} game{totalCount !== 1 ? 's' : ''} found
      </p>
    </aside>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function FilterSection({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        {title}
        {note && <span className="ml-1 font-normal normal-case text-slate-400">({note})</span>}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-sm px-3 py-1.5 rounded-lg border transition-colors ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
      }`}
    >
      {label}
    </button>
  )
}
