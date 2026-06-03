'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowRight, ChevronDown, ChevronUp, Sparkles, Ban, Users, Timer, Brain, Star, Leaf, BookOpen, Monitor } from 'lucide-react'
import GameCompactCard from './GameCompactCard'
import { curascoreTextEditorial } from '@/lib/ui'
import type { GameSummary, SwapPair, CatalogStats } from '@/types/game'

// ─── Static data ──────────────────────────────────────────────────────────────

const AGE_SEGMENTS = [
  { labelKey: 'earlyYears',      value: 'E',   esrb: ['E']                  },
  { labelKey: 'middleChildhood', value: 'E10', esrb: ['E', 'E10+']          },
  { labelKey: 'earlyTeens',      value: 'T',   esrb: ['E', 'E10+', 'T']     },
  { labelKey: 'olderTeens',      value: 'M',   esrb: ['T', 'M']             },
]

const CATEGORY_PILLS = [
  { icon: Brain,    labelKey: 'pillHighBrainPower', href: '/browse?benefits=problem-solving' },
  { icon: Ban,      labelKey: 'pillZeroMicro',      href: '/browse?compliance=DSA'           },
  { icon: Users,    labelKey: 'pillFamilyCoOp',     href: '/browse?benefits=teamwork'        },
  { icon: Timer,    labelKey: 'pillShortSessions',  href: '/browse?time=30'                  },
  { icon: Sparkles, labelKey: 'pillCreativePlay',   href: '/browse?genres=Puzzle'            },
  { icon: Star,     labelKey: 'pillTopRated',       href: '/browse?sort=curascore'           },
  { icon: Leaf,     labelKey: 'pillYoungKids',      href: '/browse?age=E'                    },
  { icon: BookOpen, labelKey: 'pillLearningFocus',  href: '/browse?benefits=problem-solving' },
]

const DID_YOU_KNOW = [
  { fact: 'Games with natural stopping points (like level ends) are associated with 23% shorter sessions than games with infinite scroll mechanics.', source: 'APA, 2022' },
  { fact: 'Variable reward schedules — where you don\'t know when the next reward comes — are the most effective known technique for creating compulsive behaviour. They\'re also a core mechanic in loot boxes.', source: 'Skinner, 1938 (applied to games)' },
  { fact: 'Cooperative games that require verbal communication score significantly higher on social-emotional development than competitive multiplayer.', source: 'Journal of Child Development, 2019' },
  { fact: 'Children who play puzzle and strategy games for 30–60 min/day show measurable improvements in working memory after 8 weeks.', source: 'Nature Human Behaviour, 2020' },
  { fact: 'Loot boxes meet the formal criteria for gambling in Belgium, the Netherlands, and the UK — banned for under-18s in those countries.', source: 'EGBA Report, 2023' },
]

const SCORE_ZONES = [
  { min: 0,  max: 40,  labelKey: 'zoneCautionLabel',  color: 'bg-accent', textColor: 'text-accent', descKey: 'zoneCautionDesc'  },
  { min: 41, max: 65,  labelKey: 'zoneModerateLabel', color: 'bg-warm',   textColor: 'text-warm',   descKey: 'zoneModerateDesc' },
  { min: 66, max: 100, labelKey: 'zoneGreatLabel',    color: 'bg-ivy',    textColor: 'text-ivy',    descKey: 'zoneGreatDesc'   },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

type T = ReturnType<typeof useTranslations<'discover'>>

function LumiScoreScale({ t }: { t: T }) {
  return (
    <div className="bg-paper rounded-2xl border border-rule shadow-sm p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">{t('whatMeansCurascore')}</p>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-4">
        <div className="bg-accent flex-[40]" />
        <div className="bg-warm flex-[25]" />
        <div className="bg-ivy flex-[35]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SCORE_ZONES.map(z => (
          <div key={z.labelKey}>
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${z.color}`} />
              <span className={`text-xs font-black ${z.textColor}`}>{t(z.labelKey as Parameters<T>[0])}</span>
              <span className="text-xs text-muted font-medium">{z.min}–{z.max}</span>
            </div>
            <p className="text-xs text-muted leading-snug">{t(z.descKey as Parameters<T>[0])}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatStrip({ stats, t }: { stats: CatalogStats; t: T }) {
  const items = [
    { value: `${stats.totalScored}`,        label: t('statGamesReviewed'), color: 'text-accent' },
    { value: `${stats.lootBoxFreePct}%`,    label: t('statNoLootBoxes'),   color: 'text-ivy' },
    { value: `${stats.avgCurascoreE}`,      label: t('statAvgScoreE'),     color: 'text-warm' },
    { value: `${stats.greenCount}`,         label: t('statGamesGreat'),    color: 'text-ivy' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(s => (
        <div key={s.label} className="bg-paper rounded-2xl border border-rule shadow-sm px-3 sm:px-4 py-3 text-center">
          <p className={`text-xl sm:text-2xl font-black tracking-tight ${s.color}`}>{s.value}</p>
          <p className="text-xs text-muted font-medium mt-0.5 leading-tight">{s.label}</p>
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
    <div className="border-l-2 border-accent pl-5 py-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black uppercase tracking-widest text-accent">{t('didYouKnow')}</p>
        <div className="flex gap-1">
          {DID_YOU_KNOW.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-accent' : 'bg-rule hover:bg-ink'}`}
              aria-label={`Fact ${i + 1}`}
            />
          ))}
        </div>
      </div>
      <p className="text-sm text-ink/80 leading-relaxed">&ldquo;{item.fact}&rdquo;</p>
      <p className="text-xs text-muted mt-2 italic">— {item.source}</p>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setIdx(i => (i - 1 + DID_YOU_KNOW.length) % DID_YOU_KNOW.length)}
          className="text-xs text-accent hover:underline font-semibold transition-colors"
        >{t('prev')}</button>
        <button
          onClick={() => setIdx(i => (i + 1) % DID_YOU_KNOW.length)}
          className="text-xs text-accent hover:underline font-semibold transition-colors"
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
    <div className="bg-paper rounded-2xl shadow-sm border border-rule overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-black uppercase tracking-widest text-muted">{t('safeSwap')}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
            swap.from.riskType === 'monetization' ? 'bg-accent' :
            swap.from.riskType === 'dopamine'     ? 'bg-orange-500' :
            swap.from.riskType === 'social'        ? 'bg-warm' : 'bg-muted'
          }`}>{t(RISK_LABELS[swap.from.riskType])}</span>
        </div>
        <p className="text-lg font-black tracking-tight text-ink">
          {t('safeSwapAskingFor')}{' '}
          <Link href={swap.from.href} className="text-accent hover:underline">{swap.from.title}</Link>?
        </p>
      </div>

      {/* Risk explanation toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-2.5 border-y border-rule/50 text-left hover:bg-ink/[0.03] transition-colors"
      >
        <span className="text-xs font-semibold text-accent">{t('safeSwapWhyConcern')}</span>
        {expanded ? <ChevronUp size={14} className="text-accent" /> : <ChevronDown size={14} className="text-accent" />}
      </button>
      {expanded && (
        <div className="px-5 py-3 border-b border-rule/50">
          <p className="text-sm text-ink/85 leading-relaxed">{swap.from.riskExplanation}</p>
        </div>
      )}

      {/* Risky game score */}
      <div className="px-5 py-4 flex items-center gap-4 border-b border-rule/50">
        <div className="flex items-baseline gap-1 px-3 py-1.5 border border-rule shrink-0">
          <span className={`font-serif text-2xl ${curascoreTextEditorial(swap.from.curascore)}`}>
            {swap.from.curascore}
          </span>
          <span className="text-xs text-muted">/100</span>
        </div>
        <div>
          <p className="font-bold text-ink text-sm">{swap.from.title}</p>
          <p className="text-xs text-accent mt-0.5">{swap.from.reason}</p>
        </div>
      </div>

      {/* Alternatives */}
      <div className="px-5 py-4">
        <p className="text-kicker uppercase font-semibold text-ivy mb-3" style={{ fontVariantCaps: 'all-small-caps' }}>{t('safeSwapBetterAlt')}</p>
        <div className="space-y-3">
          {swap.alternatives.map((alt) => (
            <Link
              key={alt.href}
              href={alt.href}
              className="flex items-center gap-4 p-3 border border-ivy/40 hover:border-ivy transition-colors group"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-ink text-paper text-xs font-serif shrink-0">
                {alt.curascore}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink text-sm truncate group-hover:text-accent transition-colors">{alt.title}</p>
                <p className="text-xs text-ivy mt-0.5 line-clamp-1">{alt.reason}</p>
              </div>
              <ArrowRight size={14} className="text-rule group-hover:text-accent shrink-0 transition-colors" />
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
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── 1. HEADER ───────────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-accent mb-1">
              {t('tagline')}
            </p>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tighter text-ink leading-none">
              {t('heading')}
            </h1>
          </div>
          {/* Age filter */}
          <div className="border border-rule p-1.5 grid grid-cols-2 sm:flex gap-1">
            {AGE_SEGMENTS.map((seg) => (
              <button
                key={seg.value}
                onClick={() => setActiveAge(activeAge === seg.value ? null : seg.value)}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-black tracking-tight rounded-xl transition-all duration-200 ${
                  activeAge === seg.value
                    ? 'bg-ink text-paper'
                    : 'text-muted hover:text-ink'
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
                  ? 'bg-ink border-ink text-paper -translate-y-0.5'
                  : 'bg-paper border-rule text-ink/80 hover:border-ink hover:text-accent'
                }`}
            >
              <pill.icon size={16} aria-hidden="true" />
              <span>{t(pill.labelKey as Parameters<T>[0])}</span>
            </Link>
          ))}
        </div>

        {/* ── 5. DISCOVERY GRID ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-black tracking-tight text-ink">{gridTitle}</h2>
            <Link href={browseHref} className="text-xs font-semibold text-accent hover:underline transition-colors flex items-center gap-1">
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
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-paper text-muted border-rule hover:border-ink'
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
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-paper text-muted border-rule hover:border-ink'
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
            <div className="text-center py-12 bg-paper rounded-2xl border border-rule">
              <p className="mb-2 flex justify-center"><Monitor size={36} aria-hidden="true" className="text-rule" /></p>
              <p className="font-semibold text-ink/80">{t('noMatchFilters')}</p>
              <button
                onClick={() => { setActiveAge(null); setActiveGenre(null) }}
                className="mt-3 text-sm text-accent hover:underline"
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
        <div className="bg-ink p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <p className="text-white font-black tracking-tight text-base sm:text-lg">{t('gamesRated', { count: stats.totalScored })}</p>
            <p className="text-paper/70 text-sm mt-0.5">{t('groundedResearch')}</p>
          </div>
          <Link
            href={`/${locale}/browse`}
            className="shrink-0 bg-paper text-ink text-kicker uppercase font-semibold px-6 py-3 hover:bg-accent hover:text-paper transition-colors flex items-center gap-2"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('browseAll')} <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
        </div>

      </div>
    </div>
  )
}
