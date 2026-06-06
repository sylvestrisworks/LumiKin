import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { urlFor } from '@/sanity/lib/image'
import { fetchDeskGuides, type DeskGuide } from '../_data/desk'

type LearnT = Awaited<ReturnType<typeof getTranslations<'learn'>>>

const CATEGORY_KEY: Record<string, Parameters<LearnT>[0]> = {
  'screen-time':    'catScreenTime',
  'game-safety':    'catGameSafety',
  'age-guide':      'catAgeGuide',
  'parenting-tips': 'catParentingTips',
}

function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
  }).toUpperCase()
}

function GuideCard({
  guide, dateLocale, categoryLabel, readLabel,
}: {
  guide: DeskGuide
  dateLocale: string
  categoryLabel: string
  readLabel: string
}) {
  const hasCover = Boolean(guide.coverImage?.asset)
  const coverUrl = hasCover ? urlFor(guide.coverImage!)?.width(800).height(600).auto('format').url() : null

  return (
    <article className="flex flex-col border-b border-ink pb-8">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={guide.coverImage?.alt ?? guide.title}
          className="aspect-[4/3] w-full mb-5 object-cover"
          style={{ filter: 'saturate(1.05) contrast(1.03)' }}
        />
      ) : (
        // Typographic cover for un-illustrated guides — a deliberate section
        // tile (LumiKin mark + category) rather than a random gradient, so it
        // still reads as authored rather than templated.
        <div
          className="aspect-[4/3] w-full mb-5 border border-ink bg-paper flex flex-col items-center justify-center gap-4 px-6 text-center"
          aria-hidden
        >
          <span className="font-serif text-5xl text-ink/80" style={{ fontOpticalSizing: 'auto' }}>✳</span>
          <span
            className="text-kicker uppercase font-semibold text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {categoryLabel}
          </span>
        </div>
      )}

      <p
        className="text-kicker uppercase font-semibold text-accent mb-2"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {categoryLabel}
      </p>

      <h3
        className="font-serif text-3xl leading-[1.05] tracking-tight mb-3 group-hover:text-accent transition-colors"
        style={{ fontOpticalSizing: 'auto' }}
      >
        {guide.title}
      </h3>

      {guide.excerpt && (
        <p className="font-serif italic text-muted text-base leading-snug mb-5">
          {guide.excerpt}
        </p>
      )}

      <div className="mt-auto pt-5 border-t border-ink/20 flex items-baseline justify-between font-sans">
        <time
          className="text-kicker uppercase text-muted tabular-nums"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {formatDate(guide.publishedAt, dateLocale)}
        </time>
        <span
          className="text-kicker uppercase text-accent"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {readLabel}
        </span>
      </div>
    </article>
  )
}

export default async function DeskRow({ locale }: { locale: string }) {
  const [guides, te, tLearn] = await Promise.all([
    fetchDeskGuides(locale, 3),
    getTranslations('editorial'),
    getTranslations('learn'),
  ])
  if (guides.length === 0) return null

  const dateLocale = te('dateline.locale')

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-16 md:py-20">
        <div className="border-t border-ink pt-4 mb-10 flex items-baseline justify-between gap-4 flex-wrap">
          <p
            className="text-kicker uppercase font-semibold text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {te('sections.theDesk')}
          </p>
          <Link
            href={`/${locale}/guides`}
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {te('sections.allGuides')}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          {guides.map((guide) => {
            const catKey = guide.category ? CATEGORY_KEY[guide.category] : undefined
            const categoryLabel = catKey ? tLearn(catKey) : (guide.category ?? 'Guide')
            return (
              <Link
                key={guide._id}
                href={`/${locale}/guides/${guide.slug.current}`}
                className="group block h-full"
                aria-label={`${guide.title} — read the guide`}
              >
                <GuideCard
                  guide={guide}
                  dateLocale={dateLocale}
                  categoryLabel={categoryLabel}
                  readLabel={te('sections.readGuide')}
                />
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
