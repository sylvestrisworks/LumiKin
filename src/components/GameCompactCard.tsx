'use client'

import Image from 'next/image'
import { Link } from '@/navigation'
import { useTranslations } from 'next-intl'
import { curascoreTextEditorial, esrbToAge } from '@/lib/ui'
import { localizeGenre } from '@/lib/i18n/genres'
import { safeImageUrl } from '@/lib/images'
import type { GameSummary } from '@/types/game'

type Props = {
  game: GameSummary
}

export default function GameCompactCard({ game }: Props) {
  const t       = useTranslations('gameCompact')
  const tGenres = useTranslations('genres')
  const safeImg = safeImageUrl(game.backgroundImage)
  return (
    <Link
      href={`/game/${game.slug}`}
      className="group flex flex-col border border-rule overflow-hidden hover:border-ink transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative h-28 bg-rule/30 overflow-hidden shrink-0">
        {safeImg ? (
          <Image
            src={safeImg}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 280px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-rule/40">
            <span className="text-2xl font-serif text-muted select-none">
              {game.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Min age badge — bottom left */}
        {game.esrbRating && (
          <div
            className="absolute bottom-1.5 left-1.5 bg-paper text-ink text-kicker uppercase font-semibold px-1.5 py-0.5 leading-none"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {esrbToAge(game.esrbRating)}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 flex flex-col gap-1 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-serif text-sm text-ink leading-tight line-clamp-2 group-hover:text-accent transition-colors">
            {game.title}
          </p>
          {game.curascore != null && (
            <span className={`font-serif text-base font-semibold tabular-nums leading-none shrink-0 ${curascoreTextEditorial(game.curascore)}`}>
              {game.curascore}
            </span>
          )}
        </div>

        {game.genres[0] && (
          <span
            className="text-kicker uppercase text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {localizeGenre(game.genres[0], tGenres as any)}
          </span>
        )}

        {/* Footer row — time recommendation + monetization flag share one line */}
        {(game.timeRecommendationMinutes != null || game.hasLootBoxes || game.hasMicrotransactions) && (
          <div className="mt-auto pt-1 flex items-center justify-between gap-2">
            {game.timeRecommendationMinutes != null ? (
              <span className="text-xs text-muted">{game.timeRecommendationMinutes} {t('minDay')}</span>
            ) : <span />}
            {(game.hasLootBoxes || game.hasMicrotransactions) && (
              <span className="text-xs text-warm" title={t('hasMonetization')}>💰 {t('monetization')}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
