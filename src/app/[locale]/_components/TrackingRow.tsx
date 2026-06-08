import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ListingCard, type ListingCardData } from '@/components/editorial'
import { esrbToAge } from '@/lib/ui'
import { fetchTrending, type TrendingRow } from '../_data/trending'

// Rotating photo-stand-in palette — mirrors design-preview so the homepage and
// the preview stay visually aligned until real photography lands (Phase 7).
const PHOTO_PALETTE: Array<{ from: string; to: string }> = [
  { from: '#3F5A2E', to: '#7C8F4E' }, // ivy / olive
  { from: '#6B4A2B', to: '#C49A6C' }, // warm amber
  { from: '#3A1E5C', to: '#A04BBF' }, // mulberry
]

function firstSentence(text: string | null, max = 140): string {
  if (!text) return ''
  const trimmed = text.trim()
  const dot = trimmed.indexOf('. ')
  const head = dot > 0 ? trimmed.slice(0, dot + 1) : trimmed
  return head.length > max ? head.slice(0, max - 1).trimEnd() + '…' : head
}

function firstGenre(genres: unknown): string | null {
  if (!Array.isArray(genres) || genres.length === 0) return null
  const g = genres[0]
  return typeof g === 'string' ? g : null
}

function toCard(row: TrendingRow, idx: number, fallbackDek: string, byline: string): ListingCardData {
  const palette = PHOTO_PALETTE[idx % PHOTO_PALETTE.length]
  const genre   = firstGenre(row.genres)
  return {
    title:     row.title,
    kicker:    genre ? `Review · ${genre}` : 'Review',
    dek:       firstSentence(row.executiveSummary) || fallbackDek,
    bds:       row.bds ?? 0,
    ris:       row.ris ?? 0,
    minutes:   row.timeRecommendationMinutes ?? 0,
    ages:      esrbToAge(row.esrbRating),
    photoUrl:  row.backgroundImage,
    photoFrom: palette.from,
    photoTo:   palette.to,
    byline,
  }
}

export default async function TrackingRow({ locale }: { locale: string }) {
  const [rows, te] = await Promise.all([
    fetchTrending(locale, 3),
    getTranslations('editorial'),
  ])
  if (rows.length === 0) return null

  const byline      = te('meta.byline')
  const fallbackDek = byline // generic editorial-voice fallback when no summary exists

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12 md:py-14">
        <div className="border-t border-ink pt-4 mb-10 flex items-baseline justify-between gap-4 flex-wrap">
          <p
            className="text-kicker uppercase font-semibold text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {te('sections.whatWereTracking')}
          </p>
          <Link
            href={`/${locale}/browse?sort=trending`}
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {te('sections.allReviews')}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          {rows.map((row, idx) => (
            <Link
              key={row.slug}
              href={`/${locale}/game/${row.slug}`}
              className="group block h-full hover:[&_h3]:text-accent transition-colors"
              aria-label={`${row.title} — read review`}
            >
              <ListingCard card={toCard(row, idx, fallbackDek, byline)} readLabel={te('sections.readReview')} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
