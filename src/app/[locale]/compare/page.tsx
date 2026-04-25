'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import type { GameCardProps, GameSummary } from '@/types/game'
import { esrbToAge, ageBadgeColor } from '@/lib/ui'
import Icon from '@/components/Icon'

// ─── Dark pattern label keys ─────────────────────────────────────────────────

const DP_KEY: Record<string, string> = {
  DP01: 'dpGateway', DP02: 'dpConfirm',   DP03: 'dpScarcity',
  DP04: 'dpCurrency', DP05: 'dpParasocial', DP06: 'dpStreak',
  DP07: 'dpEnergy', DP08: 'dpSocial', DP09: 'dpLootBox',
  DP10: 'dpPaySkip', DP11: 'dpNotif', DP12: 'dpFomo',
}

// ─── Verdict generator ────────────────────────────────────────────────────────

type CompareT = ReturnType<typeof useTranslations<'compare'>>

function generateVerdict(t: CompareT, a: GameCardProps, b: GameCardProps): string | null {
  const aS = a.scores; const bS = b.scores
  if (!aS || !bS) return null

  const aCura = aS.curascore ?? 0; const bCura = bS.curascore ?? 0
  const gap     = Math.abs(aCura - bCura)
  const aTime   = aS.timeRecommendationMinutes ?? 0
  const bTime   = bS.timeRecommendationMinutes ?? 0
  const timeDiff = Math.abs(aTime - bTime)

  const aName = a.game.title.split(/[\s:—–]/)[0]
  const bName = b.game.title.split(/[\s:—–]/)[0]

  const betterName = aCura >= bCura ? aName : bName
  const higherRis  = (aS.ris ?? 0) >= (bS.ris ?? 0) ? aName : bName

  const monetDiff  = Math.abs((aS.monetizationRisk ?? 0) - (bS.monetizationRisk ?? 0))
  const dopDiff    = Math.abs((aS.dopamineRisk    ?? 0) - (bS.dopamineRisk    ?? 0))
  const socialDiff = Math.abs((aS.socialRisk      ?? 0) - (bS.socialRisk      ?? 0))
  const maxRiskDiff = Math.max(monetDiff, dopDiff, socialDiff)

  const riskLabelKey = maxRiskDiff > 0.15
    ? (maxRiskDiff === monetDiff ? 'riskLabelMonetization' : maxRiskDiff === dopDiff ? 'riskLabelDopamine' : 'riskLabelSocial')
    : 'riskLabelOverall'

  if (gap < 5) {
    return t('verdictTie', { aName, bName })
  }

  let s = timeDiff >= 30
    ? t('verdictWithTime', { betterName, gap, timeDiff })
    : t('verdictNoTime', { betterName, gap })
  if (maxRiskDiff > 0.15) s += t('verdictRisk', { higherRis, riskLabel: t(riskLabelKey as Parameters<CompareT>[0]) })
  return s
}

// ─── Monetization tag builder ────────────────────────────────────────────────

function monetTags(t: CompareT, g: GameCardProps): string[] {
  const tags: string[] = []
  if (g.game.hasLootBoxes)        tags.push(t('monetLootBoxes'))
  if (g.game.hasBattlePass)       tags.push(t('monetBattlePass'))
  if (g.game.hasSubscription)     tags.push(t('monetSubscription'))
  if (g.review?.payToWin != null && g.review.payToWin >= 2) tags.push(t('monetPayToWin'))
  if (g.game.hasMicrotransactions && tags.length === 0)     tags.push(t('monetMicrotransactions'))
  if (tags.length === 0 && g.game.basePrice != null && g.game.basePrice > 0) tags.push(t('monetOneTimePurchase'))
  return tags
}

// ─── Game picker ──────────────────────────────────────────────────────────────

function GamePicker({
  label, selected, onSelect, onClear,
}: {
  label: string
  selected: GameCardProps | null
  onSelect: (data: GameCardProps) => void
  onClear: () => void
}) {
  const [query, setQuery]             = useState('')
  const [suggestions, setSuggestions] = useState<GameSummary[]>([])
  const [loading, setLoading]         = useState(false)
  const [open, setOpen]               = useState(false)
  const ref                           = useRef<HTMLDivElement>(null)
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef            = useRef<AbortController | null>(null)
  const t                             = useTranslations('compare')

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortControllerRef.current) abortControllerRef.current.abort()
    
    if (query.length < 2) { setSuggestions([]); setOpen(false); return }
    
    const sanitizedQuery = query.slice(0, 100).trim()
    if (!sanitizedQuery) return
    
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      abortControllerRef.current = new AbortController()
      
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(sanitizedQuery)}`, {
          signal: abortControllerRef.current.signal
        })
        if (!res.ok) throw new Error('Search failed')
        const data: GameSummary[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Search error:', err)
          setSuggestions([])
        }
      } finally { 
        setLoading(false) 
      }
    }, 250)
    
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [query])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function pick(slug: string) {
    if (!/^[a-zA-Z0-9_-]+$/.test(slug) || slug.length > 200) {
      console.error('Invalid slug format')
      return
    }
    
    setOpen(false); setQuery(''); setLoading(true)
    try {
      const res = await fetch(`/api/game/${encodeURIComponent(slug)}`)
      const text = await res.text()
      if (!res.ok || !text) {
        console.error(`[compare/pick] ${res.status} for ${slug}:`, text)
        return
      }
      const data: GameCardProps = JSON.parse(text)
      onSelect(data)
    } catch (err) {
      console.error('Failed to load game:', err)
    } finally { 
      setLoading(false) 
    }
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {selected.game.backgroundImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.game.backgroundImage} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{selected.game.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{selected.game.genres[0] ?? selected.game.developer ?? ''}</p>
          </div>
        </div>
        <button 
          onClick={onClear} 
          className="shrink-0 ml-3 text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          aria-label={t('change')}
        >
          {t('change')}
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">{label}</p>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500"
          aria-label={label}
          autoComplete="off"
          maxLength={100}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
          {suggestions.map(s => (
            <button
              key={s.slug}
              onClick={() => pick(s.slug)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0 text-left"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
                {s.backgroundImage
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={s.backgroundImage} alt="" className="w-full h-full object-cover" />
                  : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">{s.title.slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{s.title}</p>
                {s.genres[0] && <p className="text-xs text-slate-500 dark:text-slate-400">{s.genres[0]}</p>}
              </div>
              {s.esrbRating && (
                <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded shrink-0">{s.esrbRating}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Score row ────────────────────────────────────────────────────────────────

type ScoreRowProps = {
  label: string
  tooltip?: string
  aVal: number | null
  bVal: number | null
  higherIsBetter: boolean
  format?: (v: number) => string
}

function ScoreRow({ label, tooltip, aVal, bVal, higherIsBetter, format }: ScoreRowProps) {
  const a = aVal ?? null
  const b = bVal ?? null
  if (a === null && b === null) return null

  const aNum = a ?? 0; const bNum = b ?? 0
  const aWins = higherIsBetter ? aNum > bNum : aNum < bNum
  const bWins = higherIsBetter ? bNum > aNum : bNum < aNum
  const tie   = Math.abs(aNum - bNum) < 0.03

  const fmt = format ?? ((v: number) => String(Math.round(v * 100)))

  const barColor  = (wins: boolean) => wins && !tie ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'
  const valColor  = (wins: boolean) => wins && !tie
    ? 'text-emerald-700 dark:text-emerald-400 font-black'
    : 'text-slate-500 dark:text-slate-400 font-semibold'
  const cellBg    = (wins: boolean) => wins && !tie
    ? 'bg-emerald-50 dark:bg-emerald-900/20'
    : ''

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
      {/* Game A */}
      <div className={`flex items-center gap-2 justify-end px-3 py-2.5 rounded-l-lg ${cellBg(aWins)}`}>
        <span className={`text-sm tabular-nums ${valColor(aWins)}`}>
          {a !== null ? fmt(a) : '—'}
        </span>
        <div className="w-16 sm:w-20 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor(aWins)}`}
            style={{ width: a !== null ? `${Math.round(aNum * 100)}%` : '0%' }} />
        </div>
      </div>

      {/* Label */}
      <div className="text-center px-2 py-2.5 min-w-[100px] sm:min-w-[120px]">
        <span className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
          {label}
          {tooltip && <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500" title={tooltip}>ⓘ</span>}
        </span>
      </div>

      {/* Game B */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-r-lg ${cellBg(bWins)}`}>
        <div className="w-16 sm:w-20 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor(bWins)}`}
            style={{ width: b !== null ? `${Math.round(bNum * 100)}%` : '0%' }} />
        </div>
        <span className={`text-sm tabular-nums ${valColor(bWins)}`}>
          {b !== null ? fmt(b) : '—'}
        </span>
      </div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="py-2 mt-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
    </div>
  )
}

function InfoRow({ label, aText, bText, aGood, bGood }: {
  label: string; aText: string; bText: string; aGood?: boolean; bGood?: boolean
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
      <div className={`text-right px-3 py-2.5 rounded-l-lg ${aGood ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          aGood
            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}>{aText}</span>
      </div>
      <div className="text-center px-2 py-2.5 min-w-[100px] sm:min-w-[120px]">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className={`text-left px-3 py-2.5 rounded-r-lg ${bGood ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          bGood
            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}>{bText}</span>
      </div>
    </div>
  )
}

// ─── Tags section ─────────────────────────────────────────────────────────────

function TagsSection({ a, b }: { a: GameCardProps; b: GameCardProps }) {
  const t = useTranslations('compare')

  const aSkills    = new Set((a.scores?.topBenefits ?? []).map(s => s.skill))
  const bSkills    = new Set((b.scores?.topBenefits ?? []).map(s => s.skill))
  const sharedSkills  = Array.from(aSkills).filter(s => bSkills.has(s))
  const uniqueASkills = Array.from(aSkills).filter(s => !bSkills.has(s))
  const uniqueBSkills = Array.from(bSkills).filter(s => !aSkills.has(s))

  const aDP    = new Set(a.darkPatterns.map(p => p.patternId))
  const bDP    = new Set(b.darkPatterns.map(p => p.patternId))
  const sharedDP   = Array.from(aDP).filter(p => bDP.has(p))
  const uniqueADP  = Array.from(aDP).filter(p => !bDP.has(p))
  const uniqueBDP  = Array.from(bDP).filter(p => !aDP.has(p))

  const hasSkills = aSkills.size > 0 || bSkills.size > 0
  const hasDP     = aDP.size > 0 || bDP.size > 0
  if (!hasSkills && !hasDP) return null

  const Tag = ({ label, color }: { label: string; color: string }) => (
    <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
  )

  const aTitle = a.game.title.split(/[\s:—–]/)[0]
  const bTitle = b.game.title.split(/[\s:—–]/)[0]

  return (
    <div className="border-t border-slate-100 dark:border-slate-700 px-4 sm:px-6 py-4 space-y-5">

      {hasSkills && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">{t('tagsSkillsHeader')}</p>

          {sharedSkills.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mb-1.5">{t('tagsBothDevelop')}</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {sharedSkills.map(s => <Tag key={s} label={s} color="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" />)}
              </div>
            </div>
          )}

          {(uniqueASkills.length > 0 || uniqueBSkills.length > 0) && (
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
              <div className="flex flex-wrap gap-1 justify-end">
                {uniqueASkills.length > 0
                  ? uniqueASkills.map(s => <Tag key={s} label={s} color="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" />)
                  : <span className="text-[11px] text-slate-300 dark:text-slate-600 italic">—</span>}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center self-center px-1 min-w-[70px]">{t('tagsOnly')}</div>
              <div className="flex flex-wrap gap-1">
                {uniqueBSkills.length > 0
                  ? uniqueBSkills.map(s => <Tag key={s} label={s} color="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" />)
                  : <span className="text-[11px] text-slate-300 dark:text-slate-600 italic">—</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {hasDP && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">{t('tagsTacticsHeader')}</p>

          {sharedDP.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mb-1.5">{t('tagsBothUse')}</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {sharedDP.map(p => <Tag key={p} label={DP_KEY[p] ? t(DP_KEY[p] as Parameters<CompareT>[0]) : p} color="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" />)}
              </div>
            </div>
          )}

          {(uniqueADP.length > 0 || uniqueBDP.length > 0) && (
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
              <div className="flex flex-wrap gap-1 justify-end">
                {uniqueADP.length > 0
                  ? uniqueADP.map(p => <Tag key={p} label={DP_KEY[p] ? t(DP_KEY[p] as Parameters<CompareT>[0]) : p} color="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" />)
                  : <span className="text-[11px] text-slate-300 dark:text-slate-600 italic">—</span>}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center self-center px-1 min-w-[70px]">{t('tagsOnly')}</div>
              <div className="flex flex-wrap gap-1">
                {uniqueBDP.length > 0
                  ? uniqueBDP.map(p => <Tag key={p} label={DP_KEY[p] ? t(DP_KEY[p] as Parameters<CompareT>[0]) : p} color="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" />)
                  : <span className="text-[11px] text-slate-300 dark:text-slate-600 italic">—</span>}
              </div>
            </div>
          )}

          {(uniqueADP.length > 0 || uniqueBDP.length > 0) && (
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mt-1">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right truncate">{aTitle}</p>
              <div className="min-w-[70px]" />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{bTitle}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Scorecard ────────────────────────────────────────────────────────────────

function Scorecard({ a, b }: { a: GameCardProps; b: GameCardProps }) {
  const t = useTranslations('compare')
  const locale = useLocale()

  const aScore = a.scores
  const bScore = b.scores

  const curaBg = (s: number | null) => {
    if (s == null) return 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
    if (s >= 70) return 'bg-emerald-500 text-white'
    if (s >= 40) return 'bg-amber-400 text-white'
    return 'bg-red-500 text-white'
  }

  const timeBg = (c: string | null | undefined) =>
    c === 'green' ? 'bg-emerald-500 text-white'
    : c === 'amber' ? 'bg-amber-400 text-white'
    : c === 'red'   ? 'bg-red-500 text-white'
    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'

  const timeLabel = (s: typeof aScore) =>
    s?.timeRecommendationMinutes != null
      ? `${s.timeRecommendationMinutes >= 120 ? '120+' : s.timeRecommendationMinutes}m`
      : null

  const aMonth = a.review?.estimatedMonthlyCostLow != null
    ? a.review.estimatedMonthlyCostLow === 0 && a.review.estimatedMonthlyCostHigh === 0
      ? t('free')
      : `$${a.review.estimatedMonthlyCostLow}–$${a.review.estimatedMonthlyCostHigh ?? a.review.estimatedMonthlyCostLow}/mo`
    : '—'

  const bMonth = b.review?.estimatedMonthlyCostLow != null
    ? b.review.estimatedMonthlyCostLow === 0 && b.review.estimatedMonthlyCostHigh === 0
      ? t('free')
      : `$${b.review.estimatedMonthlyCostLow}–$${b.review.estimatedMonthlyCostHigh ?? b.review.estimatedMonthlyCostLow}/mo`
    : '—'

  const aFree = a.review?.estimatedMonthlyCostLow === 0 && a.review?.estimatedMonthlyCostHigh === 0
  const bFree = b.review?.estimatedMonthlyCostLow === 0 && b.review?.estimatedMonthlyCostHigh === 0

  const aCura = aScore?.curascore ?? 0
  const bCura = bScore?.curascore ?? 0
  const gap   = Math.abs(aCura - bCura)
  const winner = gap >= 5 ? (aCura > bCura ? a.game.title : b.game.title) : null

  const verdict = generateVerdict(t, a, b)
  const aMonetTags = monetTags(t, a)
  const bMonetTags = monetTags(t, b)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">

      {/* ── Sticky game headers ── */}
      <div className="sticky top-14 z-20 rounded-t-2xl overflow-hidden bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="grid grid-cols-[1fr_auto_1fr]">
          {/* Game A */}
          <div className="p-3 sm:p-4 flex items-center gap-2.5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
              {a.game.backgroundImage
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={a.game.backgroundImage} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-xs font-black text-indigo-500 dark:text-indigo-400">{a.game.title.slice(0,2).toUpperCase()}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{a.game.title}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {aScore?.curascore != null && (
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${curaBg(aScore.curascore)}`}>
                    {aScore.curascore}
                  </span>
                )}
                {timeLabel(aScore) && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${timeBg(aScore?.timeRecommendationColor)}`}>
                    {timeLabel(aScore)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* VS */}
          <div className="flex items-center justify-center px-2 border-x border-slate-100 dark:border-slate-700">
            <span className="text-xs font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">vs</span>
          </div>

          {/* Game B */}
          <div className="p-3 sm:p-4 flex items-center gap-2.5 flex-row-reverse sm:flex-row">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
              {b.game.backgroundImage
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={b.game.backgroundImage} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-xs font-black text-indigo-500 dark:text-indigo-400">{b.game.title.slice(0,2).toUpperCase()}</span>}
            </div>
            <div className="min-w-0 flex-1 sm:text-left text-right">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{b.game.title}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap sm:flex-row flex-row-reverse sm:justify-start justify-end">
                {bScore?.curascore != null && (
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${curaBg(bScore.curascore)}`}>
                    {bScore.curascore}
                  </span>
                )}
                {timeLabel(bScore) && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${timeBg(bScore?.timeRecommendationColor)}`}>
                    {timeLabel(bScore)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── At-a-glance verdict ── */}
      {verdict && (
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-center italic">{verdict}</p>
        </div>
      )}

      {/* ── Score rows ── */}
      <div className="px-4 sm:px-6 pb-2">

        {/* Benefits */}
        <SectionHeader label={t('scBenefitsHeader')} />
        <ScoreRow label={t('scGrowthScore')}  aVal={aScore?.bds                 ?? null} bVal={bScore?.bds                 ?? null} higherIsBetter={true}  tooltip={t('scGrowthTip')} />
        <ScoreRow label={t('scCognitive')}     aVal={aScore?.cognitiveScore       ?? null} bVal={bScore?.cognitiveScore       ?? null} higherIsBetter={true}  />
        <ScoreRow label={t('scSocial')}        aVal={aScore?.socialEmotionalScore ?? null} bVal={bScore?.socialEmotionalScore ?? null} higherIsBetter={true}  />
        <ScoreRow label={t('scMotor')}         aVal={aScore?.motorScore           ?? null} bVal={bScore?.motorScore           ?? null} higherIsBetter={true}  />

        {/* Risks */}
        <SectionHeader label={t('scRisksHeader')} />
        <ScoreRow label={t('scRiskLevel')}    aVal={aScore?.ris              ?? null} bVal={bScore?.ris              ?? null} higherIsBetter={false} tooltip={t('scRiskTip')} />
        <ScoreRow label={t('scDopamine')}     aVal={aScore?.dopamineRisk     ?? null} bVal={bScore?.dopamineRisk     ?? null} higherIsBetter={false} />
        <ScoreRow label={t('scMonetization')} aVal={aScore?.monetizationRisk ?? null} bVal={bScore?.monetizationRisk ?? null} higherIsBetter={false} />
        <ScoreRow label={t('scSocialRisk')}   aVal={aScore?.socialRisk       ?? null} bVal={bScore?.socialRisk       ?? null} higherIsBetter={false} />

        {/* True cost */}
        <SectionHeader label={t('scCostHeader')} />

        <InfoRow
          label={t('scBasePrice')}
          aText={a.game.basePrice === 0 ? t('free') : a.game.basePrice != null ? `$${a.game.basePrice.toFixed(0)}` : '—'}
          bText={b.game.basePrice === 0 ? t('free') : b.game.basePrice != null ? `$${b.game.basePrice.toFixed(0)}` : '—'}
          aGood={a.game.basePrice === 0}
          bGood={b.game.basePrice === 0}
        />

        <InfoRow
          label={t('scMonthlyCost')}
          aText={aMonth}
          bText={bMonth}
          aGood={aFree}
          bGood={bFree}
        />

        {/* Monetization tags */}
        {(aMonetTags.length > 0 || bMonetTags.length > 0) && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-0 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
            <div className="flex flex-wrap gap-1 justify-end px-3 py-2">
              {aMonetTags.map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{tag}</span>
              ))}
            </div>
            <div className="text-center px-2 py-2 min-w-[100px] sm:min-w-[120px] self-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('scMonetTags')}</span>
            </div>
            <div className="flex flex-wrap gap-1 px-3 py-2">
              {bMonetTags.map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Subscription warning */}
        {(a.game.hasSubscription || b.game.hasSubscription) && (
          <div className="grid grid-cols-[1fr_auto_1fr] gap-0 py-2 border-b border-slate-100 dark:border-slate-700/50">
            <div className="text-right px-3">
              {a.game.hasSubscription && (
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1"><Icon name="warning" size={12} aria-hidden="true" />{t('scSubRequired')}</span>
              )}
            </div>
            <div className="min-w-[100px] sm:min-w-[120px]" />
            <div className="px-3">
              {b.game.hasSubscription && (
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1"><Icon name="warning" size={12} aria-hidden="true" />{t('scSubRequired')}</span>
              )}
            </div>
          </div>
        )}

        {/* Practical */}
        <SectionHeader label={t('scPracticalHeader')} />

        <InfoRow
          label={t('scAgeRating')}
          aText={a.game.esrbRating ? `${esrbToAge(a.game.esrbRating)}+` : '—'}
          bText={b.game.esrbRating ? `${esrbToAge(b.game.esrbRating)}+` : '—'}
        />

        {(a.review?.hasNaturalStoppingPoints != null || b.review?.hasNaturalStoppingPoints != null) && (
          <InfoRow
            label={t('scStoppingPoints')}
            aText={a.review?.hasNaturalStoppingPoints == null ? '—' : a.review.hasNaturalStoppingPoints ? t('scYes') : t('scNo')}
            bText={b.review?.hasNaturalStoppingPoints == null ? '—' : b.review.hasNaturalStoppingPoints ? t('scYes') : t('scNo')}
            aGood={a.review?.hasNaturalStoppingPoints === true}
            bGood={b.review?.hasNaturalStoppingPoints === true}
          />
        )}
      </div>

      {/* ── Tags section ── */}
      <TagsSection a={a} b={b} />

      {/* ── Verdict banner ── */}
      {winner && (
        <div className="border-t border-slate-100 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20 px-6 py-4 flex items-center gap-3">
          <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            <span className="font-bold">{winner}</span>
            {' '}{t('scVerdictSub')}
          </p>
        </div>
      )}

      {/* ── Full review links ── */}
      <div className="border-t border-slate-100 dark:border-slate-700 px-6 py-3 flex justify-between rounded-b-2xl">
        <Link href={`/${locale}/game/${a.game.slug}`} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline font-medium">
          {t('scFullReview', { title: a.game.title.split(' ').slice(0, 3).join(' ') })} →
        </Link>
        <Link href={`/${locale}/game/${b.game.slug}`} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline font-medium">
          {t('scFullReview', { title: b.game.title.split(' ').slice(0, 3).join(' ') })} →
        </Link>
      </div>
    </div>
  )
}

// ─── Curated comparison pairs ────────────────────────────────────────────────

const CURATED_PAIRS = [
  { labelKey: 'curatedClassic', a: { slug: 'fortnite',   name: 'Fortnite' },          b: { slug: 'minecraft',  name: 'Minecraft' } },
  { labelKey: 'curatedGiants',  a: { slug: 'roblox',     name: 'Roblox' },            b: { slug: 'minecraft',  name: 'Minecraft' } },
  { labelKey: 'curatedRacing',  a: { slug: 'mario-kart-8-deluxe', name: 'Mario Kart 8' }, b: { slug: 'rocket-league', name: 'Rocket League' } },
  { labelKey: 'curatedChill',   a: { slug: 'animal-crossing-new-horizons', name: 'Animal Crossing' }, b: { slug: 'stardew-valley', name: 'Stardew Valley' } },
  { labelKey: 'curatedCoop',    a: { slug: 'split-fiction', name: 'Split Fiction' },   b: { slug: 'portal-2',  name: 'Portal 2' } },
  { labelKey: 'curatedF2P',     a: { slug: 'genshin-impact', name: 'Genshin Impact' }, b: { slug: 'fortnite',  name: 'Fortnite' } },
]

function PopularComparisons({
  onSelectPair,
}: {
  onSelectPair: (aSlug: string, bSlug: string) => Promise<void>
}) {
  const t = useTranslations('compare')
  const [loading, setLoading] = useState<string | null>(null)

  async function handlePick(aSlug: string, bSlug: string) {
    const key = `${aSlug}:${bSlug}`
    setLoading(key)
    try {
      await onSelectPair(aSlug, bSlug)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
      <div className="mb-4">
        <p className="font-semibold text-slate-700 dark:text-slate-200">{t('popularComparisons')}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('popularComparisonsSub')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {CURATED_PAIRS.map(pair => {
          const key = `${pair.a.slug}:${pair.b.slug}`
          const isLoading = loading === key
          return (
            <button
              key={key}
              onClick={() => handlePick(pair.a.slug, pair.b.slug)}
              disabled={loading !== null}
              className="group text-left rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all disabled:opacity-50"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">
                {t(pair.labelKey as Parameters<CompareT>[0])}
              </p>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-xs text-indigo-600 dark:text-indigo-400">{t('popularLoadingPair')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{pair.a.name}</span>
                  <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 shrink-0">VS</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{pair.b.name}</span>
                  <span className="ml-auto shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 dark:group-hover:text-indigo-500 transition-colors">→</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Suggestion strip ─────────────────────────────────────────────────────────

function SuggestionStrip({ highRiskGame }: { highRiskGame: GameCardProps }) {
  const t = useTranslations('compare')
  const locale = useLocale()
  const [suggestions, setSuggestions] = useState<GameSummary[]>([])
  const genre = highRiskGame.game.genres[0]
  const ris   = highRiskGame.scores?.ris ?? 0

  useEffect(() => {
    if (!genre || ris < 0.5) return
    
    const sanitizedGenre = genre.slice(0, 100)
    const validRis = Math.max(0, Math.min(1, ris))
    const maxRis = Math.max(validRis - 0.2, 0.1)
    const slug = highRiskGame.game.slug.slice(0, 200)
    
    const abortController = new AbortController()
    
    fetch(
      `/api/suggest?genre=${encodeURIComponent(sanitizedGenre)}&maxRis=${maxRis}&excludeSlug=${encodeURIComponent(slug)}`,
      { signal: abortController.signal }
    )
      .then(r => {
        if (!r.ok) throw new Error('Suggest API failed')
        return r.json()
      })
      .then(setSuggestions)
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch suggestions:', err)
        }
      })
    
    return () => abortController.abort()
  }, [genre, ris, highRiskGame.game.slug])

  if (ris < 0.5 || suggestions.length === 0) return null

  const timeBg = (c: 'green' | 'amber' | 'red' | null) =>
    c === 'green' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
    : c === 'amber' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'

  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5">
      <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">{t('similarSafer')}</h3>
      <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-4">
        {t('similarSaferSub', { title: highRiskGame.game.title, genre: genre ?? '' })}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {suggestions.map(s => (
          <Link
            key={s.slug}
            href={`/${locale}/game/${s.slug}`}
            className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
              {s.backgroundImage
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={s.backgroundImage} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400">{s.title.slice(0,2).toUpperCase()}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{s.title}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {s.esrbRating && <span className="text-xs text-slate-500 dark:text-slate-400">{s.esrbRating}</span>}
                {s.timeRecommendationMinutes && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${timeBg(s.timeRecommendationColor)}`}>
                    {s.timeRecommendationMinutes}m
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Load game helper ─────────────────────────────────────────────────────────

async function loadGame(slug: string): Promise<GameCardProps | null> {
  if (!/^[a-zA-Z0-9_-]+$/.test(slug) || slug.length > 200) {
    console.error('Invalid slug format:', slug)
    return null
  }
  
  try {
    const res = await fetch(`/api/game/${encodeURIComponent(slug)}`)
    if (!res.ok) return null
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text)
  } catch (err) {
    console.error('Failed to load game:', err)
    return null
  }
}

// ─── Main compare page ────────────────────────────────────────────────────────

function ComparePageInner() {
  const t            = useTranslations('compare')
  const locale       = useLocale()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [gameA, setGameA] = useState<GameCardProps | null>(null)
  const [gameB, setGameB] = useState<GameCardProps | null>(null)
  const [copied, setCopied] = useState(false)
  const initialised = useRef(false)

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    
    const slugA = searchParams.get('a')
    const slugB = searchParams.get('b')
    
    const isValidSlug = (s: string | null): s is string => 
      s !== null && /^[a-zA-Z0-9_-]+$/.test(s) && s.length <= 200
    
    if (isValidSlug(slugA)) {
      loadGame(slugA).then(d => d && setGameA(d)).catch(err => {
        console.error('Failed to load game A:', err)
      })
    }
    if (isValidSlug(slugB)) {
      loadGame(slugB).then(d => d && setGameB(d)).catch(err => {
        console.error('Failed to load game B:', err)
      })
    }
  }, [searchParams])

  const syncUrl = useCallback((a: GameCardProps | null, b: GameCardProps | null) => {
    const params = new URLSearchParams()
    if (a) params.set('a', a.game.slug)
    if (b) params.set('b', b.game.slug)
    const qs = params.toString()
    router.replace(qs ? `/${locale}/compare?${qs}` : `/${locale}/compare`, { scroll: false })
  }, [router])

  function selectA(data: GameCardProps) { setGameA(data); syncUrl(data, gameB) }
  function selectB(data: GameCardProps) { setGameB(data); syncUrl(gameA, data) }
  function clearA()                     { setGameA(null); syncUrl(null, gameB) }
  function clearB()                     { setGameB(null); syncUrl(gameA, null) }

  async function selectPair(aSlug: string, bSlug: string) {
    const [a, b] = await Promise.all([loadGame(aSlug), loadGame(bSlug)])
    if (a) setGameA(a)
    if (b) setGameB(b)
    if (a || b) syncUrl(a, b)
  }

  function copyLink() {
    if (!navigator.clipboard) {
      console.error('Clipboard API not available')
      return
    }
    
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(err => {
        console.error('Failed to copy link:', err)
      })
  }

  const both         = gameA !== null && gameB !== null
  const highRiskGame = both
    ? ((gameA.scores?.ris ?? 0) >= (gameB.scores?.ris ?? 0) ? gameA : gameB)
    : null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GamePicker label={t('gameA')} selected={gameA} onSelect={selectA} onClear={clearA} />
          <GamePicker label={t('gameB')} selected={gameB} onSelect={selectB} onClear={clearB} />
        </div>

        {/* Copy link */}
        {(gameA || gameB) && (
          <div className="flex justify-end">
            <button
              onClick={copyLink}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
            >
              {copied ? `✓ ${t('linkCopied')}` : `🔗 ${t('copyLink')}`}
            </button>
          </div>
        )}

        {/* Empty state / popular pairs */}
        {!gameA && !gameB && (
          <PopularComparisons onSelectPair={selectPair} />
        )}

        {/* Single game */}
        {(gameA && !gameB) && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-5 py-4 text-sm text-indigo-700 dark:text-indigo-300 text-center">
            {t('pickSecond')}
          </div>
        )}
        {(!gameA && gameB) && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-5 py-4 text-sm text-indigo-700 dark:text-indigo-300 text-center">
            {t('pickFirst')}
          </div>
        )}

        {/* Scorecard */}
        {both && <Scorecard a={gameA} b={gameB} />}

        {/* Similar but safer */}
        {highRiskGame && (highRiskGame.scores?.ris ?? 0) >= 0.5 && (
          <SuggestionStrip highRiskGame={highRiskGame} />
        )}

      </main>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ComparePageInner />
    </Suspense>
  )
}
