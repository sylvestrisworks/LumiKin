export const revalidate = 3600

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { fetchSiteStats } from '@/lib/stats'
import { CURRENT_METHODOLOGY_VERSION } from '@/lib/methodology'
import CoverageStrip from './partners/_components/CoverageStrip'
import RecentlyScored from './_components/RecentlyScored'

// Old homepage catalog params — redirect to /browse
const CATALOG_PARAMS = ['age', 'platform', 'platforms', 'sort', 'genres', 'benefits', 'risk']

const PATH_CARDS = [
  {
    audience: 'For parents',
    heading: 'Browse ratings for 4,000+ games',
    body: 'Search by title, platform, or age group.',
    slug: 'browse',
    accent: false,
  },
  {
    audience: 'For partners',
    heading: 'Get child-safety ratings for your product',
    body: 'API for parental control vendors, ISPs, and platforms.',
    slug: 'partners',
    accent: true,
  },
  {
    audience: 'For journalists',
    heading: 'Coverage stats, methodology, press kit',
    body: 'Sourced data, PDF methodology, and contact info.',
    slug: 'press',
    accent: false,
  },
]

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

  const stats = await fetchSiteStats()

  return (
    <div className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-6">
          LumiKin
        </p>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl">
          Child-safety ratings for every game your kids play.
        </h1>
        <p className="mt-6 text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
          Every game scored on developmental benefits and design risks — so you know what your child
          is actually playing, and for how long. Free for parents.
        </p>
      </section>

      {/* ── Live stats strip ─────────────────────────────────────────────────── */}
      <CoverageStrip stats={stats} />

      {/* ── Recently scored ──────────────────────────────────────────────────── */}
      <RecentlyScored scores={stats.recent_scores} locale={locale} />

      {/* ── Three paths ──────────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {PATH_CARDS.map(({ audience, heading, body, slug, accent }) => (
              <Link
                key={audience}
                href={`/${locale}/${slug}`}
                className={[
                  'rounded-lg border p-6 flex flex-col gap-3 transition-all hover:shadow-sm',
                  accent
                    ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600',
                ].join(' ')}
              >
                <p className={`text-xs font-semibold uppercase tracking-widest ${accent ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'}`}>
                  {audience}
                </p>
                <h2 className="font-semibold leading-snug">{heading}</h2>
                <p className={`text-sm leading-relaxed flex-1 ${accent ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
                  {body}
                </p>
                <span className="text-sm font-semibold">
                  Explore →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Methodology summary ───────────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-8">
            How scores work
          </p>
          <div className="max-w-2xl space-y-5 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              Every game is evaluated against the PlaySmart framework — a structured rubric covering
              ten cognitive dimensions (problem solving, spatial awareness, strategic thinking,
              creativity, and more), six social-emotional dimensions (teamwork, communication,
              empathy, ethical reasoning), and four motor dimensions. Each dimension is scored
              independently by trained reviewers, then weighted and combined into a Benefits
              Development Score (BDS).
            </p>
            <p>
              Risk is assessed separately across three scored categories: dopamine manipulation
              design (variable rewards, streak mechanics, FOMO triggers), monetization pressure
              (pay-to-win, currency obfuscation, child-targeting), and social risk (stranger
              interaction, toxic competition, identity pressure). These combine into a Risk Influence
              Score (RIS). The final time recommendation is derived from the interaction between BDS
              and RIS across five tiers — 15 to 120 minutes per session.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap gap-6">
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

    </div>
  )
}
