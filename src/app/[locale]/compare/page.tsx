'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import type { GameCardProps, GameSummary } from '@/types/game'
import { esrbToAge, ageBadgeColor } from '@/lib/ui'

// ─── Game picker ──────────────────────────────────────────────────────────────

function GamePicker({
  label,
  selected,
  onSelect,
  onClear,
}: {
  label: string
  selected: GameCardProps | null
  onSelect: (data: GameCardProps) => void
  onClear: () => void
}) {
  const [query, setQuery]           = useState('')
  const [suggestions, setSuggestions] = useState<GameSummary[]>([])
  const [loading, setLoading]       = useState(false)
  const [open, setOpen]             = useState(false)
  const ref                         = useRef<HTMLDivElement>(null)
  const debounce                    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t                           = useTranslations('compare')

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
      const res = await fetch(`/api/game/${slug}`)
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

// ─── Scorecard ────────────────────────────────────────────────────────────────

type ScoreRowProps = {
  label: string
  tooltip?: string
  aVal: number | null      // 0–1
  bVal: number | null      // 0–1
  higherIsBetter: boolean
  format?: (v: number) => string
}

function ScoreRow({ label, tooltip, aVal, bVal, higherIsBetter, format }: ScoreRowProps) {
  const a = aVal ?? null
  const b = bVal ?? null
  if (a === null && b === null) return null

  const aNum = a ?? 0
  const bNum = b ?? 0
  const aWins = higherIsBetter ? aNum > bNum : aNum < bNum
  const bWins = higherIsBetter ? bNum > aNum : bNum < aNum
  const tie   = Math.abs(aNum - bNum) < 0.03

  const fmt = format ?? ((v: number) => String(Math.round(v * 100)))

  const barColor = (wins: boolean) =>
    wins && !tie ? 'bg-emerald-400' : 'bg-slate-300'

  const valColor = (wins: boolean) =>
    wins && !tie ? 'text-emerald-700 font-black' : 'text-slate-500 font-semibold'

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 border-b border-slate-100 last:border-0">
      {/* Game A */}
      <div className="flex items-center gap-2 justify-end">
        <span className={`text-sm tabular-nums ${valColor(aWins)}`}>
          {a !== null ? fmt(a) : '—'}
        </span>
        <div className="w-16 sm:w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor(aWins)}`}
            style={{ width: a !== null ? `${Math.round(aNum * 100)}%` : '0%' }}
          />
        </div>
      </div>

      {/* Label */}
      <div className="text-center px-2 min-w-[100px] sm:min-w-[120px]">
        <span className="text-xs text-slate-500 leading-tight">
          {label}
          {tooltip && (
            <span className="ml-1 text-[10px] text-slate-400" title={tooltip}>ⓘ</span>
          )}
        </span>
      </div>

      {/* Game B */}
      <div className="flex items-center gap-2">
        <div className="w-16 sm:w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor(bWins)}`}
            style={{ width: b !== null ? `${Math.round(bNum * 100)}%` : '0%' }}
          />
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
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 border-b border-slate-100 last:border-0">
      <div className="text-right">
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          aGood ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}>{aText}</span>
      </div>
      <div className="text-center px-2 min-w-[100px] sm:min-w-[120px]">
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="text-left">
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          bGood ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}>{bText}</span>
      </div>
    </div>
  )
}

function Scorecard({ a, b }: { a: GameCardProps; b: GameCardProps }) {
  const t = useTranslations('compare')

  const aScore = a.scores
  const bScore = b.scores

  // Curascore colours
  const curaBg = (s: number | null) => {
    if (s == null) return 'bg-slate-200 text-slate-500'
    if (s >= 70) return 'bg-emerald-500 text-white'
    if (s >= 40) return 'bg-amber-400 text-white'
    return 'bg-red-500 text-white'
  }

  const timeBg = (c: string | null | undefined) =>
    c === 'green' ? 'bg-emerald-500 text-white' : c === 'amber' ? 'bg-amber-400 text-white' : c === 'red' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'

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

  // Verdict
  const aCura = aScore?.curascore ?? 0
  const bCura = bScore?.curascore ?? 0
  const gap   = Math.abs(aCura - bCura)
  const winner = gap >= 5 ? (aCura > bCura ? a.game.title : b.game.title) : null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* ── Game headers ── */}
      <div className="grid grid-cols-[1fr_auto_1fr] border-b border-slate-100">
        {/* Game A header */}
        <div className="p-4 sm:p-5 flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-indigo-100 shrink-0">
            {a.game.backgroundImage
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={a.game.backgroundImage} alt="" className="w-full h-full object-cover" />
              : <span className="w-full h-full flex items-center justify-center text-sm font-black text-indigo-500">{a.game.title.slice(0,2).toUpperCase()}</span>}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight line-clamp-2">{a.game.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{a.game.developer ?? a.game.genres[0] ?? ''}</p>
          </div>
          {aScore?.curascore != null && (
            <span className={`text-lg font-black px-3 py-1 rounded-full ${curaBg(aScore.curascore)}`}>
              {aScore.curascore}
            </span>
          )}
        </div>

        {/* VS divider */}
        <div className="flex items-center justify-center px-2 border-x border-slate-100">
          <span className="text-xs font-black text-slate-300 uppercase tracking-widest rotate-0">vs</span>
        </div>

        {/* Game B header */}
        <div className="p-4 sm:p-5 flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-indigo-100 shrink-0">
            {b.game.backgroundImage
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={b.game.backgroundImage} alt="" className="w-full h-full object-cover" />
              : <span className="w-full h-full flex items-center justify-center text-sm font-black text-indigo-500">{b.game.title.slice(0,2).toUpperCase()}</span>}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight line-clamp-2">{b.game.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{b.game.developer ?? b.game.genres[0] ?? ''}</p>
          </div>
          {bScore?.curascore != null && (
            <span className={`text-lg font-black px-3 py-1 rounded-full ${curaBg(bScore.curascore)}`}>
              {bScore.curascore}
            </span>
          )}
        </div>
      </div>

      {/* ── Scorecard rows ── */}
      <div className="px-4 sm:px-6 pb-4">

        {/* Daily limit */}
        <SectionHeader label={t('scTimeLimitHeader')} />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 border-b border-slate-100">
          <div className="flex justify-end">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${timeBg(aScore?.timeRecommendationColor)}`}>
              {aScore?.timeRecommendationMinutes != null ? `${aScore.timeRecommendationMinutes >= 120 ? '120+' : aScore.timeRecommendationMinutes} min` : '—'}
            </span>
          </div>
          <div className="text-center px-2 min-w-[100px] sm:min-w-[120px]">
            <span className="text-xs text-slate-500">{t('scTimeLimit')}</span>
          </div>
          <div className="flex justify-start">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${timeBg(bScore?.timeRecommendationColor)}`}>
              {bScore?.timeRecommendationMinutes != null ? `${bScore.timeRecommendationMinutes >= 120 ? '120+' : bScore.timeRecommendationMinutes} min` : '—'}
            </span>
          </div>
        </div>

        {/* Benefits */}
        <SectionHeader label={t('scBenefitsHeader')} />
        <ScoreRow label={t('scGrowthScore')}      aVal={aScore?.bds                 ?? null} bVal={bScore?.bds                 ?? null} higherIsBetter={true}  tooltip={t('scGrowthTip')} />
        <ScoreRow label={t('scCognitive')}         aVal={aScore?.cognitiveScore       ?? null} bVal={bScore?.cognitiveScore       ?? null} higherIsBetter={true}  />
        <ScoreRow label={t('scSocial')}            aVal={aScore?.socialEmotionalScore ?? null} bVal={bScore?.socialEmotionalScore ?? null} higherIsBetter={true}  />
        <ScoreRow label={t('scMotor')}             aVal={aScore?.motorScore           ?? null} bVal={bScore?.motorScore           ?? null} higherIsBetter={true}  />

        {/* Risks */}
        <SectionHeader label={t('scRisksHeader')} />
        <ScoreRow label={t('scRiskLevel')}         aVal={aScore?.ris                  ?? null} bVal={bScore?.ris                  ?? null} higherIsBetter={false} tooltip={t('scRiskTip')} />
        <ScoreRow label={t('scDopamine')}          aVal={aScore?.dopamineRisk         ?? null} bVal={bScore?.dopamineRisk         ?? null} higherIsBetter={false} />
        <ScoreRow label={t('scMonetization')}      aVal={aScore?.monetizationRisk     ?? null} bVal={bScore?.monetizationRisk     ?? null} higherIsBetter={false} />
        <ScoreRow label={t('scSocialRisk')}        aVal={aScore?.socialRisk           ?? null} bVal={bScore?.socialRisk           ?? null} higherIsBetter={false} />

        {/* Practical */}
        <SectionHeader label={t('scPracticalHeader')} />

        <InfoRow
          label={t('scAgeRating')}
          aText={a.game.esrbRating ? `${esrbToAge(a.game.esrbRating)}+` : '—'}
          bText={b.game.esrbRating ? `${esrbToAge(b.game.esrbRating)}+` : '—'}
        />

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

      {/* ── Verdict ── */}
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
      <div className="border-t border-slate-100 px-6 py-3 flex justify-between">
        <Link href={`/game/${a.game.slug}`} className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium">
          {t('scFullReview', { title: a.game.title.split(' ').slice(0, 3).join(' ') })} →
        </Link>
        <Link href={`/game/${b.game.slug}`} className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium">
          {t('scFullReview', { title: b.game.title.split(' ').slice(0, 3).join(' ') })} →
        </Link>
      </div>
    </div>
  )
}

// ─── Suggestion strip ─────────────────────────────────────────────────────────

function SuggestionStrip({ highRiskGame }: { highRiskGame: GameCardProps }) {
  const t = useTranslations('compare')
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
            href={`/game/${s.slug}`}
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

// ─── Main compare page ────────────────────────────────────────────────────────

async function loadGame(slug: string): Promise<GameCardProps | null> {
  try {
    const res = await fetch(`/api/game/${slug}`)
    if (!res.ok) return null
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text)
  } catch { return null }
}

function ComparePageInner() {
  const t          = useTranslations('compare')
  const router     = useRouter()
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
    router.replace(qs ? `/compare?${qs}` : '/compare', { scroll: false })
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

  const both        = gameA !== null && gameB !== null
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

        {/* Single game — waiting for second */}
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
