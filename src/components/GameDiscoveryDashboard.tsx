'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowRight, ChevronDown, ChevronUp, Sparkles, Ban, Users, Timer, Brain, Star, Leaf, BookOpen } from 'lucide-react'
import GameCompactCard from './GameCompactCard'
import { curascoreGradient, curascoreRing, curascoreBg } from '@/lib/ui'
import type { GameSummary, SwapPair, CatalogStats } from '@/types/game'

// ─── Static data ──────────────────────────────────────────────────────────────

const AGE_SEGMENTS = [
  { labelKey: 'earlyYears',      value: 'E',   esrb: ['E']                  },
  { labelKey: 'middleChildhood', value: 'E10', esrb: ['E', 'E10+']          },
  { labelKey: 'earlyTeens',      value: 'T',   esrb: ['E', 'E10+', 'T']     },
  { labelKey: 'olderTeens',      value: 'M',   esrb: ['T', 'M']             },
]

const CATEGORY_PILLS = [
  { icon: Brain,    emoji: '🧩', labelKey: 'pillHighBrainPower', href: '/browse?benefits=problem-solving' },
  { icon: Ban,      emoji: '🛑', labelKey: 'pillZeroMicro',      href: '/browse?compliance=DSA'           },
  { icon: Users,    emoji: '🛋️', labelKey: 'pillFamilyCoOp',    href: '/browse?benefits=teamwork'        },
  { icon: Timer,    emoji: '⏱️', labelKey: 'pillShortSessions', href: '/browse?time=30'                  },
  { icon: Sparkles, emoji: '🎨', labelKey: 'pillCreativePlay',   href: '/browse?genres=Puzzle'            },
  { icon: Star,     emoji: '🏆', labelKey: 'pillTopRated',       href: '/browse?sort=curascore'           },
  { icon: Leaf,     emoji: '🌱', labelKey: 'pillYoungKids',      href: '/browse?age=E'                    },
  { icon: BookOpen, emoji: '🧠', labelKey: 'pillLearningFocus',  href: '/browse?benefits=problem-solving' },
]

const DID_YOU_KNOW = [
  { fact: 'Games with natural stopping points (like level ends) are associated with 23% shorter sessions than games with infinite scroll mechanics.', source: 'APA, 2022' },
  { fact: 'Variable reward schedules — where you don\'t know when the next reward comes — are the most effective known technique for creating compulsive behaviour. They\'re also a core mechanic in loot boxes.', source: 'Skinner, 1938 (applied to games)' },
  { fact: 'Cooperative games that require verbal communication score significantly higher on social-emotional development than competitive multiplayer.', source: 'Journal of Child Development, 2019' },
  { fact: 'Children who play puzzle and strategy games for 30–60 min/day show measurable improvements in working memory after 8 weeks.', source: 'Nature Human Behaviour, 2020' },
  { fact: 'Loot boxes meet the formal criteria for gambling in Belgium, the Netherlands, and the UK — banned for under-18s in those countries.', source: 'EGBA Report, 2023' },
]

const SCORE_ZONES = [
  { min: 0,  max: 40,  labelKey: 'zoneCautionLabel',  color: 'bg-red-500',     textColor: 'text-red-600 dark:text-red-400',    descKey: 'zoneCautionDesc'  },
  { min: 41, max: 65,  labelKey: 'zoneModerateLabel', color: 'bg-amber-400',   textColor: 'text-amber-600 dark:text-amber-400',  descKey: 'zoneModerateDesc' },
  { min: 66, max: 100, labelKey: 'zoneGreatLabel',    color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', descKey: 'zoneGreatDesc'   },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

type T = ReturnType<typeof useTranslations<'discover'>>

function LumiScoreScale({ t }: { t: T }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">{t('whatMeansCurascore')}</p>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-4">
        <div className="bg-red-500 flex-[40]" />
        <div className="bg-amber-400 flex-[25]" />
        <div className="bg-emerald-500 flex-[35]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SCORE_ZONES.map(z => (
          <div key={z.labelKey}>
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${z.color}`} />
              <span className={`text-xs font-black ${z.textColor}`}>{t(z.labelKey as Parameters<T>[0])}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{z.min}–{z.max}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{t(z.descKey as Parameters<T>[0])}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatStrip({ stats, t }: { stats: CatalogStats; t: T }) {
  const items = [
    { value: `${stats.totalScored}`,        label: t('statGamesReviewed'), color: 'text-indigo-600 dark:text-indigo-400' },
    { value: `${stats.lootBoxFreePct}%`,    label: t('statNoLootBoxes'),   color: 'text-emerald-600 dark:text-emerald-400' },
    { value: `${stats.avgCurascoreE}`,      label: t('statAvgScoreE'),     color: 'text-amber-600 dark:text-amber-400' },
    { value: `${stats.greenCount}`,         label: t('statGamesGreat'),    color: 'text-emerald-600 dark:text-emerald-400' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(s => (
        <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm px-3 sm:px-4 py-3 text-center">
          <p className={`text-xl sm:text-2xl font-black tracking-tight ${s.color}`}>{s.value}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5 leading-tight">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

function DidYouKnow() {
  const t = useTranslations('discover')
  const [idx, setIdx] = useState(0)
  const item = DID_YOU_KNOW[idx]
  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-400 dark:text-indigo-500">{t('didYouKnow')}</p>
        <div className="flex gap-1">
          {DID_YOU_KNOW.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-indigo-500' : 'bg-indigo-200 dark:bg-indigo-700 hover:bg-indigo-300 dark:hover:bg-indigo-600'}`}
              aria-label={`Fact ${i + 1}`}
            />
          ))}
        </div>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">&ldquo;{item.fact}&rdquo;</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">— {item.source}</p>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setIdx(i => (i - 1 + DID_YOU_KNOW.length) % DID_YOU_KNOW.length)}
          className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors"
        >{t('prev')}</button>
        <button
          onClick={() => setIdx(i => (i + 1) % DID_YOU_KNOW.length)}
          className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors"
        >{t('next')}</button>
      </div>
    </div>
  )
}

function SafeSwap({ swap }: { swap: SwapPair }) {
  const t = useTranslations('discover')
  const [expanded, setExpanded] = useState(false)
  const RISK_LABELS: Record<string, Parameters<T>[0]> = {
    monetization: 'riskMonetization',
    dopamine:     'riskDopamine',
    social:       'riskSocial',
    general:      'riskGeneral',
  }
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('safeSwap')}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
            swap.from.riskType === 'monetization' ? 'bg-red-500' :
            swap.from.riskType === 'dopamine'     ? 'bg-orange-500' :
            swap.from.riskType === 'social'        ? 'bg-purple-500' : 'bg-slate-500'
          }`}>{t(RISK_LABELS[swap.from.riskType])}</span>
        </div>
        <p className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">
          {t('safeSwapAskingFor')}{' '}
          <Link href={swap.from.href} className="text-red-500 dark:text-red-400 hover:underline">{swap.from.title}</Link>?
        </p>
      </div>

      {/* Risk explanation toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-2.5 bg-red-50 dark:bg-red-900/20 border-y border-red-100 dark:border-red-800 text-left hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
      >
        <span className="text-xs font-semibold text-red-700 dark:text-red-400">{t('safeSwapWhyConcern')}</span>
        {expanded ? <ChevronUp size={14} className="text-red-400 dark:text-red-500" /> : <ChevronDown size={14} className="text-red-400 dark:text-red-500" />}
      </button>
      {expanded && (
        <div className="px-5 py-3 bg-red-50/50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">{swap.from.riskExplanation}</p>
        </div>
      )}

      {/* Risky game score */}
      <div className="px-5 py-4 flex items-center gap-4 border-b border-slate-100 dark:border-slate-700">
        <div className={`flex items-baseline gap-1 px-3 py-1.5 rounded-xl border shrink-0 ${curascoreRing(swap.from.curascore)}`}>
          <span className={`text-2xl font-black bg-gradient-to-br ${curascoreGradient(swap.from.curascore)} bg-clip-text text-transparent`}>
            {swap.from.curascore}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">/100</span>
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{swap.from.title}</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{swap.from.reason}</p>
        </div>
      </div>

      {/* Alternatives */}
      <div className="px-5 py-4">
        <p className="text-xs font-black uppercase tracking-widest text-emerald-500 dark:text-emerald-400 mb-3">{t('safeSwapBetterAlt')}</p>
        <div className="space-y-3">
          {swap.alternatives.map((alt) => (
            <Link
              key={alt.href}
              href={alt.href}
              className="flex items-center gap-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors group"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 ${curascoreBg(alt.curascore)}`}>
                {alt.curascore}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">{alt.title}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5 line-clamp-1">{alt.reason}</p>
              </div>
              <ArrowRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 shrink-0 transition-colors" />
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
  const t = useTranslations('discover')
  const tAge = useTranslations('age')
  const locale = useLocale()
  const [activeAge,      setActiveAge]      = useState<string | null>(null)
  const [activeGenre,    setActiveGenre]    = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const allGenres = Array.from(new Set(topGames.flatMap(g => g.genres ?? []))).sort()

  const activeSeg = AGE_SEGMENTS.find(s => s.value === activeAge)

  const displayGames = topGames
    .filter(g => !activeSeg  || (g.esrbRating && activeSeg.esrb.includes(g.esrbRating)))
    .filter(g => !activeGenre || (g.genres ?? []).includes(activeGenre))
    .slice(0, 12)

  const browseParams = new URLSearchParams()
  if (activeSeg)   browseParams.set('age',    activeSeg.value)
  if (activeGenre) browseParams.set('genres', activeGenre)
  const browseSearch = browseParams.toString()
  const browseHref = `/${locale}/browse${browseSearch ? `?${browseSearch}` : ''}`

  const activeSegLabel = activeSeg ? tAge(activeSeg.labelKey as Parameters<typeof tAge>[0]) : null
  const gridTitle = activeSegLabel
    ? `${activeSegLabel}${activeGenre ? ` · ${activeGenre}` : ''}`
    : activeGenre ? activeGenre : t('topRatedGames')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── 1. HEADER ───────────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-indigo-400 dark:text-indigo-500 mb-1">
              {t('tagline')}
            </p>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tighter text-slate-900 dark:text-slate-100 leading-none">
              {t('heading')}
            </h1>
          </div>
          {/* Age filter */}
          <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 grid grid-cols-2 sm:flex gap-1">
            {AGE_SEGMENTS.map((seg) => (
              <button
                key={seg.value}
                onClick={() => setActiveAge(activeAge === seg.value ? null : seg.value)}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-black tracking-tight rounded-xl transition-all duration-200 ${
                  activeAge === seg.value
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {tAge(seg.labelKey as Parameters<typeof tAge>[0])}
              </button>
            ))}
          </div>
        </div>

        {/* ── 2. CURASCORE SCALE ──────────────────────────────────────────────── */}
        <LumiScoreScale t={t} />

        {/* ── 3. STATS STRIP ──────────────────────────────────────────────────── */}
        <StatStrip stats={stats} t={t} />

        {/* ── 4. CATEGORY PILLS ───────────────────────────────────────────────── */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {CATEGORY_PILLS.map((pill) => (
            <Link
              key={pill.labelKey}
              href={'/' + locale + pill.href}
              onClick={() => setActiveCategory(activeCategory === pill.labelKey ? null : pill.labelKey)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold
                border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm
                ${activeCategory === pill.labelKey
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 -translate-y-0.5 shadow-sm'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-200 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
            >
              <span>{pill.emoji}</span>
              <span>{t(pill.labelKey as Parameters<T>[0])}</span>
            </Link>
          ))}
        </div>

        {/* ── 5. DISCOVERY GRID ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">{gridTitle}</h2>
            <Link href={browseHref} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors flex items-center gap-1">
              {t('seeAll')} <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>

          {/* Genre tabs */}
          {allGenres.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <button
                onClick={() => setActiveGenre(null)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  activeGenre === null
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
                }`}
              >
                {t('allGenres')}
              </button>
              {allGenres.slice(0, 12).map(g => (
                <button
                  key={g}
                  onClick={() => setActiveGenre(activeGenre === g ? null : g)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    activeGenre === g
                      ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
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
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
              <p className="text-3xl mb-2">🎮</p>
              <p className="font-semibold text-slate-600 dark:text-slate-300">{t('noMatchFilters')}</p>
              <button
                onClick={() => { setActiveAge(null); setActiveGenre(null) }}
                className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('clearFilters')}
              </button>
            </div>
          )}
        </div>

        {/* ── 6. SAFE SWAP ────────────────────────────────────────────────────── */}
        {swap && <SafeSwap swap={swap} />}

        {/* ── 7. DID YOU KNOW ─────────────────────────────────────────────────── */}
        <DidYouKnow />

        {/* ── 8. FOOTER CTA ───────────────────────────────────────────────────── */}
        <div className="bg-indigo-600 dark:bg-indigo-700 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <p className="text-white font-black tracking-tight text-base sm:text-lg">{t('gamesRated', { count: stats.totalScored })}</p>
            <p className="text-indigo-200 text-sm mt-0.5">{t('groundedResearch')}</p>
          </div>
          <Link
            href={`/${locale}/browse`}
            className="shrink-0 bg-white text-indigo-700 font-black text-sm px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors flex items-center gap-2"
          >
            {t('browseAll')} <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
        </div>

      </div>
    </div>
  )
}
