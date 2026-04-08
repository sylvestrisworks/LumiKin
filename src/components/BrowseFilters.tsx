'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import Link from 'next/link'
import { SlidersHorizontal, X, LayoutGrid, List } from 'lucide-react'

// ─── Filter definitions ───────────────────────────────────────────────────────

export const AGE_OPTIONS = [
  { value: 'E',   label: 'Early Years (5–7)'       },
  { value: 'E10', label: 'Middle Childhood (8–12)'  },
  { value: 'T',   label: 'Early Teens (13–15)'      },
  { value: 'M',   label: 'Older Teens (16+)'        },
]

export const GENRE_OPTIONS = [
  'Action', 'Adventure', 'Puzzle', 'RPG', 'Strategy',
  'Simulation', 'Sports', 'Platformer', 'Shooter', 'Racing',
]

export const PLATFORM_OPTIONS = [
  { value: 'PC',          label: 'PC'             },
  { value: 'PlayStation', label: 'PlayStation'     },
  { value: 'Xbox',        label: 'Xbox'            },
  { value: 'Switch',      label: 'Nintendo Switch' },
  { value: 'iOS',         label: 'iOS'             },
  { value: 'Android',     label: 'Android'         },
  { value: 'VR',          label: 'VR / AR'         },
]

export const COMPLIANCE_OPTIONS = [
  { value: 'DSA',    label: 'DSA compliant'    },
  { value: 'GDPR-K', label: 'GDPR-K compliant' },
  { value: 'ODDS',   label: 'ODDS compliant'   },
]

export const BENEFIT_OPTIONS = [
  { value: 'problem-solving', label: 'Problem Solving'   },
  { value: 'spatial',         label: 'Spatial Awareness' },
  { value: 'teamwork',        label: 'Teamwork'          },
  { value: 'creativity',      label: 'Creativity'        },
  { value: 'communication',   label: 'Communication'     },
]

export const SORT_OPTIONS = [
  { value: 'curascore',   label: 'Curascore'          },
  { value: 'benefit',     label: 'Best benefit score'  },
  { value: 'safest',      label: 'Lowest risk'         },
  { value: 'riskiest',    label: 'Highest risk'        },
  { value: 'metacritic',  label: 'Metacritic score'    },
  { value: 'newest',      label: 'Newest'              },
  { value: 'alpha',       label: 'A–Z'                 },
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
  rep?: string       // 'good' = representationScore >= 0.5
  noProp?: string    // 'true' = propagandaLevel = 0
  sort: string
  q?: string
  page?: number
  view?: 'list' | 'grid'
}

type Props = {
  active: ActiveFilters
  totalCount: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BrowseFilters({ active, totalCount }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const push = useCallback((updates: Partial<ActiveFilters>) => {
    const merged = { ...active, ...updates, page: undefined } // reset page on filter change
    const params = new URLSearchParams()
    if (merged.age)               params.set('age',        merged.age)
    if (merged.genres.length)     params.set('genres',     merged.genres.join(','))
    if (merged.platforms.length)  params.set('platforms',  merged.platforms.join(','))
    if (merged.benefits.length)   params.set('benefits',   merged.benefits.join(','))
    if (merged.compliance.length) params.set('compliance', merged.compliance.join(','))
    if (merged.risk)              params.set('risk',       merged.risk)
    if (merged.time)              params.set('time',       merged.time)
    if (merged.price)             params.set('price',      merged.price)
    if (merged.rep)               params.set('rep',        merged.rep)
    if (merged.noProp)            params.set('noProp',     merged.noProp)
    if (merged.sort && merged.sort !== 'curascore') params.set('sort', merged.sort)
    if (merged.q)                 params.set('q',          merged.q)
    if (merged.view && merged.view !== 'list') params.set('view', merged.view)
    router.push(`${pathname}?${params.toString()}`)
  }, [active, pathname, router])

  const toggle = (key: 'genres' | 'platforms' | 'benefits' | 'compliance', value: string) => {
    const arr = active[key]
    push({ [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] })
  }

  const clearAll = () => { router.push(pathname); setDrawerOpen(false) }

  const activeCount = [
    active.age, ...active.genres, ...active.platforms,
    ...active.benefits, ...active.compliance,
    active.risk, active.time, active.price, active.rep, active.noProp,
  ].filter(Boolean).length

  const panel = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800">Filters</h2>
        {activeCount > 0 && (
          <button onClick={clearAll} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
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
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <FilterSection title="Age range">
        {AGE_OPTIONS.map(o => (
          <Chip key={o.value} label={o.label} active={active.age === o.value}
            onClick={() => push({ age: active.age === o.value ? undefined : o.value })} />
        ))}
      </FilterSection>

      <FilterSection title="Genre">
        <div className="flex flex-wrap gap-1.5">
          {GENRE_OPTIONS.map(g => (
            <Chip key={g} label={g} active={active.genres.includes(g)}
              onClick={() => toggle('genres', g)} />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Platform">
        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_OPTIONS.map(o => (
            <Chip key={o.value} label={o.label} active={active.platforms.includes(o.value)}
              onClick={() => toggle('platforms', o.value)} />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Benefit focus" note="Requires a review">
        {BENEFIT_OPTIONS.map(o => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={active.benefits.includes(o.value)}
              onChange={() => toggle('benefits', o.value)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            />
            <span className="text-sm text-slate-700 group-hover:text-slate-900">{o.label}</span>
          </label>
        ))}
      </FilterSection>

      <FilterSection title="Max risk level" note="Requires a review">
        {[
          { value: 'low',    label: 'Low only  (RIS ≤ 0.30)'    },
          { value: 'medium', label: 'Low + Medium (RIS ≤ 0.60)'  },
        ].map(o => (
          <Chip key={o.value} label={o.label} active={active.risk === o.value}
            onClick={() => push({ risk: active.risk === o.value ? undefined : o.value })} />
        ))}
      </FilterSection>

      <FilterSection title="Min. daily time" note="Requires a review">
        {[
          { value: '30', label: '30+ min' },
          { value: '60', label: '60+ min' },
          { value: '90', label: '90+ min' },
        ].map(o => (
          <Chip key={o.value} label={o.label} active={active.time === o.value}
            onClick={() => push({ time: active.time === o.value ? undefined : o.value })} />
        ))}
      </FilterSection>

      <FilterSection title="Price">
        {[
          { value: 'free', label: 'Free to play' },
          { value: '20',   label: 'Under $20'    },
          { value: '40',   label: 'Under $40'    },
        ].map(o => (
          <Chip key={o.value} label={o.label} active={active.price === o.value}
            onClick={() => push({ price: active.price === o.value ? undefined : o.value })} />
        ))}
      </FilterSection>

      <FilterSection title="Representation" note="Display only">
        <Chip
          label="Good representation"
          active={active.rep === 'good'}
          onClick={() => push({ rep: active.rep === 'good' ? undefined : 'good' })}
        />
        <p className="text-xs text-slate-400 mt-1">Gender balance + ethnic diversity both scored ≥ 2/3</p>
      </FilterSection>

      <FilterSection title="Ideological content" note="Display only">
        <Chip
          label="Exclude ideological content"
          active={active.noProp === 'true'}
          onClick={() => push({ noProp: active.noProp === 'true' ? undefined : 'true' })}
        />
        <p className="text-xs text-slate-400 mt-1">Hides games flagged with propaganda or strong ideological framing</p>
      </FilterSection>

      <FilterSection title="Compliance" note="Estimated">
        {COMPLIANCE_OPTIONS.map(o => (
          <Chip key={o.value} label={o.label} active={active.compliance.includes(o.value)}
            onClick={() => toggle('compliance', o.value)} />
        ))}
      </FilterSection>

      <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        {totalCount} game{totalCount !== 1 ? 's' : ''} found
      </p>
    </div>
  )

  return (
    <>
      {/* ── Desktop sidebar (lg+) ──────────────────────────────────────────── */}
      <aside className="hidden lg:block w-64 shrink-0">
        {panel}
      </aside>

      {/* ── Mobile filter button ───────────────────────────────────────────── */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white
            text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700
            shadow-sm transition-colors"
        >
          <SlidersHorizontal size={15} />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 bg-indigo-600 text-white text-xs font-black px-1.5 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Mobile drawer overlay ──────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="relative ml-auto w-80 max-w-full h-full bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-slate-800">Filters</h2>
              <button onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4">{panel}</div>
            <div className="sticky bottom-0 px-5 py-4 bg-white border-t border-slate-100">
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Show {totalCount} game{totalCount !== 1 ? 's' : ''}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

// ─── View toggle (exported for use in browse page) ────────────────────────────

export function ViewToggle({ view, listHref, gridHref }: { view: 'list' | 'grid'; listHref: string; gridHref: string }) {
  return (
    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
      <Link
        href={listHref}
        className={`p-2 transition-colors ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-700'}`}
        aria-label="List view"
      >
        <List size={15} />
      </Link>
      <Link
        href={gridHref}
        className={`p-2 transition-colors ${view === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-700'}`}
        aria-label="Grid view"
      >
        <LayoutGrid size={15} />
      </Link>
    </div>
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
