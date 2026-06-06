'use client'

import { useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { curascoreTextEditorial } from '@/lib/ui'
import Icon, { type IconName } from '@/components/Icon'

const SMALL_CAPS = { fontVariantCaps: 'all-small-caps' as const }

// ─── Arrow button — flat editorial square, no shadow, no rounding ─────────────

function Arrow({ dir, onClick, label }: { dir: 'left' | 'right'; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`absolute top-0 bottom-0 z-10 hidden sm:flex items-center opacity-0 group-hover:opacity-100 transition-opacity
        ${dir === 'left' ? 'left-0 justify-start' : 'right-0 justify-end'}`}
    >
      <span className="w-8 h-8 bg-paper border border-ink flex items-center justify-center text-lg text-ink hover:text-accent select-none leading-none transition-colors">
        {dir === 'left' ? '‹' : '›'}
      </span>
    </button>
  )
}

// ─── Tile — one normalized framed card for every carousel ────────────────────

export type CarouselTileProps = {
  index:     number
  href:      string
  image?:    string | null
  title:     string
  score?:    number | null
  ageLabel?: string | null
  ageTitle?: string
  footer?:   string | null
  /** Per-type extra (time-rec, active players) rendered as small-caps body text. */
  meta?:     ReactNode
  pending?:  boolean
}

export function CarouselTile({
  index, href, image, title, score, ageLabel, ageTitle, footer, meta, pending = false,
}: CarouselTileProps) {
  return (
    <Link
      href={href}
      className={`group/tile shrink-0 w-44 sm:w-52 snap-start border border-rule hover:border-ink transition-colors
        ${pending ? 'grayscale opacity-75 hover:opacity-100 hover:grayscale-0' : ''}`}
    >
      {/* Image */}
      <div className="relative h-28 sm:h-32 overflow-hidden bg-rule/30">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="w-full h-full object-cover group-hover/tile:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-rule/40">
            <span className="text-2xl font-serif text-muted select-none">
              {title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Filmstrip index — top left */}
        <span
          className="absolute top-1.5 left-1.5 bg-paper text-ink text-kicker font-semibold tabular-nums px-1.5 py-0.5 leading-none"
          style={SMALL_CAPS}
          aria-hidden="true"
        >
          {String(index).padStart(2, '0')}
        </span>

        {/* Min age — bottom left */}
        {!pending && ageLabel && (
          <span
            className="absolute bottom-1.5 left-1.5 bg-paper text-ink text-kicker uppercase font-semibold px-1.5 py-0.5 leading-none"
            style={SMALL_CAPS}
            title={ageTitle}
          >
            {ageLabel}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-serif text-ink leading-tight line-clamp-2 group-hover/tile:text-accent transition-colors">
            {title}
          </p>
          {!pending && score != null && (
            <span
              className={`font-serif text-sm font-semibold tabular-nums leading-none shrink-0 ${curascoreTextEditorial(score)}`}
              title="LumiScore — developmental benefit vs. design risk"
            >
              {score}
            </span>
          )}
        </div>

        {footer && (
          <span className="text-kicker uppercase text-muted truncate" style={SMALL_CAPS}>
            {footer}
          </span>
        )}

        {!pending && meta}
      </div>
    </Link>
  )
}

// ─── Rail — shared shell: ruled header + scroll container + arrows ────────────

type RailProps = {
  kicker:      string
  seeAllHref:  string
  iconName?:   IconName
  children:    ReactNode
}

export default function CarouselRail({ kicker, seeAllHref, iconName, children }: RailProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('carousel')

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' })
  }

  return (
    <section>
      {/* Ruled header — top hairline + small-caps kicker */}
      <div className="border-t border-ink pt-4 mb-4 flex items-center justify-between gap-4">
        <h2 className="text-kicker uppercase font-semibold text-ink flex items-center gap-2" style={SMALL_CAPS}>
          {iconName && <Icon name={iconName} size={16} aria-hidden="true" className="text-muted" />}
          <span>{kicker}</span>
        </h2>
        <Link
          href={seeAllHref}
          className="text-kicker uppercase font-semibold text-accent hover:text-ink transition-colors shrink-0 whitespace-nowrap"
          style={SMALL_CAPS}
        >
          {t('seeAll')}
        </Link>
      </div>

      {/* Relative wrapper so arrows position against the rail */}
      <div className="relative group">
        <Arrow dir="left"  onClick={() => scroll('left')}  label={t('scrollLeft')}  />
        <Arrow dir="right" onClick={() => scroll('right')} label={t('scrollRight')} />

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scroll-pl-4 scroll-pr-4
            [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]
            snap-x snap-mandatory scroll-smooth"
        >
          {children}
        </div>
      </div>
    </section>
  )
}
