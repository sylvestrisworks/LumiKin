'use client'

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import Image from 'next/image'
import { Link, useRouter } from '@/navigation'
import { useTranslations } from 'next-intl'
import type { GameSummary } from '@/types/game'

type SearchResult = GameSummary & { resultType?: 'game' | 'experience' }
import { esrbToAge, curascoreTextEditorial } from '@/lib/ui'
import { localizeGenre } from '@/lib/i18n/genres'

function esrbBadge(rating: string | null) {
  if (!rating) return null
  return (
    <span
      className="text-kicker uppercase font-semibold text-muted border border-rule px-1.5 py-0.5"
      style={{ fontVariantCaps: 'all-small-caps' }}
    >
      {esrbToAge(rating)}
    </span>
  )
}

function curascoreChip(score: number | null | undefined) {
  if (score == null) return null
  return <span className={`font-serif text-sm font-semibold tabular-nums ${curascoreTextEditorial(score)}`}>{score}</span>
}

// Split "The Legend of Zelda: Breath of the Wild" → ["The Legend of Zelda", "Breath of the Wild"]
// Splits on " — ", " - ", ": " (subtitle separators)
function splitTitle(title: string): [string, string | null] {
  const m = title.match(/^(.+?)(?:\s[—–-]\s|:\s)(.+)$/)
  if (m) return [m[1], m[2]]
  return [title, null]
}

export default function SearchBar({ placeholder }: { placeholder?: string }) {
  const t       = useTranslations('search')
  const tGenres = useTranslations('genres')
  const listboxId = useId()
  const defaultPlaceholder = placeholder ?? t('placeholder')
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<SearchResult[]>([])
  const [loading, setLoading]     = useState(false)
  const [open, setOpen]           = useState(false)
  const [searched, setSearched]   = useState(false)   // true after first completed fetch
  const [focusedIdx, setFocusedIdx] = useState(-1)

  const router       = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemRefs     = useRef<(HTMLButtonElement | null)[]>([])

  const minLen = query.trim().length === 1 && query.trim() === query.trim().toUpperCase() ? 1 : 2

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < minLen) {
      setResults([])
      setOpen(false)
      setSearched(false)
      setFocusedIdx(-1)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        const data: SearchResult[] = await res.json()
        setResults(data)
        setOpen(true)
        setSearched(true)
        setFocusedIdx(-1)
      } catch {
        setResults([])
        setSearched(true)
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [query, minLen])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIdx >= 0) itemRefs.current[focusedIdx]?.scrollIntoView({ block: 'nearest' })
  }, [focusedIdx])

  const navigate = useCallback((result: SearchResult) => {
    setOpen(false)
    setQuery('')
    setSearched(false)
    if (result.resultType === 'experience') {
      router.push(`/game/roblox/${result.slug}`)
    } else {
      router.push(`/game/${result.slug}`)
    }
  }, [router])

  // A miss is never a dead end — fall through to the browse catalogue,
  // which supports full-text filtering via ?q=.
  const browseFallback = useCallback(() => {
    const q = query.trim()
    if (!q) return
    setOpen(false)
    setQuery('')
    setSearched(false)
    router.push(`/browse?q=${encodeURIComponent(q)}`)
  }, [query, router])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    const count = results.length

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx(i => Math.min(i + 1, count - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx(i => {
        if (i <= 0) { inputRef.current?.focus(); return -1 }
        return i - 1
      })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (focusedIdx >= 0 && results[focusedIdx]) {
        navigate(results[focusedIdx])
      } else if (results.length > 0) {
        navigate(results[0])
      } else {
        browseFallback()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setFocusedIdx(-1)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (focusedIdx >= 0 && results[focusedIdx]) {
      navigate(results[focusedIdx])
    } else if (results.length > 0) {
      navigate(results[0])
    } else {
      browseFallback()
    }
  }

  const showDropdown = open && query.trim().length >= minLen
  const showNoResults = showDropdown && !loading && searched && results.length === 0

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => (results.length > 0 || showNoResults) && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={defaultPlaceholder}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-activedescendant={focusedIdx >= 0 ? `${listboxId}-opt-${focusedIdx}` : undefined}
            aria-label={defaultPlaceholder}
            className="w-full pl-12 pr-4 py-3.5 text-base border border-ink/60 bg-paper text-ink font-serif transition-colors focus:outline-none focus:border-accent placeholder:italic placeholder:text-muted"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2" aria-label={t('loading')} role="status">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div
          role="listbox"
          id={listboxId}
          className="absolute top-full -mt-px left-0 right-0 bg-paper border border-ink/60 z-[200] overflow-hidden max-h-[70vh] overflow-y-auto"
        >
          {results.length > 0 ? (
            results.map((game, idx) => {
              const [mainTitle, subtitle] = splitTitle(game.title)
              const isFocused = idx === focusedIdx
              return (
                <button
                  key={game.slug}
                  ref={el => { itemRefs.current[idx] = el }}
                  role="option"
                  id={`${listboxId}-opt-${idx}`}
                  aria-selected={isFocused}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-ink/20 last:border-0 transition-colors ${isFocused ? 'bg-ink/[0.06]' : 'hover:bg-ink/[0.03]'}`}
                  onClick={() => navigate(game)}
                  onMouseEnter={() => setFocusedIdx(idx)}
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 overflow-hidden bg-ink/10 shrink-0 flex items-center justify-center">
                    {game.backgroundImage ? (
                      <Image src={game.backgroundImage} alt="" width={40} height={40} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-ink/50 font-serif">
                        {mainTitle.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-base font-serif font-medium text-ink truncate">
                      {mainTitle}
                      {subtitle && (
                        <span className="font-normal text-muted"> · {subtitle}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {game.developer && (
                        <span className="text-xs text-muted truncate">{game.developer}</span>
                      )}
                      {game.genres[0] && (
                        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                        <span className="text-xs text-muted">· {localizeGenre(game.genres[0], tGenres as any)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {esrbBadge(game.esrbRating)}
                    {curascoreChip(game.curascore)}
                  </div>
                </button>
              )
            })
          ) : showNoResults ? (
            <div className="px-5 py-4 text-center">
              <p className="text-sm font-serif italic text-muted">
                {t('noResults', { query })}
              </p>
              <Link
                href={`/browse?q=${encodeURIComponent(query.trim())}`}
                onClick={() => { setOpen(false); setQuery(''); setSearched(false) }}
                className="mt-2 inline-block text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {t('browseAll')}
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
