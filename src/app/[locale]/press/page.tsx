export const revalidate = 3600

import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { fetchSiteStats, type SiteStats } from '@/lib/stats'
import { CURRENT_METHODOLOGY_VERSION, RUBRIC_DIMENSION_COUNT, METHODOLOGY_PDF_PATH } from '@/lib/methodology'
import PlausibleGoal from '@/components/PlausibleGoal'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'press' })
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const title    = t('metaTitle' as any)
  const desc     = t('metaDescription' as any)
  const ogDesc   = t('ogDescription' as any)
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: ogDesc,
      type: 'website',
      url: `${SITE_URL}/${locale}/press`,
    },
  }
}

// ─── Brand ───────────────────────────────────────────────────────────────────

const ONE_LINE =
  'LumiKin rates video games on developmental benefits and design risks, giving parents a single evidence-based time recommendation for every title.'

const ONE_PARAGRAPH =
  `LumiKin is a structured game-rating engine for parents. Every game in the database is scored across ${RUBRIC_DIMENSION_COUNT} dimensions — covering cognitive skills, social-emotional growth, motor development, and design risks including dopamine manipulation, monetisation pressure, and social risk. The output is a single LumiScore (0–100), a daily time recommendation, and a set of machine-readable flags. Ratings are produced against the LumiKin methodology, a versioned open rubric, and are available both via a consumer website and a structured API for parental-control vendors and platform operators.`

const PALETTE = [
  { name: 'Editorial Red', hex: '#c8102e', textClass: 'text-white',      usage: 'Accent — spark mark, links, CTAs'  },
  { name: 'Ink',           hex: '#14110f', textClass: 'text-white',      usage: 'Wordmark, body text on paper'      },
  { name: 'Paper',         hex: '#f7f1e8', textClass: 'text-slate-800',  usage: 'Page background, light surfaces'   },
  { name: 'Ochre',         hex: '#94591c', textClass: 'text-white',      usage: 'Secondary accent, badges'          },
  { name: 'Rule',          hex: '#b8aea0', textClass: 'text-slate-800',  usage: 'Hairlines, dividers'               },
]

// ─── Static facts — founder fills these in ───────────────────────────────────

const FOUNDER_NAME     = 'Johan'           // update with full name when public
const FOUNDING_YEAR    = '2025'
const LOCATION         = 'Stockholm, Sweden'
const PRESS_EMAIL      = 'johan@sylvestris.works'
const RESPONSE_TIME    = '1 business day'

type QuotableFact = { fact: string; source: string | null; sourceLabel: string | null }

// Quotable facts are derived from LumiKin's own database and methodology at request
// time — no fabricated statistics or external claims. Each carries a verifiable source
// LumiKin can stand behind (its live coverage stats and its published rubric).
function buildQuotableFacts(stats: SiteStats): QuotableFact[] {
  const totalTitles = stats.total_games_scored + stats.total_ugc_experiences_scored
  const facts: QuotableFact[] = [
    {
      fact: `LumiKin has scored ${totalTitles.toLocaleString('en')} titles to date — ${stats.total_games_scored.toLocaleString('en')} mainstream games across ${stats.platforms.length} platforms and ${stats.total_ugc_experiences_scored.toLocaleString('en')} Roblox and Fortnite Creative experiences that carry no ESRB or PEGI rating.`,
      source: '/press#at-a-glance',
      sourceLabel: 'LumiKin database (updated hourly)',
    },
    {
      fact: `Every title is scored across ${RUBRIC_DIMENSION_COUNT} structured dimensions — covering cognitive, social-emotional and motor development alongside dopamine-manipulation, monetisation and social-risk design — under a single published, versioned rubric.`,
      source: '/methodology',
      sourceLabel: `LumiKin Methodology v${CURRENT_METHODOLOGY_VERSION}`,
    },
  ]
  if (stats.median_hours_publish_to_score_ugc != null) {
    facts.push({
      fact: `The median time from a Roblox or Fortnite Creative experience being published to receiving a LumiKin score is ${stats.median_hours_publish_to_score_ugc} hours.`,
      source: '/press#at-a-glance',
      sourceLabel: 'LumiKin database (updated hourly)',
    })
  }
  return facts
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FALLBACK_STATS: SiteStats = {
  total_games_scored: 0, scored_last_7_days: 0, scored_last_30_days: 0,
  platforms: [], languages: [],
  total_ugc_experiences_scored: 0, ugc_scored_last_7_days: 0, ugc_scored_last_30_days: 0,
  ugc_by_parent_platform: [], median_hours_publish_to_score_ugc: null,
}

type Props = { params: Promise<{ locale: string }> }

export default async function PressPage({ params }: Props) {
  const { locale } = await params
  const stats = await fetchSiteStats().catch(() => FALLBACK_STATS)

  const totalTitles   = stats.total_games_scored + stats.total_ugc_experiences_scored
  const platformCount = stats.platforms.length
  const languageCount = stats.languages.length
  const quotableFacts = buildQuotableFacts(stats)

  const AT_A_GLANCE = [
    { label: 'Titles scored',        value: totalTitles.toLocaleString('en')                    },
    { label: 'Scored last 7 days',   value: stats.scored_last_7_days.toLocaleString('en')       },
    { label: 'Platforms covered',    value: platformCount.toLocaleString('en')                   },
    { label: 'Languages',            value: languageCount.toLocaleString('en')                   },
    { label: 'Founded',              value: FOUNDING_YEAR                                         },
    { label: 'Founder',              value: FOUNDER_NAME                                          },
    { label: 'Methodology version',  value: `LumiKin v${CURRENT_METHODOLOGY_VERSION}`              },
    { label: 'Location',             value: LOCATION                                              },
  ]

  return (
    <div className="bg-paper text-ink">
      <PlausibleGoal goal="press_kit_view" />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <p className="text-kicker uppercase font-semibold text-muted mb-6">
          Press Kit
        </p>
        <h1 className="font-serif text-display sm:text-display-lg tracking-tight leading-tight max-w-3xl">
          Everything you need to write about LumiKin.
        </h1>
        <p className="mt-6 font-serif italic text-lg text-muted max-w-2xl leading-relaxed">
          Brand assets, coverage stats, copy-ready descriptions, and a direct contact. No PR agency, no waiting.
        </p>
      </section>

      {/* ── About LumiKin ────────────────────────────────────────────────────── */}
      <section className="border-t border-ink">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-kicker uppercase font-semibold text-muted mb-8">
            About LumiKin
          </p>
          <blockquote className="font-serif text-xl sm:text-2xl leading-relaxed text-ink max-w-3xl border-l-2 border-accent pl-6">
            {ONE_PARAGRAPH}
          </blockquote>
          <p className="mt-6 text-sm text-muted">
            This paragraph may be reproduced in full without attribution.
          </p>
        </div>
      </section>

      {/* ── At a glance ──────────────────────────────────────────────────────── */}
      <section id="at-a-glance" className="border-t border-ink bg-paper scroll-mt-20">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-kicker uppercase font-semibold text-muted mb-10">
            At a glance
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-10 gap-x-6 sm:divide-x sm:divide-rule">
            {AT_A_GLANCE.map(({ label, value }, i) => (
              <div key={label} className={i % 4 !== 0 ? 'sm:pl-8' : ''}>
                <p className="font-serif text-3xl tabular-nums text-ink leading-none">
                  {value}
                </p>
                <p className="text-kicker uppercase font-semibold text-muted mt-2">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs text-muted">
            Coverage stats update hourly. All other values are as of the date of publication.
          </p>
        </div>
      </section>

      {/* ── Quotable facts ───────────────────────────────────────────────────── */}
      <section className="border-t border-ink">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-kicker uppercase font-semibold text-muted mb-10">
            Quotable facts
          </p>
          <ol className="space-y-8">
            {quotableFacts.map(({ fact, source, sourceLabel }, i) => (
              <li key={i} className="flex gap-5">
                <span className="font-serif text-2xl text-rule shrink-0 w-6 text-right leading-tight">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-serif text-base sm:text-lg text-ink leading-relaxed">
                    {fact}
                  </p>
                  {source && sourceLabel && (
                    <a
                      href={source}
                      className="mt-1 inline-block text-sm text-accent underline underline-offset-2 hover:no-underline"
                    >
                      Source: {sourceLabel}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Brand assets ─────────────────────────────────────────────────────── */}
      <section className="border-t border-ink bg-paper">
        <div className="max-w-5xl mx-auto px-6 py-16 space-y-16">

          {/* Logos */}
          <div>
            <p className="text-kicker uppercase font-semibold text-muted mb-8">
              Logos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

              {/* Light wordmark */}
              <div className="border border-rule overflow-hidden">
                <div className="bg-white flex items-center justify-center px-8 py-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/lumikin-logo.svg" alt="LumiKin logo" height={48} style={{ height: 48, width: 'auto' }} />
                </div>
                <div className="border-t border-rule px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Wordmark — light</span>
                  <a
                    href="/lumikin-logo.svg"
                    download
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    SVG ↓
                  </a>
                </div>
              </div>

              {/* Dark wordmark */}
              <div className="border border-rule overflow-hidden">
                <div className="bg-slate-950 flex items-center justify-center px-8 py-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/lumikin-logo-dark.svg" alt="LumiKin logo (dark)" height={48} style={{ height: 48, width: 'auto' }} />
                </div>
                <div className="border-t border-rule px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Wordmark — dark</span>
                  <a
                    href="/lumikin-logo-dark.svg"
                    download
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    SVG ↓
                  </a>
                </div>
              </div>

              {/* Icon */}
              <div className="border border-rule overflow-hidden">
                <div className="bg-white flex items-center justify-center px-8 py-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/lumikin-icon.svg" alt="LumiKin icon" height={48} style={{ height: 48, width: 'auto' }} />
                </div>
                <div className="border-t border-rule px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Spark mark (icon)</span>
                  <a
                    href="/lumikin-icon.svg"
                    download
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    SVG ↓
                  </a>
                </div>
              </div>

            </div>
            <p className="mt-4 text-xs text-muted">
              PNG versions available on request. Do not modify the logo or recolour the spark mark.
            </p>
          </div>

          {/* Colour palette */}
          <div>
            <p className="text-kicker uppercase font-semibold text-muted mb-8">
              Colour palette
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {PALETTE.map(({ name, hex, textClass, usage }) => (
                <div key={hex} className="overflow-hidden border border-rule">
                  <div
                    className="h-20 flex items-end px-3 pb-2"
                    style={{ backgroundColor: hex }}
                  >
                    <span className={`text-xs font-black font-mono ${textClass}`}>{hex}</span>
                  </div>
                  <div className="px-3 py-2.5 bg-paper">
                    <p className="text-xs font-semibold text-ink">{name}</p>
                    <p className="text-[10px] text-muted mt-0.5 leading-tight">{usage}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Copy-ready descriptions */}
          <div>
            <p className="text-kicker uppercase font-semibold text-muted mb-8">
              Copy-ready descriptions
            </p>
            <div className="space-y-6">
              <div>
                <p className="text-kicker uppercase font-semibold text-muted mb-2">One line</p>
                <div className="border border-rule px-4 py-3">
                  <p className="text-sm text-ink select-all leading-relaxed">
                    {ONE_LINE}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-kicker uppercase font-semibold text-muted mb-2">One paragraph</p>
                <div className="border border-rule px-4 py-4">
                  <p className="text-sm text-ink select-all leading-relaxed">
                    {ONE_PARAGRAPH}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted">
              Click to select. Both descriptions may be reproduced without attribution.
            </p>
          </div>

        </div>
      </section>

      {/* ── Methodology ───────────────────────────────────────────────────────── */}
      <section className="border-t border-ink">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-kicker uppercase font-semibold text-muted mb-8">
            Methodology
          </p>
          <p className="text-ink/80 max-w-2xl leading-relaxed mb-8">
            LumiKin scores are produced against the LumiKin rubric, a structured framework covering
            developmental benefits (BDS) and design risks (RIS). Every score carries a methodology version
            identifier. The full rubric is publicly available.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href={`/${locale}/methodology`}
              className="inline-flex items-center bg-ink px-5 py-2.5 text-kicker uppercase font-semibold text-paper hover:bg-accent transition-colors"
            >
              Read methodology v{CURRENT_METHODOLOGY_VERSION} →
            </Link>
            <a
              href={METHODOLOGY_PDF_PATH}
              download
              className="inline-flex items-center border border-rule px-5 py-2.5 text-kicker uppercase font-semibold text-ink hover:border-ink hover:text-accent transition-colors"
            >
              Download PDF ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── Feeds ────────────────────────────────────────────────────────────── */}
      <section className="border-t border-ink">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-kicker uppercase font-semibold text-muted mb-8">
            Live feeds
          </p>
          <p className="text-ink/80 text-sm max-w-lg mb-8 leading-relaxed">
            Subscribe to the 50 most recently scored games. Updates within an hour of new scores landing.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="/feed.xml"
              className="inline-flex items-center gap-2 border border-rule px-5 py-2.5 text-kicker uppercase font-semibold text-ink hover:border-ink hover:text-accent transition-colors"
            >
              RSS feed ↗
            </a>
            <a
              href="/feed.json"
              className="inline-flex items-center gap-2 border border-rule px-5 py-2.5 text-kicker uppercase font-semibold text-ink hover:border-ink hover:text-accent transition-colors"
            >
              JSON Feed ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── Press contact ────────────────────────────────────────────────────── */}
      <section className="border-t border-ink bg-paper">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-kicker uppercase font-semibold text-muted mb-8">
            Press contact
          </p>
          <div className="max-w-sm space-y-4">
            <div>
              <p className="text-kicker uppercase font-semibold text-muted mb-1">Name</p>
              <p className="font-serif text-lg text-ink">{FOUNDER_NAME}, Founder</p>
            </div>
            <div>
              <p className="text-kicker uppercase font-semibold text-muted mb-1">Email</p>
              <a
                href={`mailto:${PRESS_EMAIL}`}
                className="text-lg font-semibold text-accent hover:underline"
              >
                {PRESS_EMAIL}
              </a>
            </div>
            <div>
              <p className="text-kicker uppercase font-semibold text-muted mb-1">Response time</p>
              <p className="text-base text-ink/80">{RESPONSE_TIME}</p>
            </div>
            <div>
              <p className="text-kicker uppercase font-semibold text-muted mb-1">What to include</p>
              <p className="text-sm text-muted leading-relaxed">
                Publication name, story angle, and deadline. We prioritise requests with a specific publish date.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
