import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { sanityClient } from '@/sanity/lib/client'
import { learnHubQuery } from '@/sanity/lib/queries'
import { urlFor } from '@/sanity/lib/image'
import { BookOpen, Newspaper, HelpCircle, ArrowRight } from 'lucide-react'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Learn — Parental Guides, News & FAQs | LumiKin',
  description: 'Expert guides for parents on screen time, game safety, and age-appropriate gaming. News, tips, and answers to your most common questions.',
}

const CATEGORY_LABELS: Record<string, string> = {
  'screen-time': 'Screen Time',
  'game-safety': 'Game Safety',
  'age-guide': 'Age Guide',
  'parenting-tips': 'Parenting Tips',
}

const CATEGORY_COLORS: Record<string, string> = {
  'screen-time': 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'game-safety': 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  'age-guide': 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  'parenting-tips': 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
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
  const locale = await getLocale()

  const data: HubData = await sanityClient
    .fetch(learnHubQuery, { locale })
    .catch(() => ({ featuredGuides: [], recentPosts: [], faqCount: 0 }))

  const { featuredGuides, recentPosts, faqCount } = data

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-16">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Learn
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Guides, news, and answers to help you make confident decisions about gaming.
          </p>
        </div>

        {/* ── Content type cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href={`/${locale}/guides`} className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-4">
              <BookOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="font-black text-slate-900 dark:text-white mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">Parental Guides</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">In-depth guides on screen time, game safety, and age-appropriate choices.</p>
          </Link>

          <Link href={`/${locale}/blog`} className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-4">
              <Newspaper size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="font-black text-slate-900 dark:text-white mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">Blog & News</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Gaming news, updates, and commentary from a parenting perspective.</p>
          </Link>

          <Link href={`/${locale}/faq`} className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-violet-50 dark:bg-violet-900/30 rounded-xl flex items-center justify-center mb-4">
              <HelpCircle size={20} className="text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="font-black text-slate-900 dark:text-white mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">FAQ</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">How the LumiScore works, what our ratings mean, and how we score games.</p>
          </Link>
        </div>

        {/* ── Featured Guides ──────────────────────────────────────────── */}
        {featuredGuides.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Featured Guides</h2>
              <Link href={`/${locale}/guides`} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                All guides <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {featuredGuides.map((guide) => (
                <Link key={guide._id} href={`/${locale}/guides/${guide.slug.current}`} className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all">
                  {guide.coverImage?.asset ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urlFor(guide.coverImage).width(600).height(300).auto('format').url()}
                      alt={guide.coverImage.alt ?? guide.title}
                      className="w-full h-36 object-cover"
                    />
                  ) : (
                    <div className="w-full h-36 bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40" />
                  )}
                  <div className="p-4">
                    {guide.category && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[guide.category] ?? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'} mb-2 inline-block`}>
                        {CATEGORY_LABELS[guide.category] ?? guide.category}
                      </span>
                    )}
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                      {guide.title}
                    </h3>
                    {guide.excerpt && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">{guide.excerpt}</p>
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
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Latest from the Blog</h2>
              <Link href={`/${locale}/blog`} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                All posts <ArrowRight size={14} />
              </Link>
            </div>
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <Link key={post._id} href={`/${locale}/blog/${post.slug.current}`} className="group flex items-start gap-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all">
                  {post.coverImage?.asset ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urlFor(post.coverImage).width(160).height(100).auto('format').url()}
                      alt={post.coverImage.alt ?? post.title}
                      className="w-20 h-14 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-14 rounded-lg bg-slate-100 dark:bg-slate-700 shrink-0 flex items-center justify-center">
                      <Newspaper size={16} className="text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {post.postType && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                          {post.postType}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">{formatDate(post.publishedAt)}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
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
          <div className="text-center py-16 text-slate-400 dark:text-slate-600">
            <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">Content coming soon.</p>
          </div>
        )}

      </div>
    </main>
  )
}
