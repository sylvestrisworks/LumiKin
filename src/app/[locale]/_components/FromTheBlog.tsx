import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { urlFor } from '@/sanity/lib/image'
import { fetchPostsForHome, type Post } from '../_data/posts'
import { ReadingCard, formatDate, type CardData } from './ReadingCard'

// "From the blog" — a dedicated row of essays, lower on the page than the
// guide-led Reading Room. The cover-story hero already leads with one essay;
// fetchPostsForHome excludes it from `more`, so this surfaces the next three
// without repeating the hero. Hidden when there's nothing left to show.

export default async function FromTheBlog({ locale }: { locale: string }) {
  const [t, te, posts] = await Promise.all([
    getTranslations('home'),
    getTranslations('editorial'),
    fetchPostsForHome(locale, 3),
  ])

  const essays = posts.more
  if (essays.length === 0) return null

  const dateLocale = te('dateline.locale')

  const postCard = (p: Post): CardData => ({
    key: `post-${p._id}`,
    href: `/${locale}/blog/${p.slug.current}`,
    coverUrl: p.coverImage?.asset ? urlFor(p.coverImage)!.width(800).height(600).auto('format').url() : null,
    coverAlt: p.coverImage?.alt ?? p.title,
    kicker: t('essayLabel'),
    title: p.title,
    excerpt: p.excerpt,
    date: formatDate(p.publishedAt, dateLocale),
    readLabel: t('readEssay'),
  })

  const cards = essays.map(postCard)

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8 md:py-10">
        <div className="border-t border-ink pt-4 mb-6 flex items-baseline justify-between gap-4 flex-wrap">
          <p className="text-kicker uppercase font-semibold text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
            {t('blogKicker')}
          </p>
          <Link
            href={`/${locale}/blog`}
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('allEssays')}
          </Link>
        </div>

        <p className="font-serif italic text-xl md:text-2xl text-muted leading-snug max-w-3xl mb-12">
          {t('blogIntro')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-12">
          {cards.map(card => (
            <ReadingCard key={card.key} card={card} />
          ))}
        </div>
      </div>
    </section>
  )
}
