'use client'

import { Link } from '@/navigation'
import { useTranslations } from 'next-intl'
import { curascoreTextEditorial, esrbToAge } from '@/lib/ui'
import { localizeGenre } from '@/lib/i18n/genres'
import Icon, { type IconName } from '@/components/Icon'
import type { GameSummary } from '@/types/game'

/** Age fit against the currently-selected child (only set in child-filtered view). */
export type AgeFit = { fits: boolean; minAge: number | null; gap: number | null }

// Platform a game was imported from → corner glyph. 'manual' entries show nothing.
const SOURCE_ICON: Record<string, IconName> = {
  steam: 'steam',
  epic:  'epic',
  gog:   'gog',
  xbox:  'xbox',
}

type Props = {
  game: GameSummary
  /** When present, the card shows an age-fit glyph for the selected child. */
  ageFit?: AgeFit | null
  /** Import provenance ('steam' | 'epic' | 'gog' | 'xbox' | 'manual'). */
  source?: string | null
}

// Editorial collection card — denser than ListingCard (no dek/byline) but with
// the same magazine treatment: a treated cover photo, genre kicker, serif title,
// a verdict numeral, and a small-caps time·age footer. Used on the Library grid.
export default function LibraryCard({ game, ageFit, source }: Props) {
  const t       = useTranslations('library')
  const tCompact = useTranslations('gameCompact')
  const tGenres = useTranslations('genres')

  const sourceIcon = source ? SOURCE_ICON[source] : undefined

  return (
    <Link
      href={`/game/${game.slug}`}
      className="group flex flex-col h-full border-b border-ink/30 pb-4 hover:border-ink transition-colors"
    >
      {/* Treated cover, matching ListingCard / TodaysReview photography. */}
      <div className="relative mb-3">
        {game.backgroundImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.backgroundImage}
            alt=""
            className="aspect-[4/3] w-full object-cover"
            style={{ filter: 'saturate(1.05) contrast(1.03)' }}
          />
        ) : (
          <div className="aspect-[4/3] w-full bg-rule/30 flex items-center justify-center" aria-hidden>
            <span className="text-3xl font-serif text-muted select-none">
              {game.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Import-source glyph — top right */}
        {sourceIcon && (
          <span
            className="absolute top-1.5 right-1.5 bg-paper/90 text-ink p-1 leading-none"
            title={`Imported from ${source}`}
          >
            <Icon name={sourceIcon} size={13} aria-hidden="true" />
          </span>
        )}
      </div>

      {/* Genre kicker */}
      {game.genres[0] && (
        <p
          className="text-kicker uppercase font-semibold text-muted mb-1"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {localizeGenre(game.genres[0], tGenres as any)}
        </p>
      )}

      {/* Title + verdict numeral */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif text-lg leading-tight tracking-tight line-clamp-2 group-hover:text-accent transition-colors">
          {game.title}
        </h3>
        {game.curascore != null && (
          <span className={`font-serif text-2xl font-medium tabular-nums leading-none shrink-0 ${curascoreTextEditorial(game.curascore)}`}>
            {game.curascore}
          </span>
        )}
      </div>

      {/* Footer: time · age, then flags */}
      <div className="mt-auto pt-3 space-y-1">
        <p
          className="text-kicker uppercase text-muted"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {game.timeRecommendationMinutes != null && (
            <>{game.timeRecommendationMinutes} {tCompact('minDay')}</>
          )}
          {game.timeRecommendationMinutes != null && game.esrbRating && ' · '}
          {game.esrbRating && <>ages {esrbToAge(game.esrbRating)}</>}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {/* Age fit — only in child-filtered view */}
          {ageFit && (
            ageFit.fits ? (
              <span className="text-xs text-ivy">{t('ageFitOk')}</span>
            ) : (
              <span className="text-xs text-accent">
                {t('ageFitTooYoung', { min: ageFit.minAge ?? 0 })}
              </span>
            )
          )}
          {(game.hasLootBoxes || game.hasMicrotransactions) && (
            <span className="text-xs text-warm" title={tCompact('hasMonetization')}>
              💰 {tCompact('monetization')}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
