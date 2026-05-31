import { ScoreBar } from './ScoreTable'

export type ListingCardData = {
  title: string
  kicker: string
  dek: string
  bds: number
  ris: number
  minutes: number
  ages: string
  photoFrom: string
  photoTo: string
}

// `readLabel` lets the caller supply a localized CTA without coupling the
// primitive to next-intl. Falls back to English so legacy consumers don't
// break, but every editorial caller should pass an i18n value.
export function ListingCard({ card, readLabel = 'Read review →' }: { card: ListingCardData; readLabel?: string }) {
  return (
    <article className="flex flex-col border-b border-ink pb-8">
      {/* Photo stand-in. Replace with treated <img> when real photography lands. */}
      <div
        className="aspect-[4/3] w-full mb-5"
        style={{ background: `linear-gradient(135deg, ${card.photoFrom}, ${card.photoTo})` }}
        aria-hidden
      />

      <p
        className="text-kicker uppercase font-semibold text-accent mb-2"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {card.kicker}
      </p>

      <h3
        className="font-serif text-3xl leading-[1.05] tracking-tight mb-3"
        style={{ fontOpticalSizing: 'auto' }}
      >
        {card.title}
      </h3>

      <p className="font-serif italic text-muted text-base leading-snug mb-5">
        {card.dek}
      </p>

      {/* Sparkline row */}
      <div className="mt-auto grid grid-cols-[auto_1fr_auto] gap-x-3 items-center text-sm font-sans">
        <span
          className="text-kicker uppercase text-muted"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          B
        </span>
        <ScoreBar value={card.bds} tone="ink" thin />
        <span className="tabular-nums text-ink">{Math.round(card.bds * 100)}</span>

        <span
          className="text-kicker uppercase text-muted mt-2"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          R
        </span>
        <div className="mt-2"><ScoreBar value={card.ris} tone="accent" thin /></div>
        <span className="tabular-nums text-ink mt-2">{Math.round(card.ris * 100)}</span>
      </div>

      <div className="mt-5 pt-3 border-t border-ink/20 flex items-baseline justify-between font-sans">
        <span
          className="text-kicker uppercase text-muted"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {card.minutes} min · ages {card.ages}
        </span>
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
