// Classified-ad-style input. Hairline border, italic placeholder, small-caps
// RETURN affordance on the right. Border flips to accent on focus-within.

export function SearchInput({
  placeholder = 'Search reviews',
  width = 'max-w-xl',
  returnLabel = 'Return ↵',
}: {
  placeholder?: string
  width?: string
  returnLabel?: string
}) {
  return (
    <div
      className={
        'flex items-center gap-3 border border-ink/60 focus-within:border-accent bg-paper px-4 py-3 transition-colors ' +
        width
      }
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="text-muted"
        aria-hidden
      >
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4-4" />
      </svg>
      <input
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 bg-transparent font-serif text-lg text-ink placeholder:italic placeholder:text-muted focus:outline-none"
      />
      <span
        className="text-kicker uppercase text-muted whitespace-nowrap select-none"
        style={{ fontVariantCaps: 'all-small-caps' }}
        aria-hidden
      >
        {returnLabel}
      </span>
    </div>
  )
}
