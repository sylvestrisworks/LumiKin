'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import type { GameCardProps, GameSummary } from '@/types/game'
import { esrbToAge, curascoreTextEditorial } from '@/lib/ui'
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
  label, selected, onSelect, onClear, prefilling = false,
}: {
  label: string
  selected: GameCardProps | null
  onSelect: (data: GameCardProps) => void
  onClear: () => void
  prefilling?: boolean
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

  if (prefilling && !selected) {
    return (
      <div className="flex items-center border border-rule px-4 py-3 animate-pulse" aria-busy="true" aria-label={label}>
        <div className="w-10 h-10 rounded-lg bg-rule/40 shrink-0" />
        <div className="ml-3 flex-1 space-y-1.5">
          <div className="h-4 w-3/4 bg-rule/40 rounded" />
          <div className="h-3 w-1/2 bg-rule/40 rounded" />
        </div>
      </div>
    )
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between border border-rule px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {selected.game.backgroundImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.game.backgroundImage} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-ink truncate">{selected.game.title}</p>
            <p className="text-xs text-muted">{selected.game.genres[0] ?? selected.game.developer ?? ''}</p>
          </div>
        </div>
        <button 
          onClick={onClear} 
          className="shrink-0 ml-3 text-xs text-muted hover:text-red-500 dark:hover:text-red-400 transition-colors"
          aria-label={t('change')}
        >
          {t('change')}
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">{label}</p>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full px-4 py-3 text-sm border border-rule bg-paper text-ink
            focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink placeholder:text-muted"
          aria-label={label}
          autoComplete="off"
          maxLength={100}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-paper border border-ink shadow-lg z-50 overflow-hidden">
          {suggestions.map(s => (
            <button
              key={s.slug}
              onClick={() => pick(s.slug)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-ink/[0.03] border-b border-rule/50 last:border-0 text-left"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-rule/30 shrink-0">
                {s.backgroundImage
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={s.backgroundImage} alt="" className="w-full h-full object-cover" />
                  : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-accent">{s.title.slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{s.title}</p>
                {s.genres[0] && <p className="text-xs text-muted">{s.genres[0]}</p>}
              </div>
              {s.esrbRating && (
                <span className="text-xs font-bold border border-rule text-muted px-1.5 py-0.5 rounded shrink-0">{s.esrbRating}</span>
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

  const barColor  = (wins: boolean) => wins && !tie ? 'bg-ivy' : 'bg-rule'
  const valColor  = (wins: boolean) => wins && !tie
    ? 'text-ivy font-semibold'
    : 'text-muted font-semibold'
  const cellBg    = (wins: boolean) => wins && !tie
    ? 'bg-ivy/[0.06]'
    : ''

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 border-b border-rule/50 last:border-0">
      {/* Game A */}
      <div className={`flex items-center gap-2 justify-end px-3 py-2.5 rounded-l-lg ${cellBg(aWins)}`}>
        <span className={`text-sm tabular-nums ${valColor(aWins)}`}>
          {a !== null ? fmt(a) : '—'}
        </span>
        <div className="w-16 sm:w-20 bg-rule/30 h-2 overflow-hidden">
          <div className={`h-full transition-all ${barColor(aWins)}`}
            style={{ width: a !== null ? `${Math.round(aNum * 100)}%` : '0%' }} />
        </div>
      </div>

      {/* Label */}
      <div className="text-center px-2 py-2.5 min-w-[100px] sm:min-w-[120px]">
        <span className="text-xs text-muted leading-tight">
          {label}
          {tooltip && <span className="ml-1 text-[10px] text-muted" title={tooltip}>ⓘ</span>}
        </span>
      </div>

      {/* Game B */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-r-lg ${cellBg(bWins)}`}>
        <div className="w-16 sm:w-20 bg-rule/30 h-2 overflow-hidden">
          <div className={`h-full transition-all ${barColor(bWins)}`}
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
      <p className="text-[10px] font-black uppercase tracking-widest text-muted">{label}</p>
    </div>
  )
}

function InfoRow({ label, aText, bText, aGood, bGood }: {
  label: string; aText: string; bText: string; aGood?: boolean; bGood?: boolean
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 border-b border-rule/50 last:border-0">
      <div className={`text-right px-3 py-2.5 rounded-l-lg ${aGood ? 'bg-ivy/[0.06]' : ''}`}>
        <span className={`text-xs px-2 py-0.5 border font-semibold ${
          aGood
            ? 'border-ivy text-ivy'
            : 'border-rule text-muted'
        }`}>{aText}</span>
      </div>
      <div className="text-center px-2 py-2.5 min-w-[100px] sm:min-w-[120px]">
        <span className="text-xs text-muted">{label}</span>
      </div>
      <div className={`text-left px-3 py-2.5 rounded-r-lg ${bGood ? 'bg-ivy/[0.06]' : ''}`}>
        <span className={`text-xs px-2 py-0.5 border font-semibold ${
          bGood
            ? 'border-ivy text-ivy'
            : 'border-rule text-muted'
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
    <div className="border-t border-rule px-4 sm:px-6 py-4 space-y-5">

      {hasSkills && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-3">{t('tagsSkillsHeader')}</p>

          {sharedSkills.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-muted text-center mb-1.5">{t('tagsBothDevelop')}</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {sharedSkills.map(s => <Tag key={s} label={s} color="border border-accent text-accent" />)}
              </div>
            </div>
          )}

          {(uniqueASkills.length > 0 || uniqueBSkills.length > 0) && (
            <>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mb-1">
                <p className="text-[10px] text-muted text-right truncate">{aTitle}</p>
                <div className="min-w-[70px]" />
                <p className="text-[10px] text-muted truncate">{bTitle}</p>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
                <div className="flex flex-wrap gap-1 justify-end">
                  {uniqueASkills.length > 0
                    ? uniqueASkills.map(s => <Tag key={s} label={s} color="border border-ivy text-ivy" />)
                    : <span className="text-[11px] text-rule italic">—</span>}
                </div>
                <div className="text-[10px] text-muted text-center self-center px-1 min-w-[70px]">{t('tagsOnly')}</div>
                <div className="flex flex-wrap gap-1">
                  {uniqueBSkills.length > 0
                    ? uniqueBSkills.map(s => <Tag key={s} label={s} color="border border-ivy text-ivy" />)
                    : <span className="text-[11px] text-rule italic">—</span>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {hasDP && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-3">{t('tagsTacticsHeader')}</p>

          {sharedDP.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-muted text-center mb-1.5">{t('tagsBothUse')}</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {sharedDP.map(p => <Tag key={p} label={DP_KEY[p] ? t(DP_KEY[p] as Parameters<CompareT>[0]) : p} color="border border-accent text-accent" />)}
              </div>
            </div>
          )}

          {(uniqueADP.length > 0 || uniqueBDP.length > 0) && (
            <>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mb-1">
                <p className="text-[10px] text-muted text-right truncate">{aTitle}</p>
                <div className="min-w-[70px]" />
                <p className="text-[10px] text-muted truncate">{bTitle}</p>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
                <div className="flex flex-wrap gap-1 justify-end">
                  {uniqueADP.length > 0
                    ? uniqueADP.map(p => <Tag key={p} label={DP_KEY[p] ? t(DP_KEY[p] as Parameters<CompareT>[0]) : p} color="border border-warm text-warm" />)
                    : <span className="text-[11px] text-rule italic">—</span>}
                </div>
                <div className="text-[10px] text-muted text-center self-center px-1 min-w-[70px]">{t('tagsOnly')}</div>
                <div className="flex flex-wrap gap-1">
                  {uniqueBDP.length > 0
                    ? uniqueBDP.map(p => <Tag key={p} label={DP_KEY[p] ? t(DP_KEY[p] as Parameters<CompareT>[0]) : p} color="border border-warm text-warm" />)
                    : <span className="text-[11px] text-rule italic">—</span>}
                </div>
              </div>
            </>
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

  const timeBg = (c: string | null | undefined) =>
    c === 'green' ? 'border border-ivy text-ivy'
    : c === 'amber' ? 'border border-warm text-warm'
    : c === 'red'   ? 'border border-accent text-accent'
    : 'border border-rule text-muted'

  const timeLabel = (s: typeof aScore) =>
    s?.timeRecommendationMinutes != null
      ? `${s.timeRecommendationMinutes}m`
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

  const verdict = generateVerdict(t, a, b)
  const aMonetTags = monetTags(t, a)
  const bMonetTags = monetTags(t, b)

  return (
    <div className="border border-rule">

      {/* ── Sticky game headers ── */}
      <div className="sticky top-14 z-20 overflow-hidden bg-paper/95 backdrop-blur-sm border-b-2 border-ink">
        <div className="grid grid-cols-[1fr_auto_1fr]">
          {/* Game A */}
          <div className="p-3 sm:p-4 flex items-center gap-2.5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-rule/30 shrink-0">
              {a.game.backgroundImage
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={a.game.backgroundImage} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-xs font-black text-accent">{a.game.title.slice(0,2).toUpperCase()}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-ink truncate leading-tight">{a.game.title}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {aScore?.curascore != null && (
                  <span className={`font-serif text-sm font-semibold tabular-nums ${curascoreTextEditorial(aScore.curascore)}`}>
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
          <div className="flex items-center justify-center px-2 border-x border-rule/50">
            <span className="text-xs font-black text-rule uppercase tracking-widest">vs</span>
          </div>

          {/* Game B */}
          <div className="p-3 sm:p-4 flex items-center gap-2.5 flex-row-reverse sm:flex-row">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-rule/30 shrink-0">
              {b.game.backgroundImage
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={b.game.backgroundImage} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-xs font-black text-accent">{b.game.title.slice(0,2).toUpperCase()}</span>}
            </div>
            <div className="min-w-0 flex-1 sm:text-left text-right">
              <p className="text-xs font-bold text-ink truncate leading-tight">{b.game.title}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap sm:flex-row flex-row-reverse sm:justify-start justify-end">
                {bScore?.curascore != null && (
                  <span className={`font-serif text-sm font-semibold tabular-nums ${curascoreTextEditorial(bScore.curascore)}`}>
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
        <div className="px-5 py-3 border-b border-rule/50">
          <p className="font-serif text-sm text-ink leading-relaxed text-center italic">{verdict}</p>
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
          // Emerald only when "free" actually means free — no monthly costs hidden in microtransactions
          aGood={a.game.basePrice === 0 && aFree}
          bGood={b.game.basePrice === 0 && bFree}
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
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-0 border-b border-rule/50 last:border-0">
            <div className="flex flex-wrap gap-1 justify-end px-3 py-2">
              {aMonetTags.map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-rule text-muted">{tag}</span>
              ))}
            </div>
            <div className="text-center px-2 py-2 min-w-[100px] sm:min-w-[120px] self-center">
              <span className="text-xs text-muted">{t('scMonetTags')}</span>
            </div>
            <div className="flex flex-wrap gap-1 px-3 py-2">
              {bMonetTags.map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-rule text-muted">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Subscription warning */}
        {(a.game.hasSubscription || b.game.hasSubscription) && (
          <div className="grid grid-cols-[1fr_auto_1fr] gap-0 py-2 border-b border-rule/50">
            <div className="text-right px-3">
              {a.game.hasSubscription && (
                <span className="text-[11px] text-warm font-semibold flex items-center gap-1"><Icon name="warning" size={12} aria-hidden="true" />{t('scSubRequired')}</span>
              )}
            </div>
            <div className="min-w-[100px] sm:min-w-[120px]" />
            <div className="px-3">
              {b.game.hasSubscription && (
                <span className="text-[11px] text-warm font-semibold flex items-center gap-1"><Icon name="warning" size={12} aria-hidden="true" />{t('scSubRequired')}</span>
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

      {/* ── Full review links ── */}
      <div className="border-t border-rule px-6 py-3 flex justify-between rounded-b-2xl">
        <Link href={`/${locale}/game/${a.game.slug}`} className="text-kicker uppercase font-semibold text-accent hover:underline" style={{ fontVariantCaps: 'all-small-caps' }}>
          {t('scFullReview', { title: a.game.title.split(' ').slice(0, 3).join(' ') })} →
        </Link>
        <Link href={`/${locale}/game/${b.game.slug}`} className="text-kicker uppercase font-semibold text-accent hover:underline" style={{ fontVariantCaps: 'all-small-caps' }}>
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
    <div className="border border-rule p-5">
      <div className="mb-4">
        <p className="font-serif text-lg text-ink">{t('popularComparisons')}</p>
        <p className="text-xs text-muted mt-0.5">{t('popularComparisonsSub')}</p>
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
              className="group text-left border border-rule px-4 py-3 hover:border-ink hover:bg-ink/[0.03] transition-all disabled:opacity-50"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">
                {t(pair.labelKey as Parameters<CompareT>[0])}
              </p>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-xs text-accent">{t('popularLoadingPair')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-ink truncate">{pair.a.name}</span>
                  <span className="text-[10px] font-black text-rule shrink-0">VS</span>
                  <span className="font-bold text-sm text-ink truncate">{pair.b.name}</span>
                  <span className="ml-auto shrink-0 text-rule group-hover:text-accent transition-colors">→</span>
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
    c === 'green' ? 'border border-ivy text-ivy'
    : c === 'amber' ? 'border border-warm text-warm'
    : 'border border-rule text-muted'

  return (
    <div className="border-l-2 border-ivy pl-5 py-2">
      <h3 className="font-serif text-lg text-ivy mb-1">{t('similarSafer')}</h3>
      <p className="text-sm text-ink/80 mb-4">
        {t('similarSaferSub', { title: highRiskGame.game.title, genre: genre ?? '' })}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {suggestions.map(s => (
          <Link
            key={s.slug}
            href={`/${locale}/game/${s.slug}`}
            className="flex items-center gap-3 border border-rule px-3 py-2.5 hover:border-ink transition-colors"
          >
            <div className="w-10 h-10 overflow-hidden bg-rule/30 shrink-0">
              {s.backgroundImage
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={s.backgroundImage} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-xs font-serif text-muted">{s.title.slice(0,2).toUpperCase()}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{s.title}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {s.esrbRating && <span className="text-xs text-muted">{s.esrbRating}</span>}
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

const isValidSlug = (s: string | null): s is string =>
  s !== null && /^[a-zA-Z0-9_-]+$/.test(s) && s.length <= 200

function ComparePageInner() {
  const t            = useTranslations('compare')
  const tNav         = useTranslations('game')
  const locale       = useLocale()
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [gameA, setGameA] = useState<GameCardProps | null>(null)
  const [gameB, setGameB] = useState<GameCardProps | null>(null)
  // Pre-seed loading state from the URL so the picker shows a skeleton on first paint
  // (rather than flashing an empty input before the fetch resolves).
  const [loadingA, setLoadingA] = useState(() => isValidSlug(searchParams.get('a')))
  const [loadingB, setLoadingB] = useState(() => isValidSlug(searchParams.get('b')))
  const [copied, setCopied] = useState(false)
  const initialised = useRef(false)

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true

    const slugA = searchParams.get('a')
    const slugB = searchParams.get('b')

    if (isValidSlug(slugA)) {
      loadGame(slugA)
        .then(d => { if (d) setGameA(d) })
        .catch(err => { console.error('Failed to load game A:', err) })
        .finally(() => setLoadingA(false))
    }
    if (isValidSlug(slugB)) {
      loadGame(slugB)
        .then(d => { if (d) setGameB(d) })
        .catch(err => { console.error('Failed to load game B:', err) })
        .finally(() => setLoadingB(false))
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

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: tNav('navHome'), item: `${SITE_URL}/${locale}` },
      { '@type': 'ListItem', position: 2, name: t('title'),      item: `${SITE_URL}/${locale}/compare` },
    ],
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') }}
      />
      <main className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-6 space-y-5">

        <nav className="flex items-center gap-1.5 text-kicker uppercase text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
          <Link href={`/${locale}`} className="hover:text-accent transition-colors">
            {tNav('navHome')}
          </Link>
          <span aria-hidden className="text-rule">/</span>
          <span className="text-ink truncate">{t('title')}</span>
        </nav>

        {/* Heading */}
        <header className="border-b border-ink pb-4">
          <h1 className="font-serif text-display-sm sm:text-display tracking-tight text-ink">
            {t('title')}
          </h1>
          <p className="mt-1.5 font-serif italic text-sm text-muted max-w-2xl">
            {t('subtitle')}
          </p>
        </header>

        {/* Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GamePicker label={t('gameA')} selected={gameA} onSelect={selectA} onClear={clearA} prefilling={loadingA} />
          <GamePicker label={t('gameB')} selected={gameB} onSelect={selectB} onClear={clearB} prefilling={loadingB} />
        </div>

        {/* Copy link */}
        {(gameA || gameB) && (
          <div className="flex justify-end">
            <button
              onClick={copyLink}
              className="text-kicker uppercase font-semibold text-muted hover:text-accent border border-rule hover:border-ink px-3 py-1.5 transition-colors flex items-center gap-1.5"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {copied ? `✓ ${t('linkCopied')}` : `🔗 ${t('copyLink')}`}
            </button>
          </div>
        )}

        {/* Empty state / popular pairs */}
        {!gameA && !gameB && (
          <PopularComparisons onSelectPair={selectPair} />
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
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ComparePageInner />
    </Suspense>
  )
}
