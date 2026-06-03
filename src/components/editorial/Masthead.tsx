import Link from 'next/link'

export type MastheadSection = { href: string; label: string }

const DEFAULT_SECTIONS: MastheadSection[] = [
  { href: '/browse',   label: 'Reviews' },
  { href: '/discover', label: 'Discover' },
  { href: '/learn',    label: 'Guides' },
  { href: '/compare',  label: 'Compare' },
]

function defaultDateline(d: Date) {
  const day = d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
  return `${day} · ${date}`
}

export function Masthead({
  brand = 'LumiKin',
  sections = DEFAULT_SECTIONS,
  tagline = 'Game ratings for parents',
  now = new Date(),
  formatDateline = defaultDateline,
}: {
  brand?: string
  sections?: MastheadSection[]
  tagline?: string
  now?: Date
  formatDateline?: (d: Date) => string
}) {
  return (
    <header className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-8 pt-10 pb-3">
        <div className="flex items-baseline justify-between gap-8">
          <Link
            href="/"
            className="font-serif text-display-sm tracking-tight"
            style={{ fontOpticalSizing: 'auto' }}
          >
            {brand}
          </Link>
          <p className="hidden md:block font-serif italic text-muted text-lg">
            {tagline}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-8">
        <div className="border-t-2 border-ink" />
        <div className="mt-px border-t border-ink/30" />
      </div>

      <nav className="mx-auto max-w-7xl px-8 py-3 flex items-center justify-between gap-8">
        <ul className="flex items-center gap-8 text-kicker uppercase font-medium">
          {sections.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="text-ink hover:text-accent transition-colors"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
        <time className="text-kicker uppercase text-muted tabular-nums">
          {formatDateline(now)}
        </time>
      </nav>

      <div className="mx-auto max-w-7xl px-8">
        <div className="border-t border-ink" />
      </div>
    </header>
  )
}
