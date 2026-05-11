export const revalidate = 3600

import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchSiteStats, type SiteStats } from '@/lib/stats'
import { CURRENT_METHODOLOGY_VERSION, RUBRIC_DIMENSION_COUNT } from '@/lib/methodology'
import PlausibleGoal from '@/components/PlausibleGoal'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
const PAGE_URL = `${SITE_URL}/en/press`

export const metadata: Metadata = {
  title: 'Press Kit — LumiKin',
  description:
    'Brand assets, coverage stats, quotable facts, and press contact for LumiKin — the structured game-rating engine for parents.',
  openGraph: {
    title: 'Press Kit — LumiKin',
    description:
      'Brand assets, coverage stats, quotable facts, and press contact for LumiKin.',
    type: 'website',
    url: PAGE_URL,
  },
}

// ─── Brand ───────────────────────────────────────────────────────────────────

const ONE_LINE =
  'LumiKin rates video games on developmental benefits and design risks, giving parents a single evidence-based time recommendation for every title.'

const ONE_PARAGRAPH =
  `LumiKin is a structured game-rating engine for parents. Every game in the database is scored across ${RUBRIC_DIMENSION_COUNT} dimensions — covering cognitive skills, social-emotional growth, motor development, and design risks including dopamine manipulation, monetisation pressure, and social risk. The output is a single LumiScore (0–100), a daily time recommendation, and a set of machine-readable flags. Ratings are produced against the LumiKin methodology, a versioned open rubric, and are available both via a consumer website and a structured API for parental-control vendors and platform operators.`

const PALETTE = [
  { name: 'Indigo',      hex: '#4f46e5', textClass: 'text-white', usage: 'Logo mark, primary links, CTAs'    },
  { name: 'Violet',      hex: '#7c3aed', textClass: 'text-white', usage: 'Gradient end, accent highlights'   },
  { name: 'Slate Dark',  hex: '#0f172a', textClass: 'text-white', usage: 'Wordmark, body text on light bg'   },
  { name: 'White',       hex: '#ffffff', textClass: 'text-slate-800', usage: 'Page background, light surfaces' },
  { name: 'Zinc 950',    hex: '#09090b', textClass: 'text-white', usage: 'Dark-mode background'              },
]

// ─── Static facts — founder fills these in ───────────────────────────────────

const FOUNDER_NAME     = 'Johan'           // update with full name when public
const FOUNDING_YEAR    = '2025'
const LOCATION         = 'Stockholm, Sweden'
const PRESS_EMAIL      = 'johan@sylvestris.works'
const RESPONSE_TIME    = '1 business day'

// Scaffold — replace placeholder text with real statements before launch
const QUOTABLE_FACTS: { fact: string; source: string | null; sourceLabel: string | null }[] = [
  {
    fact: '[Placeholder — e.g. "Nine out of ten top-grossing mobile games target under-13s with at least one monetisation mechanic."]',
    source: null,
    sourceLabel: null,
  },
  {
    fact: '[Placeholder — e.g. "LumiKin\'s database covers X mainstream titles and Y Roblox experiences, making it the largest structured child-safety rating set outside of ESRB and PEGI."]',
    source: null,
    sourceLabel: null,
  },
  {
    fact: '[Placeholder — e.g. "The average daily-time recommendation produced by LumiKin\'s scoring model is X minutes — compared to the X–X minutes parents report their children actually play."]',
    source: null,
    sourceLabel: null,
  },
  {
    fact: '[Placeholder — e.g. "UGC platforms like Roblox now account for a majority of gaming time for children under 12, yet carry no ESRB or PEGI rating."]',
    source: null,
    sourceLabel: null,
  },
]

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
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <PlausibleGoal goal="press_kit_view" />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-6">
          Press Kit
        </p>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl">
          Everything you need to write about LumiKin.
        </h1>
        <p className="mt-6 text-lg text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
          Brand assets, coverage stats, copy-ready descriptions, and a direct contact. No PR agency, no waiting.
        </p>
      </section>

      {/* ── About LumiKin ────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8">
            About LumiKin
          </p>
          <blockquote className="text-xl sm:text-2xl font-medium leading-relaxed text-slate-800 dark:text-slate-100 max-w-3xl border-l-4 border-indigo-500 pl-6">
            {ONE_PARAGRAPH}
          </blockquote>
          <p className="mt-6 text-sm text-slate-400 dark:text-slate-500">
            This paragraph may be reproduced in full without attribution.
          </p>
        </div>
      </section>

      {/* ── At a glance ──────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-10">
            At a glance
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-10 gap-x-6 sm:divide-x sm:divide-slate-200 sm:dark:divide-slate-700">
            {AT_A_GLANCE.map(({ label, value }, i) => (
              <div key={label} className={i % 4 !== 0 ? 'sm:pl-8' : ''}>
                <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-slate-100 leading-none">
                  {value}
                </p>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-2">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs text-slate-400 dark:text-slate-500">
            Coverage stats update hourly. All other values are as of the date of publication.
          </p>
        </div>
      </section>

      {/* ── Quotable facts ───────────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-10">
            Quotable facts
          </p>
          <ol className="space-y-8">
            {QUOTABLE_FACTS.map(({ fact, source, sourceLabel }, i) => (
              <li key={i} className="flex gap-5">
                <span className="text-2xl font-black text-slate-200 dark:text-slate-700 shrink-0 w-6 text-right leading-tight">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                    {fact}
                  </p>
                  {source && sourceLabel && (
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-sm text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:no-underline"
                    >
                      Source: {sourceLabel}
                    </a>
                  )}
                  {!source && (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 italic">
                      Source link to be added
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Brand assets ─────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-5xl mx-auto px-6 py-16 space-y-16">

          {/* Logos */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8">
              Logos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

              {/* Light wordmark */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-white flex items-center justify-center px-8 py-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/lumikin-logo.svg" alt="LumiKin logo" height={48} style={{ height: 48, width: 'auto' }} />
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Wordmark — light</span>
                  <a
                    href="/lumikin-logo.svg"
                    download
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    SVG ↓
                  </a>
                </div>
              </div>

              {/* Dark wordmark */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-slate-950 flex items-center justify-center px-8 py-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/lumikin-logo-dark.svg" alt="LumiKin logo (dark)" height={48} style={{ height: 48, width: 'auto' }} />
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Wordmark — dark</span>
                  <a
                    href="/lumikin-logo-dark.svg"
                    download
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    SVG ↓
                  </a>
                </div>
              </div>

              {/* Icon */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-white flex items-center justify-center px-8 py-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/lumikin-icon.svg" alt="LumiKin icon" height={48} style={{ height: 48, width: 'auto' }} />
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Spark mark (icon)</span>
                  <a
                    href="/lumikin-icon.svg"
                    download
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    SVG ↓
                  </a>
                </div>
              </div>

            </div>
            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              PNG versions available on request. Do not modify the logo or recolour the spark mark gradient.
            </p>
          </div>

          {/* Colour palette */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8">
              Colour palette
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {PALETTE.map(({ name, hex, textClass, usage }) => (
                <div key={hex} className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  <div
                    className="h-20 flex items-end px-3 pb-2"
                    style={{ backgroundColor: hex }}
                  >
                    <span className={`text-xs font-black font-mono ${textClass}`}>{hex}</span>
                  </div>
                  <div className="px-3 py-2.5 bg-white dark:bg-slate-950">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">{usage}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Copy-ready descriptions */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8">
              Copy-ready descriptions
            </p>
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">One line</p>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3">
                  <p className="text-sm text-slate-800 dark:text-slate-200 select-all leading-relaxed">
                    {ONE_LINE}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">One paragraph</p>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-4">
                  <p className="text-sm text-slate-800 dark:text-slate-200 select-all leading-relaxed">
                    {ONE_PARAGRAPH}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              Click to select. Both descriptions may be reproduced without attribution.
            </p>
          </div>

        </div>
      </section>

      {/* ── Methodology ───────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8">
            Methodology
          </p>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed mb-8">
            LumiKin scores are produced against the LumiKin rubric, a structured framework covering
            developmental benefits (BDS) and design risks (RIS). Every score carries a methodology version
            identifier. The full rubric is publicly available.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href={`/${locale}/methodology`}
              className="inline-flex items-center rounded-md bg-slate-900 dark:bg-slate-100 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors"
            >
              Read methodology v{CURRENT_METHODOLOGY_VERSION} →
            </Link>
            <a
              href={`/lumikin-methodology-v${CURRENT_METHODOLOGY_VERSION}.pdf`}
              download
              className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              Download PDF ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── Feeds ────────────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8">
            Live feeds
          </p>
          <p className="text-slate-600 dark:text-slate-300 text-sm max-w-lg mb-8 leading-relaxed">
            Subscribe to the 50 most recently scored games. Updates within an hour of new scores landing.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="/feed.xml"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              RSS feed ↗
            </a>
            <a
              href="/feed.json"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              JSON Feed ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── Press contact ────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8">
            Press contact
          </p>
          <div className="max-w-sm space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Name</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{FOUNDER_NAME}, Founder</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Email</p>
              <a
                href={`mailto:${PRESS_EMAIL}`}
                className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {PRESS_EMAIL}
              </a>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Response time</p>
              <p className="text-base text-slate-700 dark:text-slate-300">{RESPONSE_TIME}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">What to include</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Publication name, story angle, and deadline. We prioritise requests with a specific publish date.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
