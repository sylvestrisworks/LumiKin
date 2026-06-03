import Link from 'next/link'

// Locales where PEGI is the dominant rating board
const PEGI_LOCALES = new Set(['sv', 'de', 'fr', 'es'])

// DB slug → friendly hub URL slug (mirrors SLUG_ALIASES in platform/[slug]/page.tsx, inverted)
const PLATFORM_URL_SLUG: Record<string, string> = {
  'fortnite-creative': 'fortnite',
}

type RatingInfo = { label: string; board: string }

function resolveRating(
  esrb: string | null,
  pegi: number | null,
  locale: string,
): RatingInfo | null {
  const preferPegi = PEGI_LOCALES.has(locale)
  if (preferPegi && pegi != null) return { label: `PEGI ${pegi}`, board: 'PEGI' }
  if (esrb != null) return { label: esrb, board: 'ESRB' }
  if (pegi != null) return { label: `PEGI ${pegi}`, board: 'PEGI' }
  return null
}

type Props = {
  locale: string
  platformName: string
  platformSlug: string
  esrbRating: string | null
  pegiRating: number | null
  curascore: number | null
}

export default function UgcAttributionBlock({
  locale,
  platformName,
  platformSlug,
  esrbRating,
  pegiRating,
  curascore,
}: Props) {
  const rating = resolveRating(esrbRating, pegiRating, locale)
  const urlSlug = PLATFORM_URL_SLUG[platformSlug] ?? platformSlug

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border border-rule px-4 py-2.5 text-sm text-muted">
      {/* Piece 1: content type + platform link */}
      <span>
        A{' '}
        <Link
          href={`/${locale}/platform/${urlSlug}`}
          className="font-medium text-ink hover:text-accent transition-colors"
        >
          {platformName}
        </Link>
        {' '}experience
      </span>

      {/* Piece 2: official rating (omitted if unavailable) */}
      {rating && (
        <>
          <span aria-hidden="true" className="text-rule select-none">·</span>
          <span>
            {platformName} is rated{' '}
            <span className="font-semibold text-ink">{rating.label}</span>
            {' '}by {rating.board}
          </span>
        </>
      )}

      {/* Piece 3: this experience's LumiScore */}
      {curascore != null && (
        <>
          <span aria-hidden="true" className="text-rule select-none">·</span>
          <span>
            LumiScore{' '}
            <span className="font-semibold text-ink">{curascore}</span>
          </span>
        </>
      )}
    </div>
  )
}
