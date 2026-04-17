'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { curascoreBg } from '@/lib/ui'
import type { ExperienceSummary } from '@/components/ExperienceCard'

// ─── Tile ─────────────────────────────────────────────────────────────────────

function FortniteTile({ exp }: { exp: ExperienceSummary }) {
  const locale = useLocale()
  return (
    <Link href={`/${locale}/game/fortnite-creative/${exp.slug}`} className="group/tile shrink-0 w-36 sm:w-44 snap-start">
      {/* Image */}
      <div className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-blue-100 dark:bg-blue-900/40">
        {exp.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exp.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover group-hover/tile:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-violet-200 dark:from-blue-900/40 dark:to-violet-900/40">
            <span className="text-2xl font-black text-blue-300 dark:text-blue-500 select-none">
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
      <span className="w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800/95 shadow-md border border-slate-200 dark:border-slate-600 flex items-center justify-center text-lg text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors select-none leading-none">
        {dir === 'left' ? '‹' : '›'}
      </span>
    </button>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

export default function FortniteCarouselRow({ experiences }: { experiences: ExperienceSummary[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const locale = useLocale()
  const t  = useTranslations('fortnite')
  const tc = useTranslations('carousel')

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' })
  }

  if (experiences.length === 0) return null

  return (
    <section className="pt-10 border-t border-slate-100 dark:border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-black text-blue-500 leading-none">FN</span>
          </span>
          <span>{t('carouselTitle')}</span>
        </h2>
        <Link
          href={`/${locale}/game/fortnite-creative`}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors shrink-0"
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
            <FortniteTile key={exp.slug} exp={exp} />
          ))}
        </div>
      </div>
    </section>
  )
}
