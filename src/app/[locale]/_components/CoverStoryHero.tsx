import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import SearchBar from '@/components/SearchBar'
import { urlFor } from '@/sanity/lib/image'
import { fetchPostsForHome } from '../_data/posts'

// Magazine cover-story hero. A slim site promise (the page h1) sits above a
// large illustrated essay cover (Sanity art that was previously unsurfaced),
// with a right rail that carries the essay headline + a compact "check a game"
// search. Visual draw and the core action both land in the fold.

function SearchPanel({
  kicker, placeholder, browseHref, browseLabel,
}: {
  kicker: string; placeholder: string; browseHref: string; browseLabel: string
}) {
  return (
    <div>
      <p
        className="text-kicker uppercase font-semibold text-muted mb-3"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {kicker}
      </p>
      <SearchBar placeholder={placeholder} />
      <div className="mt-4">
        <Link
          href={browseHref}
          className="inline-block py-1 text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {browseLabel}
        </Link>
      </div>
    </div>
  )
}

export default async function CoverStoryHero({ locale }: { locale: string }) {
  const [t, te, homePosts] = await Promise.all([
    getTranslations('home'),
    getTranslations('editorial'),
    fetchPostsForHome(locale),
  ])
  const post = homePosts.featured

  const coverUrl = post?.coverImage?.asset
    ? urlFor(post.coverImage)?.width(1200).height(800).auto('format').url()
    : null
  const postHref = post ? `/${locale}/blog/${post.slug.current}` : null

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-10 pb-8 md:pt-12 md:pb-10">

        {/* Site promise — the page h1, kept modest so the cover carries the weight */}
        <h1
          className="font-serif text-display-sm md:text-display tracking-tight leading-[1.05] max-w-4xl mb-10 md:mb-12"
          style={{ fontOpticalSizing: 'auto' }}
        >
          {t('coverPromise')}
        </h1>

        {/* Mobile: the core action lands right under the promise, before the
            magazine layer. Desktop keeps it in the right rail below the essay. */}
        {coverUrl && postHref && (
          <div className="md:hidden mb-10 border-b border-ink pb-8">
            <SearchPanel
              kicker={t('checkAGame')}
              placeholder={t('searchPlaceholder')}
              browseHref={`/${locale}/browse`}
              browseLabel={t('browseAll')}
            />
          </div>
        )}

        {coverUrl && postHref ? (
          <div className="grid md:grid-cols-12 gap-10 md:gap-12 lg:gap-16 items-start">

            {/* ── Cover art (the draw) ──────────────────────────────────────── */}
            <Link href={postHref} className="md:col-span-7 group block" aria-label={post!.title}>
              <div className="aspect-[3/2] w-full bg-ink/10 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt={post!.coverImage?.alt ?? post!.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  style={{ filter: 'saturate(1.05) contrast(1.03)' }}
                  fetchPriority="high"
                />
              </div>
            </Link>

            {/* ── From the desk + check a game ──────────────────────────────── */}
            <div className="md:col-span-5 md:border-l md:border-ink/30 md:pl-10 lg:pl-12">
              <p
                className="text-kicker uppercase font-semibold text-accent mb-4"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {te('sections.theDesk')}
              </p>

              <Link href={postHref} className="group block">
                <h2
                  className="font-serif text-3xl md:text-4xl tracking-tight leading-[1.08] mb-4 group-hover:text-accent transition-colors"
                  style={{ fontOpticalSizing: 'auto' }}
                >
                  {post!.title}
                </h2>
              </Link>

              {post!.excerpt && (
                <p className="font-serif italic text-lg text-muted leading-snug mb-5 max-w-prose">
                  {post!.excerpt}
                </p>
              )}

              <Link
                href={postHref}
                className="inline-block text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {t('readEssay')}
              </Link>

              {/* Hairline, then the core action (desktop — mobile gets it above the cover) */}
              <div className="hidden md:block border-t border-ink mt-8 pt-8">
                <SearchPanel
                  kicker={t('checkAGame')}
                  placeholder={t('searchPlaceholder')}
                  browseHref={`/${locale}/browse`}
                  browseLabel={t('browseAll')}
                />
              </div>
            </div>
          </div>
        ) : (
          // Fallback when no illustrated essay exists: search-led, centered.
          <div className="max-w-xl">
            <SearchPanel
              kicker={t('checkAGame')}
              placeholder={t('searchPlaceholder')}
              browseHref={`/${locale}/browse`}
              browseLabel={t('browseAll')}
            />
          </div>
        )}
      </div>
    </section>
  )
}
