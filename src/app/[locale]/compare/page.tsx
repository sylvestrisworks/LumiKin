'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import type { GameCardProps, GameSummary } from '@/types/game'
import { esrbToAge, ageBadgeColor } from '@/lib/ui'

// ─── Dark pattern labels ──────────────────────────────────────────────────────

const DP_LABELS: Record<string, string> = {
  DP01: 'Gateway Purchase', DP02: 'Confirm-Shaming',   DP03: 'False Scarcity',
  DP04: 'Currency Obfuscation', DP05: 'Parasocial Prompts', DP06: 'Streak Punishment',
  DP07: 'Artificial Energy', DP08: 'Social Obligation', DP09: 'Loot Box / Gacha',
  DP10: 'Pay-to-Skip',      DP11: 'Notification Spam', DP12: 'FOMO Events',
}

// ─── Verdict generator ────────────────────────────────────────────────────────

function generateVerdict(a: GameCardProps, b: GameCardProps): string | null {
  const aS = a.scores; const bS = b.scores
  if (!aS || !bS) return null

  const aCura = aS.curascore ?? 0; const bCura = bS.curascore ?? 0
  const gap     = Math.abs(aCura - bCura)
  const aTime   = aS.timeRecommendationMinutes ?? 0
  const bTime   = bS.timeRecommendationMinutes ?? 0
  const timeDiff = Math.abs(aTime - bTime)

  // Use just the first word of each title to keep the sentence short
  const aName = a.game.title.split(/[\s:—–]/)[0]
  const bName = b.game.title.split(/[\s:—–]/)[0]

  const betterName = aCura >= bCura ? aName : bName
  const higherRis  = (aS.ris ?? 0) >= (bS.ris ?? 0) ? aName : bName

  const monetDiff  = Math.abs((aS.monetizationRisk ?? 0) - (bS.monetizationRisk ?? 0))
  const dopDiff    = Math.abs((aS.dopamineRisk    ?? 0) - (bS.dopamineRisk    ?? 0))
  const socialDiff = Math.abs((aS.socialRisk      ?? 0) - (bS.socialRisk      ?? 0))
  const maxRiskDiff = Math.max(monetDiff, dopDiff, socialDiff)

  let riskLabel = 'overall risk'
  if (maxRiskDiff > 0.15) {
    if (maxRiskDiff === monetDiff)  riskLabel = 'monetization pressure'
    else if (maxRiskDiff === dopDiff) riskLabel = 'addictive design'
    else                              riskLabel = 'social risk'
  }

  if (gap < 5) {
    return `${aName} and ${bName} score similarly overall — the choice comes down to which fits your child's interests and routine best.`
  }

  let s = `${betterName} scores ${gap} points higher`
  if (timeDiff >= 30) s += ` and earns ${timeDiff} more minutes of daily playtime`
  s += '.'
  if (maxRiskDiff > 0.15) s += ` ${higherRis} carries notably higher ${riskLabel}.`
  return s
}

// ─── Monetization tag builder ────────────────────────────────────────────────

function monetTags(g: GameCardProps): string[] {
  const tags: string[] = []
  if (g.game.hasLootBoxes)        tags.push('Loot Boxes')
  if (g.game.hasBattlePass)       tags.push('Battle Pass')
  if (g.game.hasSubscription)     tags.push('Subscription')
  if (g.review?.payToWin != null && g.review.payToWin >= 2) tags.push('Pay-to-Win')
  if (g.game.hasMicrotransactions && tags.length === 0)     tags.push('Microtransactions')
  if (tags.length === 0 && g.game.basePrice != null && g.game.basePrice > 0) tags.push('One-time Purchase')
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
  const debounce                      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t                             = useTranslations('compare')

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (query.length < 2) { setSuggestions([]); setOpen(false); return }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data: GameSummary[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      } finally { setLoading(false) }
    }, 250)
  }, [query])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function pick(slug: string) {
    setOpen(false); setQuery(''); setLoading(true)
    try {
      const res  = await fetch(`/api/game/${slug}`)
      const text = await res.text()
      if (!res.ok || !text) {
        console.error(`[compare/pick] ${res.status} for ${slug}:`, text)
        return
      }
      const data: GameCardProps = JSON.parse(text)
      onSelect(data)
    } finally { setLoading(false) }
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {selected.game.backgroundImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.game.backgroundImage} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{selected.game.title}</p>
            <p className="text-xs text-slate-500">{selected.game.genres[0] ?? selected.game.developer ?? ''}</p>
          </div>
        </div>
        <button onClick={onClear} className="shrink-0 ml-3 text-xs text-slate-400 hover:text-red-500 transition-colors">
          {t('change')}
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</p>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 bg-white shadow-sm
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {suggestions.map(s => (
            <button
              key={s.slug}
              onClick={() => pick(s.slug)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-indigo-100 shrink-0">
                {s.backgroundImage
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={s.backgroundImage} alt="" className="w-full h-full object-cover" />
                  : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-indigo-600">{s.title.slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{s.title}</p>
                {s.genres[0] && <p className="text-xs text-slate-500">{s.genres[0]}</p>}
              </div>
              {s.esrbRating && (
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">{s.esrbRating}</span>
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

  const barColor  = (wins: boolean) => wins && !tie ? 'bg-emerald-400' : 'bg-slate-300'
  const valColor  = (wins: boolean) => wins && !tie ? 'text-emerald-700 font-black' : 'text-slate-500 font-semibold'
  const cellBg    = (wins: boolean) => wins && !tie ? 'bg-emerald-50' : ''

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 border-b border-slate-100 last:border-0">
      {/* Game A */}
      <div className={`flex items-center gap-2 justify-end px-3 py-2.5 rounded-l-lg ${cellBg(aWins)}`}>
        <span className={`text-sm tabular-nums ${valColor(aWins)}`}>
          {a !== null ? fmt(a) : '—'}
        </span>
        <div className="w-16 sm:w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor(aWins)}`}
            style={{ width: a !== null ? `${Math.round(aNum * 100)}%` : '0%' }} />
        </div>
      </div>

      {/* Label */}
      <div className="text-center px-2 py-2.5 min-w-[100px] sm:min-w-[120px]">
        <span className="text-xs text-slate-500 leading-tight">
          {label}
          {tooltip && <span className="ml-1 text-[10px] text-slate-400" title={tooltip}>ⓘ</span>}
        </span>
      </div>

      {/* Game B */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-r-lg ${cellBg(bWins)}`}>
        <div className="w-16 sm:w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
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
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    </div>
  )
}

function InfoRow({ label, aText, bText, aGood, bGood }: {
  label: string; aText: string; bText: string; aGood?: boolean; bGood?: boolean
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 border-b border-slate-100 last:border-0">
      <div className={`text-right px-3 py-2.5 rounded-l-lg ${aGood ? 'bg-emerald-50' : ''}`}>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          aGood ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}>{aText}</span>
      </div>
      <div className="text-center px-2 py-2.5 min-w-[100px] sm:min-w-[120px]">
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className={`text-left px-3 py-2.5 rounded-r-lg ${bGood ? 'bg-emerald-50' : ''}`}>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          bGood ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
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
    <div className="border-t border-slate-100 px-4 sm:px-6 py-4 space-y-5">

      {hasSkills && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">{t('tagsSkillsHeader')}</p>

          {sharedSkills.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-slate-400 text-center mb-1.5">{t('tagsBothDevelop')}</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {sharedSkills.map(s => <Tag key={s} label={s} color="bg-indigo-100 text-indigo-700" />)}
              </div>
            </div>
          )}

          {(uniqueASkills.length > 0 || uniqueBSkills.length > 0) && (
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
              <div className="flex flex-wrap gap-1 justify-end">
                {uniqueASkills.length > 0
                  ? uniqueASkills.map(s => <Tag key={s} label={s} color="bg-emerald-100 text-emerald-700" />)
                  : <span className="text-[11px] text-slate-300 italic">—</span>}
              </div>
              <div className="text-[10px] text-slate-400 text-center self-center px-1 min-w-[70px]">{t('tagsOnly')}</div>
              <div className="flex flex-wrap gap-1">
                {uniqueBSkills.length > 0
                  ? uniqueBSkills.map(s => <Tag key={s} label={s} color="bg-emerald-100 text-emerald-700" />)
                  : <span className="text-[11px] text-slate-300 italic">—</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {hasDP && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">{t('tagsTacticsHeader')}</p>

          {sharedDP.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-slate-400 text-center mb-1.5">{t('tagsBothUse')}</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {sharedDP.map(p => <Tag key={p} label={DP_LABELS[p] ?? p} color="bg-red-100 text-red-700" />)}
              </div>
            </div>
          )}

          {(uniqueADP.length > 0 || uniqueBDP.length > 0) && (
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
              <div className="flex flex-wrap gap-1 justify-end">
                {uniqueADP.length > 0
                  ? uniqueADP.map(p => <Tag key={p} label={DP_LABELS[p] ?? p} color="bg-amber-100 text-amber-700" />)
                  : <span className="text-[11px] text-slate-300 italic">—</span>}
              </div>
              <div className="text-[10px] text-slate-400 text-center self-center px-1 min-w-[70px]">{t('tagsOnly')}</div>
              <div className="flex flex-wrap gap-1">
                {uniqueBDP.length > 0
                  ? uniqueBDP.map(p => <Tag key={p} label={DP_LABELS[p] ?? p} color="bg-amber-100 text-amber-700" />)
                  : <span className="text-[11px] text-slate-300 italic">—</span>}
              </div>
            </div>
          )}

          {/* Column labels under tactics */}
          {(uniqueADP.length > 0 || uniqueBDP.length > 0) && (
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mt-1">
              <p className="text-[10px] text-slate-400 text-right truncate">{aTitle}</p>
              <div className="min-w-[70px]" />
              <p className="text-[10px] text-slate-400 truncate">{bTitle}</p>
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
    if (s == null) return 'bg-slate-200 text-slate-500'
    if (s >= 70) return 'bg-emerald-500 text-white'
    if (s >= 40) return 'bg-amber-400 text-white'
    return 'bg-red-500 text-white'
  }

  const timeBg = (c: string | null | undefined) =>
    c === 'green' ? 'bg-emerald-500 text-white'
    : c === 'amber' ? 'bg-amber-400 text-white'
    : c === 'red'   ? 'bg-red-500 text-white'
    : 'bg-slate-200 text-slate-500'

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

  const verdict = generateVerdict(a, b)
  const aMonetTags = monetTags(a)
  const bMonetTags = monetTags(b)

  return (
    // No overflow-hidden on card so sticky header works
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">

      {/* ── Sticky game headers ── */}
      <div className="sticky top-14 z-20 rounded-t-2xl overflow-hidden bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="grid grid-cols-[1fr_auto_1fr]">
          {/* Game A */}
          <div className="p-3 sm:p-4 flex items-center gap-2.5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-indigo-100 shrink-0">
              {a.game.backgroundImage
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={a.game.backgroundImage} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-xs font-black text-indigo-500">{a.game.title.slice(0,2).toUpperCase()}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate leading-tight">{a.game.title}</p>
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
          <div className="flex items-center justify-center px-2 border-x border-slate-100">
            <span className="text-xs font-black text-slate-300 uppercase tracking-widest">vs</span>
          </div>

          {/* Game B */}
          <div className="p-3 sm:p-4 flex items-center gap-2.5 flex-row-reverse sm:flex-row">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-indigo-100 shrink-0">
              {b.game.backgroundImage
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={b.game.backgroundImage} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-xs font-black text-indigo-500">{b.game.title.slice(0,2).toUpperCase()}</span>}
            </div>
            <div className="min-w-0 flex-1 sm:text-left text-right">
              <p className="text-xs font-bold text-slate-800 truncate leading-tight">{b.game.title}</p>
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
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <p className="text-xs text-slate-600 leading-relaxed text-center italic">{verdict}</p>
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
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-0 border-b border-slate-100 last:border-0">
            <div className="flex flex-wrap gap-1 justify-end px-3 py-2">
              {aMonetTags.map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{tag}</span>
              ))}
            </div>
            <div className="text-center px-2 py-2 min-w-[100px] sm:min-w-[120px] self-center">
              <span className="text-xs text-slate-500">{t('scMonetTags')}</span>
            </div>
            <div className="flex flex-wrap gap-1 px-3 py-2">
              {bMonetTags.map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Subscription warning */}
        {(a.game.hasSubscription || b.game.hasSubscription) && (
          <div className="grid grid-cols-[1fr_auto_1fr] gap-0 py-2 border-b border-slate-100">
            <div className="text-right px-3">
              {a.game.hasSubscription && (
                <span className="text-[11px] text-amber-700 font-semibold">⚠️ {t('scSubRequired')}</span>
              )}
            </div>
            <div className="min-w-[100px] sm:min-w-[120px]" />
            <div className="px-3">
              {b.game.hasSubscription && (
                <span className="text-[11px] text-amber-700 font-semibold">⚠️ {t('scSubRequired')}</span>
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
        <div className="border-t border-slate-100 bg-emerald-50 px-6 py-4 flex items-center gap-3">
          <span className="text-emerald-600 text-lg">✓</span>
          <p className="text-sm text-emerald-800">
            <span className="font-bold">{winner}</span>
            {' '}{t('scVerdictSub')}
          </p>
        </div>
      )}

      {/* ── Full review links ── */}
      <div className="border-t border-slate-100 px-6 py-3 flex justify-between rounded-b-2xl">
        <Link href={`/${locale}/game/${a.game.slug}`} className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium">
          {t('scFullReview', { title: a.game.title.split(' ').slice(0, 3).join(' ') })} →
        </Link>
        <Link href={`/${locale}/game/${b.game.slug}`} className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium">
          {t('scFullReview', { title: b.game.title.split(' ').slice(0, 3).join(' ') })} →
        </Link>
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
    const maxRis = Math.max(ris - 0.2, 0.1)
    fetch(`/api/suggest?genre=${encodeURIComponent(genre)}&maxRis=${maxRis}&excludeSlug=${highRiskGame.game.slug}`)
      .then(r => r.json()).then(setSuggestions).catch(() => {})
  }, [genre, ris, highRiskGame.game.slug])

  if (ris < 0.5 || suggestions.length === 0) return null

  const timeBg = (c: 'green' | 'amber' | 'red' | null) =>
    c === 'green' ? 'bg-emerald-100 text-emerald-700' : c === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
      <h3 className="font-semibold text-emerald-800 mb-1">{t('similarSafer')}</h3>
      <p className="text-sm text-emerald-700 mb-4">
        {t('similarSaferSub', { title: highRiskGame.game.title, genre: genre ?? '' })}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {suggestions.map(s => (
          <Link
            key={s.slug}
            href={`/${locale}/game/${s.slug}`}
            className="flex items-center gap-3 bg-white rounded-xl border border-emerald-200 px-3 py-2.5 hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-emerald-100 shrink-0">
              {s.backgroundImage
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={s.backgroundImage} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-emerald-600">{s.title.slice(0,2).toUpperCase()}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{s.title}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {s.esrbRating && <span className="text-xs text-slate-500">{s.esrbRating}</span>}
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
  try {
    const res  = await fetch(`/api/game/${slug}`)
    if (!res.ok) return null
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text)
  } catch { return null }
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
    if (slugA) loadGame(slugA).then(d => d && setGameA(d))
    if (slugB) loadGame(slugB).then(d => d && setGameB(d))
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

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const both         = gameA !== null && gameB !== null
  const highRiskGame = both
    ? ((gameA.scores?.ris ?? 0) >= (gameB.scores?.ris ?? 0) ? gameA : gameB)
    : null

  return (
    <div className="min-h-screen bg-slate-50">
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
              className="text-xs font-semibold text-slate-500 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
            >
              {copied ? `✓ ${t('linkCopied')}` : `🔗 ${t('copyLink')}`}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!gameA && !gameB && (
          <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
            <p className="text-5xl mb-3">⚖️</p>
            <p className="font-semibold text-slate-600">{t('emptyTitle')}</p>
            <p className="text-sm mt-1">{t('emptySub')}</p>
          </div>
        )}

        {/* Single game */}
        {(gameA && !gameB) && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 text-sm text-indigo-700 text-center">
            {t('pickSecond')}
          </div>
        )}
        {(!gameA && gameB) && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 text-sm text-indigo-700 text-center">
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ComparePageInner />
    </Suspense>
  )
}
