import { Link } from '@/navigation'
import { AUTHOR } from '@/lib/author'

// Visible human byline. Reads name/role/credential from src/lib/author.ts — the
// same source that builds the Person JSON-LD — so the on-screen byline and the
// schema `author` reference cannot drift. No avatar/photo dependency; a portrait
// can be added later as an optional prop without changing this API.
//
//   full    → methodology / about footer: name, role, credential, optional independence note
//   compact → editorial / Analysis pieces: "By Johan Sjöstedt, Founder & Editor" + link to /about

type AuthorBylineProps = {
  variant: 'full' | 'compact'
  /** Renders the "independent, no platform/vendor funding" line. `full` only. */
  showIndependenceNote?: boolean
}

export default function AuthorByline({ variant, showIndependenceNote = false }: AuthorBylineProps) {
  if (variant === 'compact') {
    return (
      <p className="text-sm text-muted">
        By{' '}
        <Link
          href={AUTHOR.aboutPath}
          className="font-semibold text-ink underline underline-offset-2 hover:no-underline hover:text-accent transition-colors"
        >
          {AUTHOR.name}
        </Link>
        , {AUTHOR.role}
      </p>
    )
  }

  // full
  return (
    <div className="border-t border-rule pt-6">
      <p
        className="text-kicker uppercase font-semibold text-muted mb-2"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        Edited by
      </p>
      <p className="font-serif text-lg text-ink leading-snug">
        {AUTHOR.name}
        <span className="text-muted"> — {AUTHOR.role}</span>
      </p>
      <p className="mt-1 text-sm text-muted leading-relaxed">
        A {AUTHOR.credential}.
      </p>
      {showIndependenceNote && (
        <p className="mt-3 max-w-prose text-sm text-muted leading-relaxed">
          {AUTHOR.independenceNote}
        </p>
      )}
    </div>
  )
}
