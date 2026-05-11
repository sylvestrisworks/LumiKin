export const revalidate = 300

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { fetchSiteStats, fetchGamesScoredCount } from '@/lib/stats'
import { CURRENT_METHODOLOGY_VERSION } from '@/lib/methodology'
import CoverageStrip from './partners/_components/CoverageStrip'
import SearchBar from '@/components/SearchBar'
import FeaturedGame from './_components/FeaturedGame'
import ParentValueTiles from './_components/ParentValueTiles'
import BusinessRow from './_components/BusinessRow'

// Old homepage catalog params — redirect to /browse
const CATALOG_PARAMS = ['age', 'platform', 'platforms', 'sort', 'genres', 'benefits', 'risk']

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams

  if (CATALOG_PARAMS.some(p => sp[p] !== undefined)) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === 'string') qs.set(k, v)
    }
    redirect(`/${locale}/browse?${qs.toString()}`)
  }

  const [stats, gamesScored] = await Promise.all([
    fetchSiteStats(),
    fetchGamesScoredCount(),
  ])

  return (
    <div className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">

      {/* ── Hero (parent-first) ──────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-14">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl">
          Know what your kid is actually playing.
        </h1>
        <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl leading-relaxed">
          Search {gamesScored.toLocaleString('en')} games. See the benefits, the risks,
          and a healthy time per session. Free for parents.
        </p>

        <div className="mt-8 max-w-xl relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl blur-2xl bg-indigo-300/40 dark:bg-indigo-500/20"
          />
          <SearchBar placeholder="Search a game your kid plays…" />
        </div>

        <div className="mt-5">
          <Link
            href={`/${locale}/browse`}
            className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline underline-offset-4 hover:no-underline"
          >
            Browse all games →
          </Link>
        </div>
      </section>

      {/* ── Featured game (show, don't tell) ─────────────────────────────────── */}
      <FeaturedGame locale={locale} />

      {/* ── Or browse by (demoted secondary entries) ─────────────────────────── */}
      <section className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mr-1">
            Or browse by
          </span>
          {[
            { label: 'Age', href: `/${locale}/age` },
            { label: 'Roblox experiences', href: `/${locale}/platform/roblox` },
            { label: 'Fortnite Creative', href: `/${locale}/platform/fortnite` },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="text-sm px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/* ── What you'll see ──────────────────────────────────────────────────── */}
      <ParentValueTiles />

      {/* ── Coverage / trust strip ───────────────────────────────────────────── */}
      <CoverageStrip stats={stats} variant="parent" />

      {/* ── Methodology (compressed) ─────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-5xl mx-auto px-6 py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-6">
            How scores work
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
            Every game is scored on developmental benefits and design risks across 60 sub-dimensions
            from a public rubric. The two scores combine into a recommended session length —
            from 15 minutes to two hours — that reflects how the game is built, not a generic limit.
          </p>

          <details className="mt-5 max-w-2xl group">
            <summary className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer list-none flex items-center gap-2">
              <span className="group-open:rotate-90 transition-transform inline-block">›</span>
              The full breakdown
            </summary>
            <div className="mt-4 space-y-4 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <p>
                Benefits cover ten cognitive dimensions (problem solving, spatial awareness,
                strategic thinking, creativity, and more), six social-emotional dimensions
                (teamwork, communication, empathy, ethical reasoning), and four motor dimensions —
                weighted into a Benefits Development Score (BDS).
              </p>
              <p>
                Risks are scored across dopamine manipulation design (variable rewards, streaks,
                FOMO triggers), monetization pressure (pay-to-win, currency obfuscation,
                child-targeting), and social risk (stranger interaction, toxic competition,
                identity pressure) — combined into a Risk Influence Score (RIS).
              </p>
            </div>
          </details>

          <div className="mt-8 flex flex-wrap gap-6">
            <Link
              href={`/${locale}/methodology`}
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 underline underline-offset-4 hover:no-underline"
            >
              Read the full methodology →
            </Link>
            <a
              href={`/lumikin-methodology-v${CURRENT_METHODOLOGY_VERSION}.pdf`}
              download
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 underline underline-offset-4 hover:no-underline"
            >
              Download PDF →
            </a>
          </div>
        </div>
      </section>

      {/* ── For partners / press (business, but tasteful) ────────────────────── */}
      <BusinessRow locale={locale} />

    </div>
  )
}
