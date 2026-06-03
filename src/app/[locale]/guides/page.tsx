import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { sanityClient } from '@/sanity/lib/client'
import { guidesQuery } from '@/sanity/lib/queries'
import { urlFor } from '@/sanity/lib/image'
import { BookOpen } from 'lucide-react'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'guides' })
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return {
    title:       t('metaTitle' as any),
    description: t('metaDescription' as any),
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

type LearnT = Awaited<ReturnType<typeof getTranslations<'learn'>>>

const CATEGORY_KEY: Record<string, Parameters<LearnT>[0]> = {
  'screen-time':    'catScreenTime',
  'game-safety':    'catGameSafety',
  'age-guide':      'catAgeGuide',
  'parenting-tips': 'catParentingTips',
}

type SanityGuide = {
  _id: string
  title: string
  slug: { current: string }
  excerpt?: string
  coverImage?: { asset: { _ref: string }; alt?: string }
  category?: string
  publishedAt?: string
}

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function GuidesPage() {
  const [locale, t, tLearn] = await Promise.all([
    getLocale(),
    getTranslations('guides'),
    getTranslations('learn'),
  ])
  const guides: SanityGuide[] = await sanityClient
    ?.fetch(guidesQuery, { locale })
    .catch(() => []) ?? []

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="max-w-5xl mx-auto px-4 py-12">

        <div className="mb-10 border-b border-ink pb-6">
          <nav
            className="text-kicker uppercase text-muted mb-3"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            <Link href={`/${locale}/learn`} className="hover:text-accent transition-colors">{t('breadcrumbLearn')}</Link>
            {' / '}
            <span>{t('breadcrumbCurrent')}</span>
          </nav>
          <h1 className="font-serif text-display-sm md:text-display text-ink">{t('title')}</h1>
          <p className="font-serif italic text-muted mt-2">{t('subtitle')}</p>
        </div>

        {guides.length === 0 ? (
          <div className="text-center py-24 text-muted">
            <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-serif italic">{t('comingSoon')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {guides.map((guide) => (
              <Link key={guide._id} href={`/${locale}/guides/${guide.slug.current}`} className="group block">
                {guide.coverImage?.asset ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urlFor(guide.coverImage)!.width(600).height(300).auto('format').url()}
                    alt={guide.coverImage.alt ?? guide.title}
                    className="w-full h-40 object-cover mb-3"
                  />
                ) : (
                  <div className="w-full h-40 bg-rule/40 flex items-center justify-center mb-3">
                    <BookOpen size={28} className="text-rule" />
                  </div>
                )}
                <div>
                  {guide.category && (
                    <span
                      className="text-kicker uppercase font-semibold text-accent inline-block mb-2"
                      style={{ fontVariantCaps: 'all-small-caps' }}
                    >
                      {CATEGORY_KEY[guide.category] ? tLearn(CATEGORY_KEY[guide.category]) : guide.category}
                    </span>
                  )}
                  <h2 className="font-serif text-lg text-ink leading-snug group-hover:text-accent transition-colors">
                    {guide.title}
                  </h2>
                  {guide.excerpt && (
                    <p className="text-sm text-muted mt-2 line-clamp-2">{guide.excerpt}</p>
                  )}
                  {guide.publishedAt && (
                    <p className="text-kicker uppercase text-muted mt-3" style={{ fontVariantCaps: 'all-small-caps' }}>{formatDate(guide.publishedAt)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
