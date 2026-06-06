'use client'

import { useTranslations } from 'next-intl'
import type { GameSummary } from '@/types/game'
import { esrbToAge } from '@/lib/ui'
import { localizeGenre } from '@/lib/i18n/genres'
import type { IconName } from '@/components/Icon'
import CarouselRail, { CarouselTile } from '@/components/CarouselRail'

const SMALL_CAPS = { fontVariantCaps: 'all-small-caps' as const }

type Props = {
  iconName:  string
  title:     string
  browseHref: string
  games:     GameSummary[]
  index:     number
  featured?: boolean
}

export default function CarouselRow({ iconName, title, browseHref, games, index }: Props) {
  const tGenres  = useTranslations('genres')
  const tCompact = useTranslations('gameCompact')

  return (
    <div className={index > 0 ? 'pt-10' : ''}>
      <CarouselRail kicker={title} seeAllHref={browseHref} iconName={iconName as IconName}>
        {games.map((game, i) => (
          <CarouselTile
            key={game.slug}
            index={i + 1}
            href={`/game/${game.slug}`}
            image={game.backgroundImage}
            title={game.title}
            score={game.curascore}
            ageLabel={game.esrbRating ? esrbToAge(game.esrbRating) : null}
            ageTitle={game.esrbRating ? `Minimum age: ${esrbToAge(game.esrbRating)}` : undefined}
            footer={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              game.genres[0] ? localizeGenre(game.genres[0], tGenres as any) : (game.developer ?? null)
            }
            meta={
              game.timeRecommendationMinutes != null ? (
                <span className="text-kicker uppercase text-muted tabular-nums" style={SMALL_CAPS}>
                  {game.timeRecommendationMinutes} {tCompact('minDay')}
                </span>
              ) : null
            }
          />
        ))}
      </CarouselRail>
    </div>
  )
}
