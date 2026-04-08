'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import GameCard from '@/components/GameCard'
import type { GameCardProps, GameSummary } from '@/types/game'

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
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (query.length < 2) { setSuggestions([]); setOpen(false); return }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data: GameSummary[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      } finally {
        setLoading(false)
      }
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
    setOpen(false)
    setQuery('')
    setLoading(true)
    try {
      const res = await fetch(`/api/game/${slug}`)
      const data: GameCardProps = await res.json()
      onSelect(data)
    } finally {
      setLoading(false)
    }
  }

  const t = useTranslations('compare')

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
                {s.backgroundImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.backgroundImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-xs font-bold text-indigo-600">
                    {s.title.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{s.title}</p>
                {s.genres[0] && <p className="text-xs text-slate-500">{s.genres[0]}</p>}
              </div>
              {s.esrbRating && (
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                  {s.esrbRating}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Difference highlight bar ─────────────────────────────────────────────────

type DiffItem = {
  label: string
  aVal: number | null
  bVal: number | null
  aTitle: string
  bTitle: string
  higherIsBetter: boolean
}

function DifferenceBar({ item }: { item: DiffItem }) {
  const a = item.aVal ?? 0
  const b = item.bVal ?? 0
  const diff = Math.abs(a - b)
  if (diff < 0.1) return null // not significant

  const aWins = item.higherIsBetter ? a > b : a < b
  const winner = aWins ? item.aTitle : item.bTitle

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="w-36 text-xs text-slate-600 shrink-0">{item.label}</div>
      <div className="flex-1 flex items-center gap-2">
        {/* A bar */}
        <div className="flex-1 flex items-center gap-1">
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${aWins ? 'bg-emerald-500' : 'bg-slate-400'}`}
              style={{ width: `${Math.round(a * 100)}%` }}
            />
          </div>
          <span className={`text-xs font-bold w-8 text-right shrink-0 ${aWins ? 'text-emerald-700' : 'text-slate-500'}`}>
            {Math.round(a * 100)}
          </span>
        </div>
        {/* vs */}
        <span className="text-xs text-slate-400 shrink-0">vs</span>
        {/* B bar */}
        <div className="flex-1 flex items-center gap-1">
          <span className={`text-xs font-bold w-8 shrink-0 ${!aWins ? 'text-emerald-700' : 'text-slate-500'}`}>
            {Math.round(b * 100)}
          </span>
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${!aWins ? 'bg-emerald-500' : 'bg-slate-400'}`}
              style={{ width: `${Math.round(b * 100)}%` }}
            />
          </div>
        </div>
      </div>
      {/* Winner badge */}
      <div className="w-24 text-right shrink-0">
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full truncate block">
          {winner.split(' ').slice(0, 2).join(' ')} ↑
        </span>
      </div>
    </div>
  )
}

// ─── Suggestions strip ────────────────────────────────────────────────────────

function SuggestionStrip({ highRiskGame }: { highRiskGame: GameCardProps }) {
  const t = useTranslations('compare')
  const [suggestions, setSuggestions] = useState<GameSummary[]>([])
  const genre = highRiskGame.game.genres[0]
  const ris = highRiskGame.scores?.ris ?? 0

  useEffect(() => {
    if (!genre || ris < 0.5) return
    const maxRis = Math.max(ris - 0.2, 0.1)
    fetch(`/api/suggest?genre=${encodeURIComponent(genre)}&maxRis=${maxRis}&excludeSlug=${highRiskGame.game.slug}`)
      .then(r => r.json())
      .then(setSuggestions)
      .catch(() => {})
  }, [genre, ris, highRiskGame.game.slug])

  if (ris < 0.5 || suggestions.length === 0) return null

  const timeColor = (c: 'green' | 'amber' | 'red' | null) =>
    c === 'green' ? 'bg-emerald-100 text-emerald-700' : c === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'

  return (
    <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
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
              {s.backgroundImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.backgroundImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-xs font-bold text-emerald-600">
                  {s.title.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{s.title}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {s.esrbRating && (
                  <span className="text-xs text-slate-500">{s.esrbRating}</span>
                )}
                {s.timeRecommendationMinutes && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${timeColor(s.timeRecommendationColor)}`}>
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
    return await res.json()
  } catch {
    return null
  }
}

function ComparePageInner() {
  const t = useTranslations('compare')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [gameA, setGameA] = useState<GameCardProps | null>(null)
  const [gameB, setGameB] = useState<GameCardProps | null>(null)
  const [mobileTab, setMobileTab] = useState<'A' | 'B'>('A')
  const [copied, setCopied] = useState(false)
  const initialised = useRef(false)

  // Load games from URL on first render
  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    const slugA = searchParams.get('a')
    const slugB = searchParams.get('b')
    if (slugA) loadGame(slugA).then(d => d && setGameA(d))
    if (slugB) loadGame(slugB).then(d => d && setGameB(d))
  }, [searchParams])

  // Sync URL whenever selections change
  const syncUrl = useCallback((a: GameCardProps | null, b: GameCardProps | null) => {
    const params = new URLSearchParams()
    if (a) params.set('a', a.game.slug)
    if (b) params.set('b', b.game.slug)
    const qs = params.toString()
    router.replace(qs ? `/compare?${qs}` : '/compare', { scroll: false })
  }, [router])

  function selectA(data: GameCardProps) { setGameA(data); syncUrl(data, gameB) }
  function selectB(data: GameCardProps) { setGameB(data); syncUrl(gameA, data) }
  function clearA() { setGameA(null); syncUrl(null, gameB) }
  function clearB() { setGameB(null); syncUrl(gameA, null) }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const both = gameA !== null && gameB !== null
  const highRiskGame = both
    ? ((gameA.scores?.ris ?? 0) >= (gameB.scores?.ris ?? 0) ? gameA : gameB)
    : null

  // Build diff items
  const diffs: DiffItem[] = both
    ? [
        { label: t('benefitScore'),  aVal: gameA.scores?.bds             ?? null, bVal: gameB.scores?.bds             ?? null, aTitle: gameA.game.title, bTitle: gameB.game.title, higherIsBetter: true  },
        { label: t('riskScore'),     aVal: gameA.scores?.ris             ?? null, bVal: gameB.scores?.ris             ?? null, aTitle: gameA.game.title, bTitle: gameB.game.title, higherIsBetter: false },
        { label: t('cognitive'),     aVal: gameA.scores?.cognitiveScore  ?? null, bVal: gameB.scores?.cognitiveScore  ?? null, aTitle: gameA.game.title, bTitle: gameB.game.title, higherIsBetter: true  },
        { label: t('social'),        aVal: gameA.scores?.socialEmotionalScore ?? null, bVal: gameB.scores?.socialEmotionalScore ?? null, aTitle: gameA.game.title, bTitle: gameB.game.title, higherIsBetter: true },
        { label: t('dopamineRisk'),  aVal: gameA.scores?.dopamineRisk    ?? null, bVal: gameB.scores?.dopamineRisk    ?? null, aTitle: gameA.game.title, bTitle: gameB.game.title, higherIsBetter: false },
        { label: t('monetization'),  aVal: gameA.scores?.monetizationRisk ?? null, bVal: gameB.scores?.monetizationRisk ?? null, aTitle: gameA.game.title, bTitle: gameB.game.title, higherIsBetter: false },
      ].filter(d => d.aVal != null || d.bVal != null)
    : []

  const significantDiffs = diffs.filter(d => Math.abs((d.aVal ?? 0) - (d.bVal ?? 0)) >= 0.1)

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

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

        {/* Difference highlights */}
        {both && significantDiffs.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-slate-800 mb-1">{t('keyDifferences')}</h2>
            <p className="text-sm text-slate-500 mb-4">
              {t('keyDifferencesSub')}
            </p>
            <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <span className="truncate max-w-[35%]">{gameA.game.title}</span>
              <span className="shrink-0 mx-2">vs</span>
              <span className="truncate max-w-[35%] text-right">{gameB.game.title}</span>
            </div>
            {significantDiffs.map(d => <DifferenceBar key={d.label} item={d} />)}

            {/* Time recommendation comparison */}
            {(gameA.scores?.timeRecommendationMinutes != null || gameB.scores?.timeRecommendationMinutes != null) && (
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                {[gameA, gameB].map((g, i) => {
                  const color = g.scores?.timeRecommendationColor
                  const bg = color === 'green' ? 'bg-emerald-600' : color === 'amber' ? 'bg-amber-500' : color === 'red' ? 'bg-red-600' : 'bg-slate-400'
                  return (
                    <div key={i} className={`${bg} text-white rounded-xl px-4 py-3 text-center`}>
                      <p className="text-2xl font-black">
                        {g.scores?.timeRecommendationMinutes != null
                          ? `${g.scores.timeRecommendationMinutes}m`
                          : '—'}
                      </p>
                      <p className="text-xs opacity-80 mt-0.5 truncate">{g.game.title}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* No meaningful differences */}
        {both && significantDiffs.length === 0 && gameA.scores && gameB.scores && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 text-sm text-blue-800">
            {t('similarScores')}
          </div>
        )}

        {/* Side-by-side cards */}
        {both && (
          <>
            {/* Mobile tab toggle */}
            <div className="sm:hidden flex border border-slate-200 rounded-xl overflow-hidden bg-white">
              {(['A', 'B'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMobileTab(tab)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                    mobileTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tab === 'A' ? gameA.game.title.split(' ').slice(0, 3).join(' ') : gameB.game.title.split(' ').slice(0, 3).join(' ')}
                </button>
              ))}
            </div>

            {/* Desktop: side by side / Mobile: one at a time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={mobileTab === 'A' ? '' : 'hidden sm:block'}>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{t('gameA')}</p>
                <GameCard {...gameA} />
              </div>
              <div className={mobileTab === 'B' ? '' : 'hidden sm:block'}>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{t('gameB')}</p>
                <GameCard {...gameB} />
              </div>
            </div>
          </>
        )}

        {/* Single card shown */}
        {(gameA && !gameB) && (
          <div className="max-w-lg">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{t('gameA')}</p>
            <GameCard {...gameA} />
          </div>
        )}
        {(!gameA && gameB) && (
          <div className="max-w-lg">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{t('gameB')}</p>
            <GameCard {...gameB} />
          </div>
        )}

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
