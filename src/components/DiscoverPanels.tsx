'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { curascoreTextEditorial } from '@/lib/ui'
import type { SwapPair, CatalogStats } from '@/types/game'

// Editorial discovery panels — the parts of the old /discover dashboard worth
// keeping (the LumiScore scale, catalogue stats, Safe Swap, and the research
// "did you know" rotator). Rendered at the foot of /browse in shelf mode so
// they reach parents instead of sitting on an orphaned route.

const SMALL_CAPS = { fontVariantCaps: 'all-small-caps' as const }

type T = ReturnType<typeof useTranslations<'discover'>>

const SCORE_ZONES = [
  { min: 0,  max: 40,  labelKey: 'zoneCautionLabel',  color: 'bg-accent', textColor: 'text-accent', descKey: 'zoneCautionDesc'  },
  { min: 41, max: 65,  labelKey: 'zoneModerateLabel', color: 'bg-warm',   textColor: 'text-warm',   descKey: 'zoneModerateDesc' },
  { min: 66, max: 100, labelKey: 'zoneGreatLabel',    color: 'bg-ivy',    textColor: 'text-ivy',    descKey: 'zoneGreatDesc'   },
] as const

const DID_YOU_KNOW = [
  { fact: 'Games with natural stopping points (like level ends) are associated with 23% shorter sessions than games with infinite scroll mechanics.', source: 'APA, 2022' },
  { fact: 'Variable reward schedules — where you don\'t know when the next reward comes — are the most effective known technique for creating compulsive behaviour. They\'re also a core mechanic in loot boxes.', source: 'Skinner, 1938 (applied to games)' },
  { fact: 'Cooperative games that require verbal communication score significantly higher on social-emotional development than competitive multiplayer.', source: 'Journal of Child Development, 2019' },
  { fact: 'Children who play puzzle and strategy games for 30–60 min/day show measurable improvements in working memory after 8 weeks.', source: 'Nature Human Behaviour, 2020' },
  { fact: 'Loot boxes meet the formal criteria for gambling in Belgium, the Netherlands, and the UK — banned for under-18s in those countries.', source: 'EGBA Report, 2023' },
]

// Ruled section kicker — top hairline + small-caps label.
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

// ─── Public component ─────────────────────────────────────────────────────────

type Props = {
  stats: CatalogStats
  swap?: SwapPair
}

export default function DiscoverPanels({ stats, swap }: Props) {
  const t  = useTranslations('discover')
  const te = useTranslations('editorial')

  return (
    <div className="space-y-14 mt-14 pb-6">
      <LumiScoreScale t={t} />
      <StatStrip stats={stats} t={t} kicker={te('byTheNumbers.kicker')} />
      {swap && <SafeSwap swap={swap} />}
      <DidYouKnow />
    </div>
  )
}
