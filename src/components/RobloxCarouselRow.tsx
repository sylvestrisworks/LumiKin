'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { curascoreBg } from '@/lib/ui'
import type { ExperienceSummary } from '@/components/ExperienceCard'

function formatCount(n: number | null): string {
  if (n == null) return ''
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ─── Tile — matches CarouselTile dimensions exactly ───────────────────────────

function RobloxTile({ exp }: { exp: ExperienceSummary }) {
  const locale = useLocale()
  return (
    <Link href={`/${locale}/game/roblox/${exp.slug}`} className="group/tile shrink-0 w-36 sm:w-44 snap-start">
      {/* Image */}
      <div className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-red-100 dark:bg-red-900/40">
        {exp.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exp.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover group-hover/tile:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-100 to-orange-200 dark:from-red-900/40 dark:to-orange-900/40">
            <span className="text-2xl font-black text-red-300 dark:text-red-500 select-none">
              {exp.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* LumiScore badge — top right */}
        {exp.curascore != null && (
          <span
            className={`absolute top-1.5 right-1.5 ${curascoreBg(exp.curascore)} text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none`}
            title="LumiScore"
          >
            {exp.curascore}
          </span>
        )}

        {/* Min age badge — bottom left */}
        {exp.recommendedMinAge != null && (
          <span
            className="absolute bottom-1.5 left-1.5 bg-slate-700 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none"
            title={`Recommended age ${exp.recommendedMinAge}+`}
          >
            {exp.recommendedMinAge}+
          </span>
        )}

        {/* Active players — bottom right */}
        {exp.activePlayers != null && exp.activePlayers > 0 && (
          <span
            className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] font-semibold px-1 py-0.5 rounded leading-none flex items-center gap-0.5"
            title={`${formatCount(exp.activePlayers)} playing now`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
            {formatCount(exp.activePlayers)}
          </span>
        )}
      </div>

      {/* Title + creator */}
      <p className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-100 truncate group-hover/tile:text-indigo-700 dark:group-hover/tile:text-indigo-400 transition-colors leading-tight">
        {exp.title}
      </p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
        {exp.creatorName ?? ''}
      </p>
    </Link>
  )
}

// ─── Arrow button — identical to CarouselRow ─────────────────────────────────

function Arrow({ dir, onClick, label }: { dir: 'left' | 'right'; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`absolute top-0 bottom-3 z-10 hidden sm:flex items-center
        ${dir === 'left' ? 'left-0 justify-start pl-1' : 'right-0 justify-end pr-1'}
        transition-opacity`}
    >
      <span className="w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800/95 shadow-md border border-slate-200 dark:border-slate-600 flex items-center justify-center text-lg text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors select-none leading-none">
        {dir === 'left' ? '‹' : '›'}
      </span>
    </button>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

export default function RobloxCarouselRow({ experiences }: { experiences: ExperienceSummary[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const locale = useLocale()
  const t  = useTranslations('roblox')
  const tc = useTranslations('carousel')

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' })
  }

  if (experiences.length === 0) return null

  return (
    <section className="pt-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>🟥</span>
          <span>{t('carouselTitle')}</span>
        </h2>
        <Link
          href={`/${locale}/game/roblox`}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors shrink-0 px-2 py-1 -mr-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
        >
          {tc('seeAll')}
        </Link>
      </div>

      <div className="relative group">
        <Arrow dir="left"  onClick={() => scroll('left')}  label={tc('scrollLeft')}  />
        <Arrow dir="right" onClick={() => scroll('right')} label={tc('scrollRight')} />

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4
            [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]
            snap-x snap-mandatory scroll-smooth"
        >
          {experiences.map(exp => (
            <RobloxTile key={exp.slug} exp={exp} />
          ))}
        </div>
      </div>

    </section>
  )
}
