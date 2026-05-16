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
  const guide = await sanityClient?.fetch(guideBySlugQuery, { slug }).catch(() => null) ?? null
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
  const guide = await sanityClient?.fetch(guideBySlugQuery, { slug }).catch(() => null) ?? null
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
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') }}
      />
      <div className="max-w-2xl mx-auto px-4 py-10">

        <nav className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <Link href={`/${locale}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1 py-0.5 -mx-1 rounded">
            {tNav('navHome')}
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/${locale}/learn`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1 py-0.5 -mx-1 rounded">
            {tGuides('breadcrumbLearn')}
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/${locale}/guides`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1 py-0.5 -mx-1 rounded">
            {tGuides('breadcrumbCurrent')}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-slate-700 dark:text-slate-200 truncate">{guide.title}</span>
        </nav>

        {/* ── Meta ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          {guide.category && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-3">
              <Tag size={11} />
              {CATEGORY_LABELS[guide.category] ?? guide.category}
            </span>
          )}
          <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-3">
            {guide.title}
          </h1>
          {guide.excerpt && (
            <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed">{guide.excerpt}</p>
          )}
          {guide.publishedAt && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mt-3">
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
            className="w-full rounded-2xl mb-8 shadow-sm"
          />
        )}

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {guide.body && (
          <article className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-6 py-8 shadow-sm">
            <PortableTextRenderer value={guide.body} />
          </article>
        )}

        <div className="mt-8">
          <Link href={`/${locale}/guides`} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            ← Back to Guides
          </Link>
        </div>

      </div>
    </main>
  )
}
