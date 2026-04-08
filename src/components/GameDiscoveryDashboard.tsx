'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, ChevronUp, Sparkles, Ban, Users, Timer, Brain, Star, Leaf, BookOpen } from 'lucide-react'
import GameCompactCard from './GameCompactCard'
import { curascoreGradient, curascoreRing, curascoreBg } from '@/lib/ui'
import type { GameSummary, SwapPair, CatalogStats } from '@/types/game'

// ─── Static data ──────────────────────────────────────────────────────────────

const AGE_SEGMENTS = [
  { label: 'Early Years',       value: 'E',   esrb: ['E']                  },
  { label: 'Middle Childhood',  value: 'E10', esrb: ['E', 'E10+']          },
  { label: 'Early Teens',       value: 'T',   esrb: ['E', 'E10+', 'T']     },
  { label: 'Older Teens',       value: 'M',   esrb: ['T', 'M']             },
]

const CATEGORY_PILLS = [
  { icon: Brain,    emoji: '🧩', label: 'High Brain Power',        href: '/browse?benefits=problem-solving' },
  { icon: Ban,      emoji: '🛑', label: 'Zero Microtransactions',  href: '/browse?compliance=DSA'           },
  { icon: Users,    emoji: '🛋️', label: 'Family Co-Op',           href: '/browse?benefits=teamwork'        },
  { icon: Timer,    emoji: '⏱️', label: 'Short Sessions',         href: '/browse?time=30'                  },
  { icon: Sparkles, emoji: '🎨', label: 'Creative Play',          href: '/browse?genres=Puzzle'            },
  { icon: Star,     emoji: '🏆', label: 'Top Rated',              href: '/browse?sort=curascore'           },
  { icon: Leaf,     emoji: '🌱', label: 'Great for Young Kids',   href: '/browse?age=E'                    },
  { icon: BookOpen, emoji: '🧠', label: 'Learning Focus',         href: '/browse?benefits=problem-solving' },
]

const DID_YOU_KNOW = [
  { fact: 'Games with natural stopping points (like level ends) are associated with 23% shorter sessions than games with infinite scroll mechanics.', source: 'APA, 2022' },
  { fact: 'Variable reward schedules — where you don\'t know when the next reward comes — are the most effective known technique for creating compulsive behaviour. They\'re also a core mechanic in loot boxes.', source: 'Skinner, 1938 (applied to games)' },
  { fact: 'Cooperative games that require verbal communication score significantly higher on social-emotional development than competitive multiplayer.', source: 'Journal of Child Development, 2019' },
  { fact: 'Children who play puzzle and strategy games for 30–60 min/day show measurable improvements in working memory after 8 weeks.', source: 'Nature Human Behaviour, 2020' },
  { fact: 'Loot boxes meet the formal criteria for gambling in Belgium, the Netherlands, and the UK — banned for under-18s in those countries.', source: 'EGBA Report, 2023' },
]

const SCORE_ZONES = [
  { min: 0,  max: 40,  label: 'Caution',  color: 'bg-red-500',     textColor: 'text-red-600',    desc: 'Design risks outweigh benefits. Limit sessions carefully.' },
  { min: 41, max: 65,  label: 'Moderate', color: 'bg-amber-400',   textColor: 'text-amber-600',  desc: 'Mixed profile. Worth a closer look before regular play.' },
  { min: 66, max: 100, label: 'Great',    color: 'bg-emerald-500', textColor: 'text-emerald-600', desc: 'Strong benefits, manageable risks. More daily time approved.' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function CurascoreScale() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">What does a Curascore mean?</p>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-4">
        <div className="bg-red-500 flex-[40]" />
        <div className="bg-amber-400 flex-[25]" />
        <div className="bg-emerald-500 flex-[35]" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {SCORE_ZONES.map(z => (
          <div key={z.label}>
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${z.color}`} />
              <span className={`text-xs font-black ${z.textColor}`}>{z.label}</span>
              <span className="text-xs text-slate-400 font-medium">{z.min}–{z.max}</span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">{z.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatStrip({ stats }: { stats: CatalogStats }) {
  const items = [
    { value: `${stats.totalScored}`,        label: 'games reviewed',              color: 'text-indigo-600' },
    { value: `${stats.lootBoxFreePct}%`,    label: 'have no loot boxes',          color: 'text-emerald-600' },
    { value: `${stats.avgCurascoreE}`,      label: 'avg score for ages 6+',       color: 'text-amber-600' },
    { value: `${stats.greenCount}`,         label: 'games rated Great',           color: 'text-emerald-600' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(s => (
        <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3 sm:px-4 py-3 text-center">
          <p className={`text-xl sm:text-2xl font-black tracking-tight ${s.color}`}>{s.value}</p>
          <p className="text-xs text-slate-400 font-medium mt-0.5 leading-tight">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

function DidYouKnow() {
  const [idx, setIdx] = useState(0)
  const item = DID_YOU_KNOW[idx]
  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-400">Did you know?</p>
        <div className="flex gap-1">
          {DID_YOU_KNOW.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-indigo-500' : 'bg-indigo-200 hover:bg-indigo-300'}`}
              aria-label={`Fact ${i + 1}`}
            />
          ))}
        </div>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">&ldquo;{item.fact}&rdquo;</p>
      <p className="text-xs text-slate-400 mt-2 italic">— {item.source}</p>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setIdx(i => (i - 1 + DID_YOU_KNOW.length) % DID_YOU_KNOW.length)}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold transition-colors"
        >← Prev</button>
        <button
          onClick={() => setIdx(i => (i + 1) % DID_YOU_KNOW.length)}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold transition-colors"
        >Next →</button>
      </div>
    </div>
  )
}

function SafeSwap({ swap }: { swap: SwapPair }) {
  const [expanded, setExpanded] = useState(false)
  const RISK_LABELS: Record<string, string> = {
    monetization: 'Monetization Risk',
    dopamine:     'Compulsive Design',
    social:       'Social Risk',
    general:      'High Risk',
  }
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">Safe Swap</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
            swap.from.riskType === 'monetization' ? 'bg-red-500' :
            swap.from.riskType === 'dopamine'     ? 'bg-orange-500' :
            swap.from.riskType === 'social'        ? 'bg-purple-500' : 'bg-slate-500'
          }`}>{RISK_LABELS[swap.from.riskType]}</span>
        </div>
        <p className="text-lg font-black tracking-tight text-slate-800">
          Is your child asking for{' '}
          <Link href={swap.from.href} className="text-red-500 hover:underline">{swap.from.title}</Link>?
        </p>
      </div>

      {/* Risk explanation toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-2.5 bg-red-50 border-y border-red-100 text-left hover:bg-red-100 transition-colors"
      >
        <span className="text-xs font-semibold text-red-700">Why is this a concern?</span>
        {expanded ? <ChevronUp size={14} className="text-red-400" /> : <ChevronDown size={14} className="text-red-400" />}
      </button>
      {expanded && (
        <div className="px-5 py-3 bg-red-50/50 border-b border-red-100">
          <p className="text-sm text-red-800 leading-relaxed">{swap.from.riskExplanation}</p>
        </div>
      )}

      {/* Risky game score */}
      <div className="px-5 py-4 flex items-center gap-4 border-b border-slate-100">
        <div className={`flex items-baseline gap-1 px-3 py-1.5 rounded-xl border shrink-0 ${curascoreRing(swap.from.curascore)}`}>
          <span className={`text-2xl font-black bg-gradient-to-br ${curascoreGradient(swap.from.curascore)} bg-clip-text text-transparent`}>
            {swap.from.curascore}
          </span>
          <span className="text-xs text-slate-400">/100</span>
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm">{swap.from.title}</p>
          <p className="text-xs text-red-600 mt-0.5">{swap.from.reason}</p>
        </div>
      </div>

      {/* Alternatives */}
      <div className="px-5 py-4">
        <p className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-3">Better alternatives</p>
        <div className="space-y-3">
          {swap.alternatives.map((alt, i) => (
            <Link
              key={alt.href}
              href={alt.href}
              className="flex items-center gap-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-100 transition-colors group"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 ${curascoreBg(alt.curascore)}`}>
                {alt.curascore}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate group-hover:text-indigo-700 transition-colors">{alt.title}</p>
                <p className="text-xs text-emerald-700 mt-0.5 line-clamp-1">{alt.reason}</p>
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-500 shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Props = {
  topGames?: GameSummary[]
  swap?:     SwapPair
  stats:     CatalogStats
}

export default function GameDiscoveryDashboard({ topGames = [], swap, stats }: Props) {
  const [activeAge,      setActiveAge]      = useState<string | null>(null)
  const [activeGenre,    setActiveGenre]    = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // derive genre list from top games
  const allGenres = Array.from(new Set(topGames.flatMap(g => g.genres ?? []))).sort()

  const activeSeg = AGE_SEGMENTS.find(s => s.value === activeAge)

  const displayGames = topGames
    .filter(g => !activeSeg  || (g.esrbRating && activeSeg.esrb.includes(g.esrbRating)))
    .filter(g => !activeGenre || (g.genres ?? []).includes(activeGenre))
    .slice(0, 12)

  const browseHref = [
    '/browse',
    activeSeg   ? `age=${activeSeg.value}`    : '',
    activeGenre ? `genres=${activeGenre}`     : '',
  ].filter(Boolean).join('?').replace('?age', '?age').replace(/\?([^?]*)&?([^?]*)$/, (_, a, b) => b ? `?${a}&${b}` : `?${a}`)

  const gridTitle = activeSeg
    ? `${activeSeg.label}${activeGenre ? ` · ${activeGenre}` : ''}`
    : activeGenre ? activeGenre : 'Top rated games'

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── 1. HEADER ───────────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-1">
              Grounded in child development
            </p>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tighter text-slate-900 leading-none">
              Discover Games
            </h1>
          </div>
          {/* Age filter */}
          <div className="bg-slate-100 rounded-2xl p-1.5 grid grid-cols-2 sm:flex gap-1">
            {AGE_SEGMENTS.map((seg) => (
              <button
                key={seg.value}
                onClick={() => setActiveAge(activeAge === seg.value ? null : seg.value)}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-black tracking-tight rounded-xl transition-all duration-200 ${
                  activeAge === seg.value
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 2. CURASCORE SCALE ──────────────────────────────────────────────── */}
        <CurascoreScale />

        {/* ── 3. STATS STRIP ──────────────────────────────────────────────────── */}
        <StatStrip stats={stats} />

        {/* ── 4. CATEGORY PILLS ───────────────────────────────────────────────── */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {CATEGORY_PILLS.map((pill) => (
            <Link
              key={pill.label}
              href={pill.href}
              onClick={() => setActiveCategory(activeCategory === pill.label ? null : pill.label)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold
                border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm
                ${activeCategory === pill.label
                  ? 'bg-indigo-100 border-indigo-200 text-indigo-700 -translate-y-0.5 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
                }`}
            >
              <span>{pill.emoji}</span>
              <span>{pill.label}</span>
            </Link>
          ))}
        </div>

        {/* ── 5. DISCOVERY GRID ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-black tracking-tight text-slate-900">{gridTitle}</h2>
            <Link href={browseHref} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
              See all <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>

          {/* Genre tabs */}
          {allGenres.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <button
                onClick={() => setActiveGenre(null)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  activeGenre === null
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
              >
                All
              </button>
              {allGenres.slice(0, 12).map(g => (
                <button
                  key={g}
                  onClick={() => setActiveGenre(activeGenre === g ? null : g)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    activeGenre === g
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          {displayGames.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {displayGames.map((game) => (
                <div key={game.slug} className="hover:-translate-y-1 hover:shadow-md transition-all duration-200">
                  <GameCompactCard game={game} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
              <p className="text-3xl mb-2">🎮</p>
              <p className="font-semibold text-slate-600">No games match these filters</p>
              <button
                onClick={() => { setActiveAge(null); setActiveGenre(null) }}
                className="mt-3 text-sm text-indigo-600 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* ── 6. SAFE SWAP ────────────────────────────────────────────────────── */}
        {swap && <SafeSwap swap={swap} />}

        {/* ── 7. DID YOU KNOW ─────────────────────────────────────────────────── */}
        <DidYouKnow />

        {/* ── 8. FOOTER CTA ───────────────────────────────────────────────────── */}
        <div className="bg-indigo-600 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <p className="text-white font-black tracking-tight text-base sm:text-lg">{stats.totalScored}+ games rated</p>
            <p className="text-indigo-200 text-sm mt-0.5">Grounded in child development research</p>
          </div>
          <Link
            href="/browse"
            className="shrink-0 bg-white text-indigo-700 font-black text-sm px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors flex items-center gap-2"
          >
            Browse all games <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
        </div>

      </div>
    </div>
  )
}
