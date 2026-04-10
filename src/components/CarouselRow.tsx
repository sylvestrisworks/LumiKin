'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { GameSummary } from '@/types/game'
import { curascoreBg, esrbToAge, ageBadgeColor } from '@/lib/ui'

// ─── Tile ─────────────────────────────────────────────────────────────────────

function CarouselTile({ game }: { game: GameSummary }) {
  return (
    <Link href={`/game/${game.slug}`} className="group/tile shrink-0 w-36 sm:w-44 snap-start">
      {/* Image */}
      <div className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-indigo-100 dark:bg-indigo-900/40">
        {game.backgroundImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.backgroundImage}
            alt=""
            className="w-full h-full object-cover group-hover/tile:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-200 dark:from-indigo-900/40 dark:to-violet-900/40">
            <span className="text-2xl font-black text-indigo-300 dark:text-indigo-500 select-none">
              {game.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Curascore badge — top right */}
        {game.curascore != null && (
          <span className={`absolute top-1.5 right-1.5 ${curascoreBg(game.curascore)} text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none`}
            title="Curascore — developmental benefit vs. design risk">
            {game.curascore}
          </span>
        )}

        {/* Min age badge — bottom left */}
        {game.esrbRating && (
          <span className={`absolute bottom-1.5 left-1.5 ${ageBadgeColor(game.esrbRating)} text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none`}
            title={`Minimum age: ${esrbToAge(game.esrbRating)}`}>
            {esrbToAge(game.esrbRating)}
          </span>
        )}

        {/* Time rec — bottom right with clock icon */}
        {game.timeRecommendationMinutes != null && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] font-semibold px-1 py-0.5 rounded leading-none flex items-center gap-0.5"
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
      <p className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-100 truncate group-hover/tile:text-indigo-700 dark:group-hover/tile:text-indigo-400 transition-colors leading-tight">
        {game.title}
      </p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
        {game.genres[0] ?? game.developer ?? ''}
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
        opacity-0 group-hover:opacity-100 transition-opacity`}
    >
      <span className="w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800/95 shadow-md border border-slate-200 dark:border-slate-600 flex items-center justify-center text-lg text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors select-none leading-none">
        {dir === 'left' ? '‹' : '›'}
      </span>
    </button>
  )
}

// ─── Carousel row ─────────────────────────────────────────────────────────────

type Props = {
  emoji: string
  title: string
  browseHref: string
  games: GameSummary[]
  index: number
}

export default function CarouselRow({ emoji, title, browseHref, games, index }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('carousel')

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' })
  }

  return (
    <section className={index > 0 ? 'pt-10 border-t border-slate-100 dark:border-slate-700/50' : ''}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>{emoji}</span>
          <span>{title}</span>
        </h2>
        <Link
          href={browseHref}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors shrink-0"
        >
          {t('seeAll')}
        </Link>
      </div>

      {/* Relative wrapper so arrows can be positioned against it */}
      <div className="relative group">
        <Arrow dir="left"  onClick={() => scroll('left')}  label={t('scrollLeft')}  />
        <Arrow dir="right" onClick={() => scroll('right')} label={t('scrollRight')} />

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
