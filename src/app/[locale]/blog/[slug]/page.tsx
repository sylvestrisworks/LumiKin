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
            {tBlog('breadcrumbLearn')}
          </Link>
          <span aria-hidden className="text-rule">/</span>
          <Link href={`/${locale}/blog`} className="hover:text-accent transition-colors">
            {tBlog('title')}
          </Link>
          <span aria-hidden className="text-rule">/</span>
          <span className="text-ink truncate">{post.title}</span>
        </nav>

        <div className="border-b border-ink pb-6 mb-8">
          {/* ── Type badge ───────────────────────────────────────────────── */}
          {post.postType && (
            <span
              className="text-kicker uppercase font-semibold text-accent mb-3 block"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {post.postType}
            </span>
          )}

          <h1 className="font-serif text-display-sm md:text-display text-ink leading-tight mb-3">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="font-serif italic text-lg text-muted leading-relaxed mb-4">{post.excerpt}</p>
          )}

          <div className="flex items-center gap-4 text-kicker uppercase text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
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
        </div>

        {/* ── Cover image ──────────────────────────────────────────────── */}
        {post.coverImage?.asset && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlFor(post.coverImage)!.width(800).auto('format').url()}
            alt={post.coverImage.alt ?? post.title}
            className="w-full mb-8"
          />
        )}

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {post.body && (
          <article className="max-w-prose">
            <PortableTextRenderer value={post.body} />
          </article>
        )}

        <div className="mt-10 border-t border-ink pt-4">
          <Link
            href={`/${locale}/blog`}
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            ← Back to Blog
          </Link>
        </div>

      </div>
    </main>
  )
}
