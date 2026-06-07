import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { urlFor } from '@/sanity/lib/image'
import { fetchDeskGuides, type DeskGuide } from '../_data/desk'
import { fetchPostsForHome, type Post } from '../_data/posts'

// "Reading room" — surfaces the illustrated Sanity library on the homepage:
// parental guides + the blog essays (which were previously unsurfaced here),
// as a single cover-led card grid. The newest illustrated essay is omitted
// because the cover-story hero already leads with it.

type LearnT = Awaited<ReturnType<typeof getTranslations<'learn'>>>
const CATEGORY_KEY: Record<string, Parameters<LearnT>[0]> = {
  'screen-time':    'catScreenTime',
  'game-safety':    'catGameSafety',
  'age-guide':      'catAgeGuide',
  'parenting-tips': 'catParentingTips',
}

type CardData = {
  key: string
  href: string
  coverUrl: string | null
  coverAlt: string
  kicker: string
  title: string
  excerpt?: string
  date?: string
  readLabel: string
}

function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
}

function ReadingCard({ card }: { card: CardData }) {
  return (
    <Link href={card.href} className="group block h-full" aria-label={card.title}>
      <article className="flex flex-col h-full border-b border-ink pb-8">
        {card.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.coverUrl}
            alt={card.coverAlt}
            className="aspect-[4/3] w-full mb-5 object-cover"
            style={{ filter: 'saturate(1.05) contrast(1.03)' }}
          />
        ) : (
          <div className="aspect-[4/3] w-full mb-5 border border-ink bg-paper flex items-center justify-center" aria-hidden>
            <span className="font-serif text-5xl text-ink/80" style={{ fontOpticalSizing: 'auto' }}>✳</span>
          </div>
        )}

        <p
          className="text-kicker uppercase font-semibold text-accent mb-2"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {card.kicker}
        </p>

        <h3
          className="font-serif text-2xl md:text-3xl leading-[1.06] tracking-tight mb-3 group-hover:text-accent transition-colors"
          style={{ fontOpticalSizing: 'auto' }}
        >
          {card.title}
        </h3>

        {card.excerpt && (
          <p className="font-serif italic text-muted text-base leading-snug mb-5">
            {card.excerpt}
          </p>
        )}

        <div className="mt-auto pt-5 border-t border-ink/20 flex items-baseline justify-between font-sans gap-3">
          <time className="text-kicker uppercase text-muted tabular-nums" style={{ fontVariantCaps: 'all-small-caps' }}>
            {card.date}
          </time>
          <span className="text-kicker uppercase text-accent" style={{ fontVariantCaps: 'all-small-caps' }}>
            {card.readLabel}
          </span>
        </div>
      </article>
    </Link>
  )
}

export default async function ReadingRoom({ locale }: { locale: string }) {
  const [t, te, tLearn, guides, homePosts] = await Promise.all([
    getTranslations('home'),
    getTranslations('editorial'),
    getTranslations('learn'),
    fetchDeskGuides(locale, 4),
    fetchPostsForHome(locale, 2),
  ])

  const dateLocale = te('dateline.locale')

  // The hero already features one essay; show the rest here.
  const morePosts = homePosts.more

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

  const guideCard = (g: DeskGuide): CardData => {
    const catKey = g.category ? CATEGORY_KEY[g.category] : undefined
    return {
      key: `guide-${g._id}`,
      href: `/${locale}/guides/${g.slug.current}`,
      coverUrl: g.coverImage?.asset ? urlFor(g.coverImage)!.width(800).height(600).auto('format').url() : null,
      coverAlt: g.coverImage?.alt ?? g.title,
      kicker: catKey ? tLearn(catKey) : (g.category ?? 'Guide'),
      title: g.title,
      excerpt: g.excerpt,
      date: formatDate(g.publishedAt, dateLocale),
      readLabel: te('sections.readGuide'),
    }
  }

  // Essays lead, then guides — capped at six cards for a clean two-row grid.
  const cards: CardData[] = [...morePosts.map(postCard), ...guides.map(guideCard)].slice(0, 6)
  if (cards.length === 0) return null

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-16 md:py-20">
        <div className="border-t border-ink pt-4 mb-10 flex items-baseline justify-between gap-4 flex-wrap">
          <p className="text-kicker uppercase font-semibold text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
            {t('readingRoomKicker')}
          </p>
          <Link
            href={`/${locale}/guides`}
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {te('sections.allGuides')}
          </Link>
        </div>

        <p className="font-serif italic text-xl md:text-2xl text-muted leading-snug max-w-3xl mb-12">
          {t('readingRoomIntro')}
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
