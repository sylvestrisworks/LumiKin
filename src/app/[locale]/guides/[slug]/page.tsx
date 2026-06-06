import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { sanityClient } from '@/sanity/lib/client'
import { guideBySlugQuery } from '@/sanity/lib/queries'
import { urlFor } from '@/sanity/lib/image'
import PortableTextRenderer from '@/components/PortableTextRenderer'
import { CalendarDays, Tag } from 'lucide-react'

export const revalidate = 3600

type Props = { params: Promise<{ locale: string; slug: string }> }

const CATEGORY_LABELS: Record<string, string> = {
  'screen-time': 'Screen Time',
  'game-safety': 'Game Safety',
  'age-guide': 'Age Guide',
  'parenting-tips': 'Parenting Tips',
}

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params
  const guide = await sanityClient?.fetch(guideBySlugQuery, { slug, locale }).catch(() => null) ?? null
  if (!guide) return { title: 'Guide not found — LumiKin' }

  const title = guide.seoTitle ?? `${guide.title} | LumiKin`
  const description = guide.seoDescription ?? guide.excerpt ?? `A parenting guide: ${guide.title}`

  return {
    title,
    description,
    alternates: { canonical: `/${locale}/guides/${slug}` },
    openGraph: {
      title,
      description,
      url: `/${locale}/guides/${slug}`,
      images: guide.coverImage?.asset
        ? [{ url: urlFor(guide.coverImage)!.width(1200).height(630).auto('format').url() }]
        : undefined,
    },
  }
}

export default async function GuidePage({ params }: Props) {
  const [{ slug }, locale, tNav, tGuides] = await Promise.all([
    params,
    getLocale(),
    getTranslations('game'),
    getTranslations('guides'),
  ])
  const guide = await sanityClient?.fetch(guideBySlugQuery, { slug, locale }).catch(() => null) ?? null
  if (!guide) notFound()

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: tNav('navHome'),              item: `${SITE_URL}/${locale}` },
      { '@type': 'ListItem', position: 2, name: tGuides('breadcrumbLearn'),   item: `${SITE_URL}/${locale}/learn` },
      { '@type': 'ListItem', position: 3, name: tGuides('breadcrumbCurrent'), item: `${SITE_URL}/${locale}/guides` },
      { '@type': 'ListItem', position: 4, name: guide.title,                  item: `${SITE_URL}/${locale}/guides/${slug}` },
    ],
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') }}
      />
      <div className="max-w-2xl mx-auto px-4 py-10">

        <nav
          className="mb-6 flex items-center gap-1.5 text-kicker uppercase text-muted"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          <Link href={`/${locale}`} className="hover:text-accent transition-colors">
            {tNav('navHome')}
          </Link>
          <span aria-hidden className="text-rule">/</span>
          <Link href={`/${locale}/learn`} className="hover:text-accent transition-colors">
            {tGuides('breadcrumbLearn')}
          </Link>
          <span aria-hidden className="text-rule">/</span>
          <Link href={`/${locale}/guides`} className="hover:text-accent transition-colors">
            {tGuides('breadcrumbCurrent')}
          </Link>
          <span aria-hidden className="text-rule">/</span>
          <span className="text-ink truncate">{guide.title}</span>
        </nav>

        {/* ── Meta ─────────────────────────────────────────────────────── */}
        <div className="mb-6 border-b border-ink pb-6">
          {guide.category && (
            <span
              className="inline-flex items-center gap-1.5 text-kicker uppercase font-semibold text-accent mb-3"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              <Tag size={11} />
              {CATEGORY_LABELS[guide.category] ?? guide.category}
            </span>
          )}
          <h1 className="font-serif text-display-sm md:text-display text-ink leading-tight mb-3">
            {guide.title}
          </h1>
          {guide.excerpt && (
            <p className="font-serif italic text-lg text-muted leading-relaxed">{guide.excerpt}</p>
          )}
          {guide.publishedAt && (
            <div className="flex items-center gap-1.5 text-kicker uppercase text-muted mt-3" style={{ fontVariantCaps: 'all-small-caps' }}>
              <CalendarDays size={12} />
              {formatDate(guide.publishedAt)}
            </div>
          )}
        </div>

        {/* ── Cover image ──────────────────────────────────────────────── */}
        {guide.coverImage?.asset && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlFor(guide.coverImage)!.width(800).auto('format').url()}
            alt={guide.coverImage.alt ?? guide.title}
            className="w-full mb-8"
          />
        )}

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {guide.body && (
          <article className="max-w-prose">
            <PortableTextRenderer value={guide.body} />
          </article>
        )}

        <div className="mt-10 border-t border-ink pt-4">
          <Link
            href={`/${locale}/guides`}
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            ← Back to Guides
          </Link>
        </div>

      </div>
    </main>
  )
}
