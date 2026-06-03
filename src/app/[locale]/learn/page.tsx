import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { sanityClient } from '@/sanity/lib/client'
import { learnHubQuery } from '@/sanity/lib/queries'
import { urlFor } from '@/sanity/lib/image'
import { BookOpen, Newspaper, HelpCircle, ArrowRight } from 'lucide-react'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'learn' })
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

type SanityPost = {
  _id: string
  title: string
  slug: { current: string }
  postType?: string
  excerpt?: string
  coverImage?: { asset: { _ref: string }; alt?: string }
  author?: string
  publishedAt?: string
}

type HubData = {
  featuredGuides: SanityGuide[]
  recentPosts: SanityPost[]
  faqCount: number
}

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function LearnPage() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('learn')])

  const data: HubData = await sanityClient
    ?.fetch(learnHubQuery, { locale })
    .catch(() => ({ featuredGuides: [], recentPosts: [], faqCount: 0 }))
    ?? { featuredGuides: [], recentPosts: [], faqCount: 0 }

  const { featuredGuides, recentPosts } = data

  const TYPE_CARDS = [
    { href: `/${locale}/guides`, Icon: BookOpen,   title: t('guidesTitle'), sub: t('guidesSub') },
    { href: `/${locale}/blog`,   Icon: Newspaper,  title: t('blogTitle'),   sub: t('blogSub') },
    { href: `/${locale}/faq`,    Icon: HelpCircle, title: t('faqTitle'),    sub: t('faqSub') },
  ]

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-16">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="text-center space-y-3 border-b border-ink pb-8">
          <h1 className="font-serif text-display-sm md:text-display text-ink tracking-tight">
            {t('title')}
          </h1>
          <p className="font-serif italic text-lg text-muted max-w-xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* ── Content type cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-rule border border-rule">
          {TYPE_CARDS.map(({ href, Icon, title, sub }) => (
            <Link key={href} href={href} className="group bg-paper p-6 hover:bg-ink/[0.02] transition-colors">
              <Icon size={22} strokeWidth={1.5} className="text-ink mb-4" aria-hidden />
              <h2 className="font-serif text-lg text-ink mb-1 group-hover:text-accent transition-colors">{title}</h2>
              <p className="text-sm text-muted">{sub}</p>
            </Link>
          ))}
        </div>

        {/* ── Featured Guides ──────────────────────────────────────────── */}
        {featuredGuides.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-6 border-t border-ink pt-4">
              <h2
                className="text-kicker uppercase font-semibold text-muted"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >{t('featuredGuides')}</h2>
              <Link
                href={`/${locale}/guides`}
                className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors flex items-center gap-1"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {t('allGuides')} <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {featuredGuides.map((guide) => (
                <Link key={guide._id} href={`/${locale}/guides/${guide.slug.current}`} className="group block">
                  {guide.coverImage?.asset ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urlFor(guide.coverImage)!.width(600).height(300).auto('format').url()}
                      alt={guide.coverImage.alt ?? guide.title}
                      className="w-full h-36 object-cover mb-3"
                    />
                  ) : (
                    <div className="w-full h-36 bg-rule/40 mb-3" />
                  )}
                  <div>
                    {guide.category && (
                      <span
                        className="text-kicker uppercase font-semibold text-accent mb-2 inline-block"
                        style={{ fontVariantCaps: 'all-small-caps' }}
                      >
                        {CATEGORY_KEY[guide.category] ? t(CATEGORY_KEY[guide.category]) : guide.category}
                      </span>
                    )}
                    <h3 className="font-serif text-base text-ink leading-snug group-hover:text-accent transition-colors">
                      {guide.title}
                    </h3>
                    {guide.excerpt && (
                      <p className="text-xs text-muted mt-1.5 line-clamp-2">{guide.excerpt}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Recent Posts ─────────────────────────────────────────────── */}
        {recentPosts.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-6 border-t border-ink pt-4">
              <h2
                className="text-kicker uppercase font-semibold text-muted"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >{t('latestBlog')}</h2>
              <Link
                href={`/${locale}/blog`}
                className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors flex items-center gap-1"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {t('allPosts')} <ArrowRight size={14} />
              </Link>
            </div>
            <div className="divide-y divide-rule/60">
              {recentPosts.map((post) => (
                <Link key={post._id} href={`/${locale}/blog/${post.slug.current}`} className="group flex items-start gap-4 py-4">
                  {post.coverImage?.asset ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urlFor(post.coverImage)!.width(160).height(100).auto('format').url()}
                      alt={post.coverImage.alt ?? post.title}
                      className="w-20 h-14 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-14 bg-rule/40 shrink-0 flex items-center justify-center">
                      <Newspaper size={16} className="text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {post.postType && (
                        <span
                          className="text-kicker uppercase font-semibold text-muted"
                          style={{ fontVariantCaps: 'all-small-caps' }}
                        >
                          {post.postType}
                        </span>
                      )}
                      <span className="text-[10px] text-muted">{formatDate(post.publishedAt)}</span>
                    </div>
                    <h3 className="font-serif text-base text-ink leading-snug group-hover:text-accent transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ──────────────────────────────────────────────── */}
        {featuredGuides.length === 0 && recentPosts.length === 0 && (
          <div className="text-center py-16 text-muted">
            <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-serif italic">{t('comingSoon')}</p>
          </div>
        )}

      </div>
    </main>
  )
}
