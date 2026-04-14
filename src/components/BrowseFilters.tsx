'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { SlidersHorizontal, X, LayoutGrid, List } from 'lucide-react'

// ─── Filter definitions ───────────────────────────────────────────────────────

export const AGE_OPTIONS = [
  { value: 'E',   labelKey: 'ageEarlyYears'      },
  { value: 'E10', labelKey: 'ageMiddleChildhood'  },
  { value: 'T',   labelKey: 'ageEarlyTeens'       },
  { value: 'M',   labelKey: 'ageOlderTeens'       },
]

// FIX: Utökad till alla genres som stöds av page.tsx / RAWG
export const GENRE_OPTIONS = [
  'Action', 'Adventure', 'Puzzle', 'RPG', 'Strategy',
  'Simulation', 'Sports', 'Platformer', 'Shooter', 'Racing',
  'Family', 'Casual', 'Indie', 'Fighting', 'Educational', 'Arcade', 'Card',
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
  { value: 'problem-solving', labelKey: 'benefitProblemSolving' },
  { value: 'spatial',         labelKey: 'benefitSpatial'        },
  { value: 'teamwork',        labelKey: 'benefitTeamwork'       },
  { value: 'creativity',      labelKey: 'benefitCreativity'     },
  { value: 'communication',   labelKey: 'benefitCommunication'  },
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
  rep?: string
  noProp?: string
  bechdel?: string
  sort: string
  q?: string
  page?: number
  view?: 'list' | 'grid'
}

type Props = {
  active: ActiveFilters
  totalCount: number
}

type T = ReturnType<typeof useTranslations<'filters'>>

// ─── Component ────────────────────────────────────────────────────────────────

export default function BrowseFilters({ active, totalCount }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const t        = useTranslations('filters')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const push = useCallback((updates: Partial<ActiveFilters>) => {
    const merged = { ...active, ...updates, page: undefined }
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
    if (merged.bechdel)           params.set('bechdel',    merged.bechdel)
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
    active.risk, active.time, active.price, active.rep, active.noProp, active.bechdel,
  ].filter(Boolean).length

  const sortOptions = [
    { value: 'curascore',  label: t('sortCurascore')  },
    { value: 'benefit',    label: t('sortBenefit')     },
    { value: 'safest',     label: t('sortSafest')      },
    { value: 'riskiest',   label: t('sortRiskiest')    },
    { value: 'metacritic', label: t('sortMetacritic')  },
    { value: 'newest',     label: t('sortNewest')      },
    { value: 'alpha',      label: t('sortAlpha')       },
  ]

  const riskOptions = [
    { value: 'low',    label: t('riskLow')    },
    { value: 'medium', label: t('riskMedium') },
  ]

  const timeOptions = [
    { value: '30', label: t('timeUpTo30')  },
    { value: '60', label: t('timeUpTo60')  },
    { value: '90', label: t('timeUpTo90')  },
  ]

  const priceOptions = [
    { value: 'free', label: t('priceFree')    },
    { value: '20',   label: t('priceUnder20') },
    { value: '40',   label: t('priceUnder40') },
  ]

  const panel = <FilterPanel
    t={t}
    active={active}
    totalCount={totalCount}
    activeCount={activeCount}
    sortOptions={sortOptions}
    riskOptions={riskOptions}
    timeOptions={timeOptions}
    priceOptions={priceOptions}
    push={push}
    toggle={toggle}
    clearAll={clearAll}
  />

  return (
    <>
      {/* ── Desktop sidebar (lg+) ──────────────────────────────────────────── */}
      <aside className="hidden lg:block w-56 xl:w-64 shrink-0">
        {panel}
      </aside>

      {/* ── Mobile filter button ───────────────────────────────────────────── */}
      <div className="lg:hidden mb-3 sm:mb-4">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800
            text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-400
            shadow-sm transition-colors"
          aria-label="Open filters"
          aria-expanded={drawerOpen}
        >
          <SlidersHorizontal size={15} />
          {t('heading')}
          {activeCount > 0 && (
            <span className="ml-1 bg-indigo-600 text-white text-xs font-black px-1.5 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Mobile drawer overlay ──────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="relative ml-auto w-[min(320px,100vw)] h-full bg-white dark:bg-slate-800 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h2 className="font-bold text-slate-800 dark:text-slate-100">{t('heading')}</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-4 sm:px-5 py-4">{panel}</div>
            <div className="sticky bottom-0 px-4 sm:px-5 py-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {t('showGames', { count: totalCount })}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

// ─── Filter panel (shared between desktop + mobile) ───────────────────────────

function FilterPanel({
  t, active, totalCount, activeCount, sortOptions, riskOptions, timeOptions, priceOptions, push, toggle, clearAll,
}: {
  t: T
  active: ActiveFilters
  totalCount: number
  activeCount: number
  sortOptions: { value: string; label: string }[]
  riskOptions: { value: string; label: string }[]
  timeOptions: { value: string; label: string }[]
  priceOptions: { value: string; label: string }[]
  push: (u: Partial<ActiveFilters>) => void
  toggle: (key: 'genres' | 'platforms' | 'benefits' | 'compliance', value: string) => void
  clearAll: () => void
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800 dark:text-slate-100">{t('heading')}</h2>
        {activeCount > 0 && (
          <button onClick={clearAll} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium">
            {t('clearAll')}
          </button>
        )}
      </div>

      {/* Sort */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">{t('sortBy')}</p>
        <select
          value={active.sort}
          onChange={e => push({ sort: e.target.value })}
          className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Age */}
      <FilterSection title={t('sectionAge')}>
        {AGE_OPTIONS.map(o => (
          <Chip key={o.value} label={t(o.labelKey as Parameters<T>[0])} active={active.age === o.value}
            onClick={() => push({ age: active.age === o.value ? undefined : o.value })} />
        ))}
      </FilterSection>

      {/* Genre — scrollbar om listan är lång */}
      <FilterSection title={t('sectionGenre')}>
        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
          {GENRE_OPTIONS.map(g => (
            <Chip key={g} label={g} active={active.genres.includes(g)}
              onClick={() => toggle('genres', g)} />
          ))}
        </div>
      </FilterSection>

      {/* Platform */}
      <FilterSection title={t('sectionPlatform')}>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_OPTIONS.map(o => (
            <Chip key={o.value} label={o.label} active={active.platforms.includes(o.value)}
              onClick={() => toggle('platforms', o.value)} />
          ))}
        </div>
      </FilterSection>

      {/* Benefits */}
      <FilterSection title={t('sectionBenefit')} note={t('requiresReview')}>
        {BENEFIT_OPTIONS.map(o => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={active.benefits.includes(o.value)}
              onChange={() => toggle('benefits', o.value)}
              className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 bg-white dark:bg-slate-700"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
              {t(o.labelKey as Parameters<T>[0])}
            </span>
          </label>
        ))}
      </FilterSection>

      {/* Risk */}
      <FilterSection title={t('sectionRisk')} note={t('requiresReview')}>
        {riskOptions.map(o => (
          <Chip key={o.value} label={o.label} active={active.risk === o.value}
            onClick={() => push({ risk: active.risk === o.value ? undefined : o.value })} />
        ))}
      </FilterSection>

      {/* Time */}
      <FilterSection title={t('sectionTime')} note={t('requiresReview')}>
        {timeOptions.map(o => (
          <Chip key={o.value} label={o.label} active={active.time === o.value}
            onClick={() => push({ time: active.time === o.value ? undefined : o.value })} />
        ))}
      </FilterSection>

      {/* Price */}
      <FilterSection title={t('sectionPrice')}>
        {priceOptions.map(o => (
          <Chip key={o.value} label={o.label} active={active.price === o.value}
            onClick={() => push({ price: active.price === o.value ? undefined : o.value })} />
        ))}
      </FilterSection>

      {/* Representation */}
      <FilterSection title={t('sectionRepresentation')} note={t('displayOnly')}>
        <Chip
          label={t('repGood')}
          active={active.rep === 'good'}
          onClick={() => push({ rep: active.rep === 'good' ? undefined : 'good' })}
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('repGoodNote')}</p>
      </FilterSection>

      {/* Ideology */}
      <FilterSection title={t('sectionIdeology')} note={t('displayOnly')}>
        <Chip
          label={t('ideologyExclude')}
          active={active.noProp === 'true'}
          onClick={() => push({ noProp: active.noProp === 'true' ? undefined : 'true' })}
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('ideologyNote')}</p>
      </FilterSection>

      {/* Bechdel */}
      <FilterSection title={t('sectionBechdel')} note={t('displayOnly')}>
        <Chip
          label={t('bechdelPass')}
          active={active.bechdel === 'pass'}
          onClick={() => push({ bechdel: active.bechdel === 'pass' ? undefined : 'pass' })}
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('bechdelNote')}</p>
      </FilterSection>

      {/* Compliance */}
      <FilterSection title={t('sectionCompliance')} note={t('estimated')}>
        {COMPLIANCE_OPTIONS.map(o => (
          <Chip key={o.value} label={o.label} active={active.compliance.includes(o.value)}
            onClick={() => toggle('compliance', o.value)} />
        ))}
      </FilterSection>

      <p className="text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-700">
        {t('gamesFound', { count: totalCount })}
      </p>
    </div>
  )
}

// ─── View toggle ──────────────────────────────────────────────────────────────

export function ViewToggle({ view, listHref, gridHref }: { view: 'list' | 'grid'; listHref: string; gridHref: string }) {
  return (
    <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
      <Link
        href={listHref}
        className={`p-2 transition-colors ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
        aria-label="List view"
        aria-current={view === 'list' ? 'true' : undefined}
      >
        <List size={15} />
      </Link>
      <Link
        href={gridHref}
        className={`p-2 transition-colors ${view === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
        aria-label="Grid view"
        aria-current={view === 'grid' ? 'true' : undefined}
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
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
        {title}
        {note && <span className="ml-1 font-normal normal-case text-slate-400 dark:text-slate-500">({note})</span>}
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
          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:hover:border-indigo-500 dark:hover:text-indigo-400'
      }`}
    >
      {label}
    </button>
  )
}
