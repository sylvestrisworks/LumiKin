import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { sanityClient } from '@/sanity/lib/client'
import { postsQuery } from '@/sanity/lib/queries'
import { urlFor } from '@/sanity/lib/image'
import { Newspaper } from 'lucide-react'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'blog' })
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return {
    title:       t('metaTitle' as any),
    description: t('metaDescription' as any),
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
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

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function BlogPage() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('blog')])
  const posts: SanityPost[] = await sanityClient
    ?.fetch(postsQuery, { locale })
    .catch(() => []) ?? []

  const news  = posts.filter((p) => p.postType === 'news')
  const blogs = posts.filter((p) => p.postType !== 'news')

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
            <span>{t('title')}</span>
          </nav>
          <h1 className="font-serif text-display-sm md:text-display text-ink">{t('title')}</h1>
          <p className="font-serif italic text-muted mt-2">{t('subtitle')}</p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-24 text-muted">
            <Newspaper size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-serif italic">{t('comingSoon')}</p>
          </div>
        ) : (
          <div className="space-y-12">
            {news.length > 0 && (
              <section>
                <h2
                  className="text-kicker uppercase font-semibold text-muted mb-5 border-t border-ink pt-4"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >{t('news')}</h2>
                <PostGrid posts={news} locale={locale} />
              </section>
            )}
            {blogs.length > 0 && (
              <section>
                <h2
                  className="text-kicker uppercase font-semibold text-muted mb-5 border-t border-ink pt-4"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >{t('posts')}</h2>
                <PostGrid posts={blogs} locale={locale} />
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function PostGrid({ posts, locale }: { posts: SanityPost[]; locale: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
      {posts.map((post) => (
        <Link key={post._id} href={`/${locale}/blog/${post.slug.current}`} className="group flex gap-4 py-2">
          {post.coverImage?.asset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urlFor(post.coverImage)!.width(200).height(150).auto('format').url()}
              alt={post.coverImage.alt ?? post.title}
              className="w-24 h-20 object-cover shrink-0"
            />
          ) : (
            <div className="w-24 h-20 bg-rule/40 shrink-0 flex items-center justify-center">
              <Newspaper size={18} className="text-muted" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-kicker uppercase text-muted mb-1" style={{ fontVariantCaps: 'all-small-caps' }}>{formatDate(post.publishedAt)}</p>
            <h2 className="font-serif text-base text-ink leading-snug group-hover:text-accent transition-colors line-clamp-3">
              {post.title}
            </h2>
          </div>
        </Link>
      ))}
    </div>
  )
}
