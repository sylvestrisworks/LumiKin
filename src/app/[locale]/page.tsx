export const revalidate = 300

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { fetchSiteStats } from '@/lib/stats'
import { Masthead } from '@/components/editorial'
import CoverageStrip from './partners/_components/CoverageStrip'
import EditorialHero from './_components/EditorialHero'
import Standfirst from './_components/Standfirst'
import TodaysReview from './_components/TodaysReview'
import ByTheNumbers from './_components/ByTheNumbers'
import TrackingRow from './_components/TrackingRow'
import DeskRow from './_components/DeskRow'
import MethodologyEditorial from './_components/MethodologyEditorial'
import BrowseByEditorial from './_components/BrowseByEditorial'

// Old homepage catalog params — redirect to /browse
const CATALOG_PARAMS = ['age', 'platform', 'platforms', 'sort', 'genres', 'benefits', 'risk']

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Homepage-specific metadata. Rewrites title + description per the SEO audit
// (docs/seo/2026-05-gsc-audit.md) to fix the 0.5% CTR on parent-intent queries
// — the previous root-layout default was generic. Emits hreflang alternates
// for all five supported locales.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const [t, stats] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    fetchSiteStats(),
  ])

  const title       = t('metaTitle')
  const description = t('metaDescription', { count: stats.total_games_scored })
  const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'

  const languages: Record<string, string> = {}
  for (const l of routing.locales) languages[l] = `${SITE_URL}/${l}`
  languages['x-default'] = `${SITE_URL}/en`

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${locale}`,
      siteName: 'LumiKin',
      type: 'website',
      locale,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
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

  const [stats, t, te] = await Promise.all([
    fetchSiteStats(),
    getTranslations('home'),
    getTranslations('editorial'),
  ])

  // Locale-aware Masthead. Sections link into the existing top-level routes;
  // labels + tagline come from the editorial namespace seeded in commit d7feeb86.
  const dateLocale = te('dateline.locale')
  const mastheadSections = [
    { href: `/${locale}/browse`,   label: te('masthead.sections.reviews')  },
    { href: `/${locale}/discover`, label: te('masthead.sections.discover') },
    { href: `/${locale}/guides`,   label: te('masthead.sections.guides')   },
    { href: `/${locale}/compare`,  label: te('masthead.sections.compare')  },
  ]
  const formatDateline = (d: Date) => {
    const day  = d.toLocaleDateString(dateLocale, { weekday: 'short' }).toUpperCase()
    const date = d.toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    return `${day} · ${date}`
  }

  // Organization + Brand JSON-LD. Registers "LumiKin" as a known entity and
  // ties the "LumiScore" product term to the brand — fixes the GSC pattern
  // where both branded queries underperform (lumikin 10% CTR at pos 1.75,
  // lumiscore stranded at pos 18). Emitted on every locale homepage.
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
  const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'LumiKin',
    url: SITE_URL,
    logo: `${SITE_URL}/lumikin-logo.svg`,
    description: 'Parent safety ratings for video games and Roblox/Fortnite experiences. LumiScore is LumiKin’s 0–100 metric covering benefits, risks, and recommended screen time.',
    brand: {
      '@type': 'Brand',
      name: 'LumiScore',
    },
  }
  // FAQ JSON-LD — three parent-intent questions surfaced as FAQPage schema.
  // Emitted on every locale; the faq* keys are populated in all 5 messages files.
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { q: t('faq1Question'), a: t('faq1Answer') },
      { q: t('faq2Question'), a: t('faq2Answer') },
      { q: t('faq3Question'), a: t('faq3Answer') },
    ].map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const ldJson = (obj: unknown) =>
    JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(organizationLd) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(faqLd) }} />

    {/* ── Editorial masthead (homepage only in PR1) ────────────────────────── */}
    <Masthead
      tagline={te('masthead.tagline')}
      sections={mastheadSections}
      formatDateline={formatDateline}
    />

    <div className="bg-paper text-ink">

      {/* ── Editorial hero (cover headline + search + browse link) ───────────── */}
      <EditorialHero locale={locale} />

      {/* ── Standfirst (editor's note — who we are, the promise) ─────────────── */}
      <Standfirst />

      {/* ── Today's review (editorial cover) ─────────────────────────────────── */}
      <TodaysReview locale={locale} />

      {/* ── By the numbers (anatomy of a LumiScore — Pudding-style spread) ────── */}
      <ByTheNumbers locale={locale} />

      {/* ── What we're tracking (3-up listing) ───────────────────────────────── */}
      <TrackingRow locale={locale} />

      {/* ── The desk (3-up Sanity guides) ────────────────────────────────────── */}
      <DeskRow locale={locale} />

      {/* ── Browse by (editorial directory) ──────────────────────────────────── */}
      <BrowseByEditorial locale={locale} />

      {/* ── How scores work (editorial methodology) ──────────────────────────── */}
      <MethodologyEditorial locale={locale} />

      {/* ── Coverage / trust strip (visual closer) ───────────────────────────── */}
      <CoverageStrip stats={stats} variant="parent" />

    </div>
    </>
  )
}
