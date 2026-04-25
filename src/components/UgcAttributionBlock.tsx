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
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">
      {/* Piece 1: content type + platform link */}
      <span>
        A{' '}
        <Link
          href={`/${locale}/platform/${urlSlug}`}
          className="font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          {platformName}
        </Link>
        {' '}experience
      </span>

      {/* Piece 2: official rating (omitted if unavailable) */}
      {rating && (
        <>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600 select-none">·</span>
          <span>
            {platformName} is rated{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{rating.label}</span>
            {' '}by {rating.board}
          </span>
        </>
      )}

      {/* Piece 3: this experience's LumiScore */}
      {curascore != null && (
        <>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600 select-none">·</span>
          <span>
            LumiScore{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{curascore}</span>
          </span>
        </>
      )}
    </div>
  )
}
