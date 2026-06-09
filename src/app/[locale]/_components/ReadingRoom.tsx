import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { urlFor } from '@/sanity/lib/image'
import { fetchDeskGuides, type DeskGuide } from '../_data/desk'
import { ReadingCard, formatDate, type CardData } from './ReadingCard'

// "Reading room" — the illustrated parental-guide library, surfaced as a single
// row of cover-led cards. Essays live in their own "From the blog" section
// further down the page, so this surface is guides-only and stays one row.

type LearnT = Awaited<ReturnType<typeof getTranslations<'learn'>>>
const CATEGORY_KEY: Record<string, Parameters<LearnT>[0]> = {
  'screen-time':    'catScreenTime',
  'game-safety':    'catGameSafety',
  'age-guide':      'catAgeGuide',
  'parenting-tips': 'catParentingTips',
}

export default async function ReadingRoom({ locale }: { locale: string }) {
  const [t, te, tLearn, guides] = await Promise.all([
    getTranslations('home'),
    getTranslations('editorial'),
    getTranslations('learn'),
    fetchDeskGuides(locale, 3),
  ])

  const dateLocale = te('dateline.locale')

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

  const cards = guides.map(guideCard)
  if (cards.length === 0) return null

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8 md:py-10">
        <div className="border-t border-ink pt-4 mb-6 flex items-baseline justify-between gap-4 flex-wrap">
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
