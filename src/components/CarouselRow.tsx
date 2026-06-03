'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { GameSummary } from '@/types/game'
import { curascoreTextEditorial, esrbToAge } from '@/lib/ui'
import { localizeGenre } from '@/lib/i18n/genres'
import Icon, { type IconName } from '@/components/Icon'

// ─── Tile ─────────────────────────────────────────────────────────────────────

function CarouselTile({ game }: { game: GameSummary }) {
  const tGenres = useTranslations('genres')
  return (
    <Link href={`/game/${game.slug}`} className="group/tile shrink-0 w-48 sm:w-56 snap-start">
      {/* Image */}
      <div className="relative w-full h-32 sm:h-36 overflow-hidden bg-rule/30">
        {game.backgroundImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.backgroundImage}
            alt=""
            className="w-full h-full object-cover group-hover/tile:scale-105 transition-transform duration-300"
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
          <span className="absolute bottom-1.5 left-1.5 bg-paper text-ink text-kicker uppercase font-semibold px-1.5 py-0.5 leading-none"
            style={{ fontVariantCaps: 'all-small-caps' }}
            title={`Minimum age: ${esrbToAge(game.esrbRating)}`}>
            {esrbToAge(game.esrbRating)}
          </span>
        )}

        {/* Time rec — bottom right with clock icon */}
        {game.timeRecommendationMinutes != null && (
          <span className="absolute bottom-1.5 right-1.5 bg-ink/70 text-paper text-[9px] font-semibold px-1 py-0.5 leading-none flex items-center gap-0.5"
            title={`Recommended max ${game.timeRecommendationMinutes} min/day`}>
            <svg className="w-2 h-2 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            {game.timeRecommendationMinutes}m
          </span>
        )}
      </div>

      {/* Title */}
      <div className="mt-2 flex items-start justify-between gap-2">
        <p className="text-sm font-serif text-ink truncate group-hover/tile:text-accent transition-colors leading-tight">
          {game.title}
        </p>
        {game.curascore != null && (
          <span className={`font-serif text-sm font-semibold tabular-nums leading-none shrink-0 ${curascoreTextEditorial(game.curascore)}`}
            title="LumiScore — developmental benefit vs. design risk">
            {game.curascore}
          </span>
        )}
      </div>
      <p className="text-xs text-muted truncate mt-0.5">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {game.genres[0] ? localizeGenre(game.genres[0], tGenres as any) : (game.developer ?? '')}
      </p>
    </Link>
  )
}

// ─── Arrow button ─────────────────────────────────────────────────────────────

function Arrow({ dir, onClick, label }: { dir: 'left' | 'right'; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`absolute top-0 bottom-3 z-10 hidden sm:flex items-center
        ${dir === 'left' ? 'left-0 justify-start pl-1' : 'right-0 justify-end pr-1'}
        transition-opacity`}
    >
      <span className="w-8 h-8 rounded-full bg-paper shadow-md border border-rule flex items-center justify-center text-lg text-ink hover:text-accent hover:border-ink transition-colors select-none leading-none">
        {dir === 'left' ? '‹' : '›'}
      </span>
    </button>
  )
}

// ─── Carousel row ─────────────────────────────────────────────────────────────

type Props = {
  iconName: string
  title: string
  browseHref: string
  games: GameSummary[]
  index: number
  featured?: boolean
}

export default function CarouselRow({ iconName, title, browseHref, games, index, featured = false }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('carousel')

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' })
  }

  return (
    <section className={index > 0 ? 'pt-12' : ''}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={`${featured ? 'text-xl sm:text-2xl' : 'text-lg'} font-serif text-ink flex items-center gap-2`}>
          <Icon name={iconName as IconName} size={featured ? 22 : 20} aria-hidden="true" />
          <span>{title}</span>
        </h2>
        <Link
          href={browseHref}
          className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors shrink-0"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {t('seeAll')}
        </Link>
      </div>

      {/* Relative wrapper so arrows can be positioned against it */}
      <div className="relative group">
        <Arrow dir="left"  onClick={() => scroll('left')}  label={t('scrollLeft')}  />
        <Arrow dir="right" onClick={() => scroll('right')} label={t('scrollRight')} />

        {/* Right fade — signals more content on mobile */}
        <div className="pointer-events-none absolute top-0 right-0 bottom-3 w-12 bg-gradient-to-l from-paper to-transparent z-10 sm:hidden" />

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4
            [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]
            snap-x snap-mandatory scroll-smooth"
        >
          {games.map(game => (
            <CarouselTile key={game.slug} game={game} />
          ))}
        </div>
      </div>
    </section>
  )
}
