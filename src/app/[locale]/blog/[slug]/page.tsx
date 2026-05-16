import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { sanityClient } from '@/sanity/lib/client'
import { postBySlugQuery } from '@/sanity/lib/queries'
import { urlFor } from '@/sanity/lib/image'
import PortableTextRenderer from '@/components/PortableTextRenderer'
import { CalendarDays, User } from 'lucide-react'

export const revalidate = 3600

type Props = { params: Promise<{ locale: string; slug: string }> }

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params
  const post = await sanityClient?.fetch(postBySlugQuery, { slug }).catch(() => null) ?? null
  if (!post) return { title: 'Post not found — LumiKin' }

  const title = post.seoTitle ?? `${post.title} | LumiKin`
  const description = post.seoDescription ?? post.excerpt ?? `${post.title} — LumiKin`

  return {
    title,
    description,
    alternates: { canonical: `/${locale}/blog/${slug}` },
    openGraph: {
      title,
      description,
      url: `/${locale}/blog/${slug}`,
      images: post.coverImage?.asset
        ? [{ url: urlFor(post.coverImage)!.width(1200).height(630).auto('format').url() }]
        : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const [{ slug }, locale, tNav, tBlog] = await Promise.all([
    params,
    getLocale(),
    getTranslations('game'),
    getTranslations('blog'),
  ])
  const post = await sanityClient?.fetch(postBySlugQuery, { slug }).catch(() => null) ?? null
  if (!post) notFound()

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: tNav('navHome'),          item: `${SITE_URL}/${locale}` },
      { '@type': 'ListItem', position: 2, name: tBlog('breadcrumbLearn'), item: `${SITE_URL}/${locale}/learn` },
      { '@type': 'ListItem', position: 3, name: tBlog('title'),           item: `${SITE_URL}/${locale}/blog` },
      { '@type': 'ListItem', position: 4, name: post.title,               item: `${SITE_URL}/${locale}/blog/${slug}` },
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
            {tBlog('breadcrumbLearn')}
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/${locale}/blog`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1 py-0.5 -mx-1 rounded">
            {tBlog('title')}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-slate-700 dark:text-slate-200 truncate">{post.title}</span>
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
            src={urlFor(post.coverImage)!.width(800).auto('format').url()}
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
