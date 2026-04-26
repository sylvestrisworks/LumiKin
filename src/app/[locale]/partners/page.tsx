import type { Metadata } from 'next'
import { fetchSiteStats } from '@/lib/stats'
import { CURRENT_METHODOLOGY_VERSION } from '@/lib/methodology'
import CoverageStrip from './_components/CoverageStrip'
import ContactForm from './_components/ContactForm'
import ApiSampleBlock from './_components/ApiSampleBlock'
import PlausibleGoal from '@/components/PlausibleGoal'

export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
const PAGE_URL = `${SITE_URL}/en/partners`
const OG_TITLE = 'LumiKin for Partners — Child-safety game ratings API'
const OG_DESC  = 'Structured child-safety ratings for every game, delivered via API. Covers mainstream titles and UGC platforms. Built for parental control vendors, ISPs, app stores, and education platforms.'

export const metadata: Metadata = {
  title: OG_TITLE,
  description: OG_DESC,
  openGraph: {
    title: OG_TITLE,
    description: OG_DESC,
    type: 'website',
    url: PAGE_URL,
    images: [{ url: '/api/og/partners', width: 1200, height: 630, alt: 'LumiKin for Partners' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: OG_DESC,
    images: ['/api/og/partners'],
  },
}

// TODO: replace placeholder sameAs URLs with real profiles once accounts exist
const ORG_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'LumiKin',
  url: SITE_URL,
  description:
    'LumiKin provides structured child-safety ratings and a game analysis API for parental control vendors, ISPs, app stores, and education platforms. The PlaySmart methodology scores games on developmental benefits and design risks, producing versioned, machine-readable ratings.',
  logo: `${SITE_URL}/lumikin-logo.svg`,
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'sales',
    email: 'johan@sylvestris.works',
    url: `${PAGE_URL}#contact`,
  },
  sameAs: [
    'https://www.linkedin.com/company/lumikin',
    'https://x.com/lumikin',
    'https://bsky.app/profile/lumikin.org',
  ],
}

const SERVICE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'LumiKin Game Rating API',
  description:
    'A structured API providing child-safety ratings for video games and UGC platforms. Covers cognitive development, social-emotional benefits, dopamine manipulation design, monetization pressure, and social risk. Every score is versioned against the PlaySmart methodology.',
  serviceType: 'API',
  provider: {
    '@type': 'Organization',
    name: 'LumiKin',
    url: SITE_URL,
  },
  areaServed: 'Worldwide',
  url: PAGE_URL,
}

const WHO_CARDS = [
  {
    heading: 'Parental control vendors',
    body: 'Drop-in API for filtering decisions that won\'t embarrass your brand.',
  },
  {
    heading: 'ISPs and family-safety products',
    body: 'Coverage that keeps up with UGC platforms.',
  },
  {
    heading: 'App stores and platforms',
    body: 'Age-appropriate ratings beyond PEGI and ESRB.',
  },
  {
    heading: 'Schools and education',
    body: 'Defensible content decisions for staff and parents.',
  },
]

export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const stats = await fetchSiteStats()

  return (
    <div className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <PlausibleGoal goal="partners_page_view" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SERVICE_SCHEMA) }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-6">
          LumiKin for Business
        </p>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl">
          Child-safety ratings for every game — including the ones nobody else has rated yet.
        </h1>
        <p className="mt-6 text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
          LumiKin scores games on developmental benefits and design risks using a structured,
          versioned methodology. We deliver those scores via API so your product can make
          defensible, evidence-based filtering and recommendation decisions at scale.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#contact"
            className="inline-flex items-center rounded-md bg-zinc-900 dark:bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            Get in touch
          </a>
          <a
            href="#api-preview"
            className="inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            See the API
          </a>
        </div>
      </section>

      {/* ── Live coverage strip ───────────────────────────────────────────────── */}
      <CoverageStrip stats={stats} />

      {/* ── Who this is for ───────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-10">
          Who this is for
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {WHO_CARDS.map(({ heading, body }) => (
            <div
              key={heading}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-3"
            >
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                {heading}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Methodology ───────────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-8">
            Methodology
          </h2>
          <div className="max-w-2xl space-y-5 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              Every game is evaluated against the PlaySmart framework — a structured rubric
              covering ten cognitive dimensions (problem solving, spatial awareness, strategic
              thinking, creativity, and more), six social-emotional dimensions (teamwork,
              communication, empathy, ethical reasoning), and four motor dimensions. Each
              dimension is scored independently by trained reviewers, then weighted and combined
              into a Benefits Development Score (BDS).
            </p>
            <p>
              Risk is assessed separately across three scored categories: dopamine manipulation
              design (variable rewards, streak mechanics, FOMO triggers), monetization pressure
              (pay-to-win, currency obfuscation, child-targeting), and social risk (stranger
              interaction, toxic competition, identity pressure). A fourth category — content
              risk — is reported as a standalone flag and does not feed into the time
              recommendation, preserving compatibility with existing ESRB and PEGI ratings.
              These three risk categories combine into a Risk Influence Score (RIS).
            </p>
            <p>
              The time recommendation is derived from the interaction between BDS and RIS across
              five tiers (15 to 120 minutes). High benefit scores can extend a recommendation by
              one tier; low benefit paired with elevated risk drops it. Every score carries a
              methodology version identifier so downstream products can track and re-evaluate
              when the rubric updates.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap gap-4 items-center">
            {/* TODO (Step 11): link to /methodology once page exists */}
            <a
              href={`/${locale}/methodology`}
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 underline underline-offset-4 hover:no-underline"
            >
              Read the full methodology →
            </a>
            <a
              href={`/lumikin-methodology-v${CURRENT_METHODOLOGY_VERSION}.pdf`}
              download
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 underline underline-offset-4 hover:no-underline"
            >
              Download methodology PDF →
            </a>
          </div>
        </div>
      </section>

      {/* ── API preview ───────────────────────────────────────────────────────── */}
      <section id="api-preview" className="max-w-5xl mx-auto px-6 py-20">
        <div className="flex flex-wrap items-baseline gap-4 mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            API preview
          </h2>
          <span className="text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
            Launching Q2 2026
          </span>
        </div>
        <ApiSampleBlock />
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-4">
            Pricing
          </h2>
          <p className="text-zinc-600 dark:text-zinc-300 text-base">
            Pricing scales with query volume and coverage needs.{' '}
            <a href="#contact" className="font-semibold text-zinc-900 dark:text-zinc-100 underline underline-offset-4 hover:no-underline">
              Get in touch to discuss.
            </a>
          </p>
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────────────────────── */}
      <section id="contact" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
          Contact
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-10 max-w-lg">
          Tell us what you're building. We'll follow up within one business day.
        </p>
        <div className="max-w-2xl">
          <ContactForm />
        </div>
      </section>

      {/* ── B2B footer links ──────────────────────────────────────────────────── */}
      {/* Sits above the global locale footer. The shared footer has parent-facing links; */}
      {/* these are the B2B-specific ones. Split the global footer properly in a later step. */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-500 dark:text-zinc-400">
          {/* TODO (Step 11): /methodology */}
          <a href={`/${locale}/methodology`} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            Methodology
          </a>
          <a href={`/${locale}/press`} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            Press kit
          </a>
          <a href={`/${locale}/browse`} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            Game database
          </a>
        </div>
      </div>

    </div>
  )
}
