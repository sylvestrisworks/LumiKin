'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { curascoreTextEditorial } from '@/lib/ui'
import { CONFIDENCE_THRESHOLD } from '@/lib/scoring/experience-risk'
import type { ExperienceSummary } from '@/components/ExperienceCard'
import Icon from '@/components/Icon'

function formatCount(n: number | null): string {
  if (n == null) return ''
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ─── Tile — matches CarouselTile dimensions exactly ───────────────────────────

function RobloxTile({ exp }: { exp: ExperienceSummary }) {
  const locale    = useLocale()
  const tCommon   = useTranslations('common')
  const isPending = (exp.inputConfidence ?? 0) < CONFIDENCE_THRESHOLD
  return (
    <Link
      href={`/${locale}/game/roblox/${exp.slug}`}
      className={`group/tile shrink-0 w-36 sm:w-44 snap-start ${isPending ? 'grayscale opacity-75 hover:opacity-100 hover:grayscale-0 transition-all' : ''}`}
    >
      {/* Image */}
      <div className="relative w-full h-24 sm:h-28 overflow-hidden bg-rule/30">
        {exp.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exp.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover group-hover/tile:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-rule/40">
            <span className="text-2xl font-serif text-muted select-none">
              {exp.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {!isPending && exp.recommendedMinAge != null && (
          <span
            className="absolute bottom-1.5 left-1.5 bg-paper text-ink text-kicker uppercase font-semibold px-1.5 py-0.5 leading-none"
            style={{ fontVariantCaps: 'all-small-caps' }}
            title={`Recommended age ${exp.recommendedMinAge}+`}
          >
            {exp.recommendedMinAge}+
          </span>
        )}

        {/* Active players — bottom right */}
        {exp.activePlayers != null && exp.activePlayers > 0 && (
          <span
            className="absolute bottom-1.5 right-1.5 bg-ink/70 text-paper text-[9px] font-semibold px-1 py-0.5 leading-none flex items-center gap-0.5"
            title={`${formatCount(exp.activePlayers)} playing now`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-ivy inline-block shrink-0" />
            {formatCount(exp.activePlayers)}
          </span>
        )}
      </div>

      {/* Title + creator */}
      <div className="mt-2 flex items-start justify-between gap-2">
        <p className="text-xs font-serif text-ink truncate group-hover/tile:text-accent transition-colors leading-tight">
          {exp.title}
        </p>
        {!isPending && exp.curascore != null && (
          <span className={`font-serif text-xs font-semibold tabular-nums leading-none shrink-0 ${curascoreTextEditorial(exp.curascore)}`} title="LumiScore">
            {exp.curascore}
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted truncate mt-0.5">
        {isPending ? tCommon('notEnoughInfo') : (exp.creatorName ?? '')}
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
      <span className="w-8 h-8 rounded-full bg-paper shadow-md border border-rule flex items-center justify-center text-lg text-ink hover:text-accent hover:border-ink transition-colors select-none leading-none">
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
        <h2 className="text-lg font-serif text-ink flex items-center gap-2">
          <Icon name="roblox" size={20} aria-hidden="true" />
          <span>{t('carouselTitle')}</span>
        </h2>
        <Link
          href={`/${locale}/game/roblox`}
          className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors shrink-0"
          style={{ fontVariantCaps: 'all-small-caps' }}
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
