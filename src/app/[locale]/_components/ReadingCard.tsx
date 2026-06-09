import Link from 'next/link'

// Shared cover-led reading card — used by both the Reading Room (guides) and
// the From-the-blog essay section. Kept in its own module so the two surfaces
// render identical cards without one importing the other.

export type CardData = {
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

export function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
}

export function ReadingCard({ card }: { card: CardData }) {
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
