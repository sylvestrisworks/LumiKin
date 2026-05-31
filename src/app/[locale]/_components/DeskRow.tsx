import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { urlFor } from '@/sanity/lib/image'
import { fetchDeskGuides, type DeskGuide } from '../_data/desk'

// Same rotating palette as TrackingRow so the two homepage rows look like part
// of the same editorial system. Duplicated rather than extracted while only two
// consumers exist — promote to a shared module if a third lands.
const PHOTO_PALETTE: Array<{ from: string; to: string }> = [
  { from: '#3F5A2E', to: '#7C8F4E' }, // ivy / olive
  { from: '#6B4A2B', to: '#C49A6C' }, // warm amber
  { from: '#3A1E5C', to: '#A04BBF' }, // mulberry
]

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
  guide, idx, dateLocale, categoryLabel, readLabel,
}: {
  guide: DeskGuide
  idx: number
  dateLocale: string
  categoryLabel: string
  readLabel: string
}) {
  const palette = PHOTO_PALETTE[idx % PHOTO_PALETTE.length]
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
        <div
          className="aspect-[4/3] w-full mb-5"
          style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
          aria-hidden
        />
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
      <div className="mx-auto max-w-7xl px-8 py-16 md:py-20">
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
          {guides.map((guide, idx) => {
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
                  idx={idx}
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
