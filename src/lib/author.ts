// Single source of truth for the founder/editor identity, the canonical entity
// @ids, and the schema.org/Person node. Everything that renders Johan's byline
// or emits author/founder JSON-LD imports from here so the visible byline and
// the machine-readable entity can never drift apart.
//
// See docs/lumikin-about-page-brief.md for the rationale (named, accountable
// editor; entity disambiguation for AI Overviews / knowledge graph).

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'

/** Canonical @id of the LumiKin Organization node. Must match every Organization emission. */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`

/** Stable @id of the founder Person node. Reused as the author/founder reference everywhere. */
export const PERSON_ID = `${SITE_URL}/about#johan-sjostedt`

/**
 * Human-readable author facts. The byline component and the prose blocks read
 * these so the on-screen name/role/credential match the schema exactly.
 */
export const AUTHOR = {
  name: 'Johan Sjöstedt',
  role: 'Founder & Editor',
  /** One-line credential used in the `full` byline. */
  credential: 'journalist with a background in anthropology',
  /** Independence line — credentialed contexts only, never bolted onto the warm narrative. */
  independenceNote:
    'LumiKin is independent: it takes no funding from the platforms it rates or from the parental-control vendors it works with, and every score carries a named, accountable editor behind it.',
  aboutPath: '/about',
} as const

/**
 * Lightweight reference used wherever the Person is cited rather than fully
 * described (Organization.founder, methodology author). Referencing by @id
 * keeps the full Person node singular — emitted only on /about.
 */
export const authorRef = { '@id': PERSON_ID } as const

/**
 * The full schema.org/Person node. Emit this ONCE, on /about. Other pages
 * reference it via `authorRef` / `founderRef` to avoid duplicate nodes.
 *
 * NOTE: `sameAs` is intentionally empty — Johan supplies the real profile URLs.
 * Do not invent any. Uncomment and fill the placeholders below when available;
 * list the journalism portfolio / byline page first (highest-value entry).
 */
export const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': PERSON_ID,
  name: AUTHOR.name,
  jobTitle: AUTHOR.role,
  description:
    'Journalist with a background in anthropology; founder and editor of LumiKin, an independent, research-grounded child-safety game rating platform.',
  knowsAbout: [
    'video game ratings',
    'child development',
    'media literacy',
    'dark patterns in games',
  ],
  sameAs: [
    // FILL: journalism portfolio / byline page URL  <-- highest-value entry, keep first
    // FILL: LinkedIn profile URL
    // FILL: Instagram profile URL (optional)
  ] as string[],
  worksFor: { '@id': ORGANIZATION_ID },
} as const

/** The founder reference attached to the Organization node. */
export const founderRef = { '@id': PERSON_ID } as const

/** Shared JSON-LD serializer: escapes the characters that can break out of a <script> tag. */
export const ldJson = (obj: unknown): string =>
  JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
