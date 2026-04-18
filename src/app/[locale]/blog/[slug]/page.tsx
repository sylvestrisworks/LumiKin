import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { sanityClient } from '@/sanity/lib/client'
import { postBySlugQuery } from '@/sanity/lib/queries'
import { urlFor } from '@/sanity/lib/image'
import PortableTextRenderer from '@/components/PortableTextRenderer'
import { CalendarDays, User } from 'lucide-react'

export const revalidate = 3600

type Props = { params: Promise<{ slug: string }> }

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await sanityClient.fetch(postBySlugQuery, { slug }).catch(() => null)
  if (!post) return { title: 'Post not found — LumiKin' }

  const title = post.seoTitle ?? `${post.title} | LumiKin`
  const description = post.seoDescription ?? post.excerpt ?? `${post.title} — LumiKin`

  return {
    title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title,
      description,
      url: `/blog/${slug}`,
      images: post.coverImage?.asset
        ? [{ url: urlFor(post.coverImage).width(1200).height(630).auto('format').url() }]
        : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const [{ slug }, locale] = await Promise.all([params, getLocale()])
  const post = await sanityClient.fetch(postBySlugQuery, { slug }).catch(() => null)
  if (!post) notFound()

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-2xl mx-auto px-4 py-10">

        <nav className="text-xs text-slate-400 dark:text-slate-500 mb-6 flex items-center gap-1.5">
          <Link href={`/${locale}/learn`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Learn</Link>
          <span>/</span>
          <Link href={`/${locale}/blog`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Blog & News</Link>
          <span>/</span>
          <span className="text-slate-600 dark:text-slate-300 truncate">{post.title}</span>
        </nav>

        {/* ── Type badge ───────────────────────────────────────────────── */}
        {post.postType && (
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 block">
            {post.postType}
          </span>
        )}

        <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-3">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{post.excerpt}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 mb-8">
          {post.author && (
            <span className="flex items-center gap-1.5">
              <User size={12} /> {post.author}
            </span>
          )}
          {post.publishedAt && (
            <span className="flex items-center gap-1.5">
              <CalendarDays size={12} /> {formatDate(post.publishedAt)}
            </span>
          )}
        </div>

        {/* ── Cover image ──────────────────────────────────────────────── */}
        {post.coverImage?.asset && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlFor(post.coverImage).width(800).auto('format').url()}
            alt={post.coverImage.alt ?? post.title}
            className="w-full rounded-2xl mb-8 shadow-sm"
          />
        )}

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {post.body && (
          <article className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-6 py-8 shadow-sm">
            <PortableTextRenderer value={post.body} />
          </article>
        )}

        <div className="mt-8">
          <Link href={`/${locale}/blog`} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            ← Back to Blog
          </Link>
        </div>

      </div>
    </main>
  )
}
