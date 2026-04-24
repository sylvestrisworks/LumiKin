import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { sanityClient } from '@/sanity/lib/client'
import { postsQuery } from '@/sanity/lib/queries'
import { urlFor } from '@/sanity/lib/image'
import { Newspaper } from 'lucide-react'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Blog & News — LumiKin',
  description: 'Gaming news, parenting tips, and updates from LumiKin — a parenting perspective on the games your kids are playing.',
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
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-12">

        <div className="mb-8">
          <nav className="text-xs text-slate-400 dark:text-slate-500 mb-3">
            <Link href={`/${locale}/learn`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t('breadcrumbLearn')}</Link>
            {' / '}
            <span>{t('title')}</span>
          </nav>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('subtitle')}</p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-24 text-slate-400 dark:text-slate-600">
            <Newspaper size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">{t('comingSoon')}</p>
          </div>
        ) : (
          <div className="space-y-10">
            {news.length > 0 && (
              <section>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">{t('news')}</h2>
                <PostGrid posts={news} locale={locale} />
              </section>
            )}
            {blogs.length > 0 && (
              <section>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">{t('posts')}</h2>
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {posts.map((post) => (
        <Link key={post._id} href={`/${locale}/blog/${post.slug.current}`} className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all flex gap-4 p-4">
          {post.coverImage?.asset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urlFor(post.coverImage)!.width(200).height(150).auto('format').url()}
              alt={post.coverImage.alt ?? post.title}
              className="w-24 h-20 rounded-xl object-cover shrink-0"
            />
          ) : (
            <div className="w-24 h-20 rounded-xl bg-slate-100 dark:bg-slate-700 shrink-0 flex items-center justify-center">
              <Newspaper size={18} className="text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">{formatDate(post.publishedAt)}</p>
            <h2 className="font-bold text-slate-900 dark:text-white text-sm leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors line-clamp-3">
              {post.title}
            </h2>
          </div>
        </Link>
      ))}
    </div>
  )
}
