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

// Platform families mirror PlatformPicker / browse. `keywords` are matched as
// case-insensitive substrings against each game's stored platform strings
// (e.g. "Nintendo Switch", "PlayStation 5"). `browseValue` is what /browse
// expects in its ?platforms= param (Mobile fans out to iOS + Android).
const PLATFORM_SEGMENTS = [
  { value: 'PC',          label: 'PC',          keywords: ['PC'],                                browseValue: 'PC'          },
  { value: 'PlayStation', label: 'PlayStation', keywords: ['PlayStation'],                       browseValue: 'PlayStation' },
  { value: 'Xbox',        label: 'Xbox',        keywords: ['Xbox'],                              browseValue: 'Xbox'        },
  { value: 'Switch',      label: 'Switch',      keywords: ['Nintendo Switch', 'Switch'],         browseValue: 'Switch'      },
  { value: 'Mobile',      labelKey: 'platformMobile', keywords: ['iOS', 'Android', 'iPhone', 'iPad'], browseValue: 'iOS,Android' },
] as const

type PlatformSegment = typeof PLATFORM_SEGMENTS[number]

function matchesPlatform(game: GameSummary, seg: PlatformSegment | undefined): boolean {
  if (!seg) return true
  const plats = game.platforms ?? []
  return plats.some(p => seg.keywords.some(k => p.toLowerCase().includes(k.toLowerCase())))
}

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

// ─── Shared bits ──────────────────────────────────────────────────────────────

type T = ReturnType<typeof useTranslations<'discover'>>

const SMALL_CAPS = { fontVariantCaps: 'all-small-caps' as const }

// Ruled section kicker — top hairline + small-caps label, the editorial header
// rhythm shared with the homepage spreads.
function SectionKicker({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'accent' }) {
  return (
    <div className="border-t border-ink pt-4 mb-6">
      <p
        className={`text-kicker uppercase font-semibold ${tone === 'accent' ? 'text-accent' : 'text-muted'}`}
        style={SMALL_CAPS}
      >
        {children}
      </p>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LumiScoreScale({ t }: { t: T }) {
  return (
    <section>
      <SectionKicker>{t('whatMeansCurascore')}</SectionKicker>
      <div className="flex h-2 overflow-hidden mb-6">
        <div className="bg-accent flex-[40]" />
        <div className="bg-warm flex-[25]" />
        <div className="bg-ivy flex-[35]" />
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-3 border-t-2 border-b border-ink divide-y sm:divide-y-0 sm:divide-x divide-ink/30">
        {SCORE_ZONES.map(z => (
          <div key={z.labelKey} className="py-4 sm:px-5 sm:first:pl-0 sm:last:pr-0">
            <dt className="flex items-center gap-2 mb-1.5">
              <span className={`w-2.5 h-2.5 ${z.color}`} aria-hidden />
              <span className={`text-kicker uppercase font-semibold ${z.textColor}`} style={SMALL_CAPS}>
                {t(z.labelKey as Parameters<T>[0])}
              </span>
              <span className="text-kicker uppercase text-muted tabular-nums" style={SMALL_CAPS}>{z.min}–{z.max}</span>
            </dt>
            <dd className="font-serif italic text-sm text-muted leading-snug">{t(z.descKey as Parameters<T>[0])}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function StatStrip({ stats, t, kicker }: { stats: CatalogStats; t: T; kicker: string }) {
  const items = [
    { value: `${stats.totalScored}`,           label: t('statGamesReviewed'),    color: 'text-ink'  },
    { value: `${stats.greatCount}`,            label: t('statGamesGreat'),       color: 'text-ivy'  },
    { value: `${stats.monetizedPct}%`,         label: t('statUseMonetization'),  color: 'text-warm' },
    { value: `${stats.zeroMonetizationCount}`, label: t('statZeroMonetization'), color: 'text-ivy'  },
  ]
  return (
    <section>
      <SectionKicker>{kicker}</SectionKicker>
      <dl className="grid grid-cols-2 md:grid-cols-4 border-t-2 border-b border-ink md:divide-x divide-ink/30">
        {items.map(s => (
          <div key={s.label} className="py-6 md:px-6 md:first:pl-0 md:last:pr-0">
            <dd
              className={`font-serif tabular-nums leading-none tracking-tight mb-3 ${s.color}`}
              style={{ fontSize: '3.5rem', fontOpticalSizing: 'auto', fontWeight: 500 }}
            >
              {s.value}
            </dd>
            <dt className="text-kicker uppercase text-muted" style={SMALL_CAPS}>{s.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  )
}

function CategoryDirectory({ t, locale }: { t: T; locale: string }) {
  return (
    <section>
      <SectionKicker>{t('exploreBy')}</SectionKicker>
      <ul className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ink/20 border-y-2 border-ink">
        {CATEGORY_PILLS.map((pill) => (
          <li key={pill.labelKey} className="bg-paper flex">
            <Link
              href={'/' + locale + pill.href}
              className="group flex-1 px-5 py-6 flex flex-col gap-3 bg-paper hover:bg-ink/[0.03] transition-colors"
            >
              <pill.icon size={20} strokeWidth={1.5} aria-hidden="true" className="text-muted group-hover:text-accent transition-colors" />
              <span
                className="text-kicker uppercase font-semibold text-ink group-hover:text-accent transition-colors"
                style={SMALL_CAPS}
              >
                {t(pill.labelKey as Parameters<T>[0])}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DidYouKnow() {
  const t = useTranslations('discover')
  const [idx, setIdx] = useState(0)
  const item = DID_YOU_KNOW[idx]
  return (
    <section className="border-l-2 border-accent pl-5 py-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-kicker uppercase font-semibold text-accent" style={SMALL_CAPS}>{t('didYouKnow')}</p>
        <div className="flex gap-1.5">
          {DID_YOU_KNOW.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 transition-colors ${i === idx ? 'bg-accent' : 'bg-rule hover:bg-ink'}`}
              aria-label={`Fact ${i + 1}`}
            />
          ))}
        </div>
      </div>
      <p className="font-serif italic text-lg text-ink/80 leading-relaxed">&ldquo;{item.fact}&rdquo;</p>
      <p className="text-sm text-muted mt-2">— {item.source}</p>
      <div className="flex gap-5 mt-4">
        <button
          onClick={() => setIdx(i => (i - 1 + DID_YOU_KNOW.length) % DID_YOU_KNOW.length)}
          className="text-kicker uppercase font-semibold text-accent hover:text-ink transition-colors"
          style={SMALL_CAPS}
        >{t('prev')}</button>
        <button
          onClick={() => setIdx(i => (i + 1) % DID_YOU_KNOW.length)}
          className="text-kicker uppercase font-semibold text-accent hover:text-ink transition-colors"
          style={SMALL_CAPS}
        >{t('next')}</button>
      </div>
    </section>
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
  // Tone-text instead of a filled badge — no white-on-color chips.
  const riskTone =
    swap.from.riskType === 'monetization' ? 'text-accent' :
    swap.from.riskType === 'dopamine'     ? 'text-warm'   :
    swap.from.riskType === 'social'        ? 'text-warm'   : 'text-muted'

  return (
    <article className="border border-ink">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-kicker uppercase font-semibold text-muted" style={SMALL_CAPS}>{t('safeSwap')}</span>
          <span className={`text-kicker uppercase font-semibold ${riskTone}`} style={SMALL_CAPS}>{t(RISK_LABELS[swap.from.riskType])}</span>
        </div>
        <p className="font-serif text-2xl tracking-tight leading-tight text-ink" style={{ fontOpticalSizing: 'auto' }}>
          {t('safeSwapAskingFor')}{' '}
          <Link href={swap.from.href} className="text-accent hover:text-ink transition-colors">{swap.from.title}</Link>?
        </p>
      </div>

      {/* Risk explanation toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-3 border-t border-ink/20 text-left hover:bg-ink/[0.03] transition-colors"
      >
        <span className="text-kicker uppercase font-semibold text-accent" style={SMALL_CAPS}>{t('safeSwapWhyConcern')}</span>
        {expanded ? <ChevronUp size={14} className="text-accent" /> : <ChevronDown size={14} className="text-accent" />}
      </button>
      {expanded && (
        <div className="px-5 py-3 border-t border-ink/20">
          <p className="font-serif italic text-base text-ink/85 leading-relaxed">{swap.from.riskExplanation}</p>
        </div>
      )}

      {/* Risky game score */}
      <div className="px-5 py-4 flex items-center gap-4 border-t border-ink/20">
        <div className="flex items-baseline gap-1 px-3 py-1.5 border border-ink/30 shrink-0">
          <span className={`font-serif text-2xl ${curascoreTextEditorial(swap.from.curascore)}`}>
            {swap.from.curascore}
          </span>
          <span className="text-xs text-muted">/100</span>
        </div>
        <div>
          <p className="font-serif text-base text-ink leading-tight">{swap.from.title}</p>
          <p className="text-sm text-accent mt-0.5">{swap.from.reason}</p>
        </div>
      </div>

      {/* Alternatives */}
      <div className="px-5 py-4 border-t border-ink/20">
        <p className="text-kicker uppercase font-semibold text-ivy mb-3" style={SMALL_CAPS}>{t('safeSwapBetterAlt')}</p>
        <div className="space-y-2">
          {swap.alternatives.map((alt) => (
            <Link
              key={alt.href}
              href={alt.href}
              className="flex items-center gap-4 p-3 border border-ink/20 hover:border-ink transition-colors group"
            >
              <span className={`font-serif text-xl tabular-nums shrink-0 ${curascoreTextEditorial(alt.curascore)}`}>
                {alt.curascore}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-base text-ink truncate group-hover:text-accent transition-colors">{alt.title}</p>
                <p className="text-sm text-ivy mt-0.5 line-clamp-1">{alt.reason}</p>
              </div>
              <ArrowRight size={14} className="text-rule group-hover:text-accent shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </article>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Props = {
  topGames?: GameSummary[]
  swap?:     SwapPair
  stats:     CatalogStats
}

export default function GameDiscoveryDashboard({ topGames = [], swap, stats }: Props) {
  const t  = useTranslations('discover')
  const te = useTranslations('editorial')
  const tAge = useTranslations('age')
  const locale = useLocale()
  const [activeAge,      setActiveAge]      = useState<string | null>(null)
  const [activePlatform, setActivePlatform] = useState<string | null>(null)
  const [activeGenre,    setActiveGenre]    = useState<string | null>(null)

  const allGenres = Array.from(new Set(topGames.flatMap(g => g.genres ?? []))).sort()

  const activeSeg      = AGE_SEGMENTS.find(s => s.value === activeAge)
  const activePlatSeg  = PLATFORM_SEGMENTS.find(s => s.value === activePlatform)

  const displayGames = topGames
    .filter(g => !activeSeg   || (g.esrbRating && activeSeg.esrb.includes(g.esrbRating)))
    .filter(g => !activePlatSeg || matchesPlatform(g, activePlatSeg))
    .filter(g => !activeGenre || (g.genres ?? []).includes(activeGenre))
    .slice(0, 12)

  const browseParams = new URLSearchParams()
  if (activeSeg)     browseParams.set('age',       activeSeg.value)
  if (activePlatSeg) browseParams.set('platforms', activePlatSeg.browseValue)
  if (activeGenre)   browseParams.set('genres',    activeGenre)
  const browseSearch = browseParams.toString()
  const browseHref = `/${locale}/browse${browseSearch ? `?${browseSearch}` : ''}`

  const platformSegLabel = (seg: PlatformSegment) =>
    'labelKey' in seg ? t(seg.labelKey as Parameters<T>[0]) : seg.label

  const titleParts: string[] = []
  if (activeSeg)     titleParts.push(tAge(activeSeg.labelKey as Parameters<typeof tAge>[0]))
  if (activePlatSeg) titleParts.push(platformSegLabel(activePlatSeg))
  if (activeGenre)   titleParts.push(activeGenre)
  const gridTitle = titleParts.length > 0 ? titleParts.join(' · ') : t('topRatedGames')

  return (
    <div className="mx-auto max-w-7xl px-5 sm:px-8 pb-20 space-y-14">

      {/* ── 1. AGE + PLATFORM FILTERS ───────────────────────────────────────── */}
      <section>
        <SectionKicker>{t('filterBy')}</SectionKicker>

        {/* Age */}
        <p className="text-kicker uppercase text-muted mb-2" style={SMALL_CAPS}>{t('labelAge')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 border border-ink divide-x divide-y sm:divide-y-0 divide-ink/30">
          {AGE_SEGMENTS.map((seg) => {
            const isActive = activeAge === seg.value
            return (
              <button
                key={seg.value}
                onClick={() => setActiveAge(isActive ? null : seg.value)}
                aria-pressed={isActive}
                className={`py-3.5 px-3 text-kicker uppercase transition-colors ${
                  isActive ? 'bg-ink text-paper font-semibold' : 'text-muted hover:text-ink'
                }`}
                style={SMALL_CAPS}
              >
                {tAge(seg.labelKey as Parameters<typeof tAge>[0])}
              </button>
            )
          })}
        </div>

        {/* Platform */}
        <p className="text-kicker uppercase text-muted mb-2 mt-5" style={SMALL_CAPS}>{t('labelPlatform')}</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 border border-ink divide-x divide-y sm:divide-y-0 divide-ink/30">
          {PLATFORM_SEGMENTS.map((seg) => {
            const isActive = activePlatform === seg.value
            return (
              <button
                key={seg.value}
                onClick={() => setActivePlatform(isActive ? null : seg.value)}
                aria-pressed={isActive}
                className={`py-3.5 px-3 text-kicker uppercase transition-colors ${
                  isActive ? 'bg-ink text-paper font-semibold' : 'text-muted hover:text-ink'
                }`}
                style={SMALL_CAPS}
              >
                {platformSegLabel(seg)}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── 2. LUMISCORE SCALE ──────────────────────────────────────────────── */}
      <LumiScoreScale t={t} />

      {/* ── 3. STATS SPREAD ─────────────────────────────────────────────────── */}
      <StatStrip stats={stats} t={t} kicker={te('byTheNumbers.kicker')} />

      {/* ── 4. CATEGORY DIRECTORY ───────────────────────────────────────────── */}
      <CategoryDirectory t={t} locale={locale} />

      {/* ── 5. DISCOVERY GRID ───────────────────────────────────────────────── */}
      <section>
        <div className="border-t border-ink pt-4 mb-5 flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-display-sm tracking-tight leading-tight" style={{ fontOpticalSizing: 'auto' }}>
            {gridTitle}
          </h2>
          <Link
            href={browseHref}
            className="text-kicker uppercase font-semibold text-accent hover:text-ink transition-colors whitespace-nowrap"
            style={SMALL_CAPS}
          >
            {t('seeAll')} →
          </Link>
        </div>

        {/* Genre rail */}
        {allGenres.length > 0 && (
          <div className="flex gap-6 overflow-x-auto pb-2 mb-6 border-b border-ink/20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button
              onClick={() => setActiveGenre(null)}
              className={`shrink-0 text-kicker uppercase pb-2 -mb-px transition-colors ${
                activeGenre === null
                  ? 'text-ink font-semibold border-b-2 border-ink'
                  : 'text-muted hover:text-ink border-b-2 border-transparent'
              }`}
              style={SMALL_CAPS}
            >
              {t('allGenres')}
            </button>
            {allGenres.slice(0, 12).map(g => (
              <button
                key={g}
                onClick={() => setActiveGenre(activeGenre === g ? null : g)}
                className={`shrink-0 text-kicker uppercase pb-2 -mb-px transition-colors ${
                  activeGenre === g
                    ? 'text-ink font-semibold border-b-2 border-ink'
                    : 'text-muted hover:text-ink border-b-2 border-transparent'
                }`}
                style={SMALL_CAPS}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {displayGames.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {displayGames.map((game) => (
              <GameCompactCard key={game.slug} game={game} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border border-rule">
            <p className="mb-2 flex justify-center"><Monitor size={36} aria-hidden="true" className="text-rule" /></p>
            <p className="font-serif text-ink/80">{t('noMatchFilters')}</p>
            <button
              onClick={() => { setActiveAge(null); setActivePlatform(null); setActiveGenre(null) }}
              className="mt-3 text-kicker uppercase font-semibold text-accent hover:text-ink transition-colors"
              style={SMALL_CAPS}
            >
              {t('clearFilters')}
            </button>
          </div>
        )}
      </section>

      {/* ── 6. SAFE SWAP ────────────────────────────────────────────────────── */}
      {swap && <SafeSwap swap={swap} />}

      {/* ── 7. DID YOU KNOW ─────────────────────────────────────────────────── */}
      <DidYouKnow />

      {/* ── 8. FOOTER CTA ───────────────────────────────────────────────────── */}
      <div className="bg-ink p-5 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div>
          <p className="font-serif text-paper text-xl sm:text-2xl tracking-tight leading-tight">{t('gamesRated', { count: stats.totalScored })}</p>
          <p className="text-paper/70 text-sm mt-1">{t('groundedResearch')}</p>
        </div>
        <Link
          href={`/${locale}/browse`}
          className="shrink-0 bg-paper text-ink text-kicker uppercase font-semibold px-6 py-3 hover:bg-accent hover:text-paper transition-colors flex items-center gap-2"
          style={SMALL_CAPS}
        >
          {t('browseAll')} <ArrowRight size={15} strokeWidth={2.5} />
        </Link>
      </div>

    </div>
  )
}
