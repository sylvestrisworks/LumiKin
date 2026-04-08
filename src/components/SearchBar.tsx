'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { GameSummary } from '@/types/game'
import { esrbToAge, ageBadgeColor } from '@/lib/ui'

function esrbBadge(rating: string | null) {
  if (!rating) return null
  return (
    <span className={`text-xs font-black px-1.5 py-0.5 rounded-full text-white ${ageBadgeColor(rating)}`}>
      {esrbToAge(rating)}
    </span>
  )
}

function curascoreChip(score: number | null | undefined) {
  if (score == null) return null
  const bg = score >= 70 ? 'bg-emerald-100 text-emerald-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${bg}`}>{score}</span>
}

// Split "The Legend of Zelda: Breath of the Wild" → ["The Legend of Zelda", "Breath of the Wild"]
// Splits on " — ", " - ", ": " (subtitle separators)
function splitTitle(title: string): [string, string | null] {
  const m = title.match(/^(.+?)(?:\s[—–-]\s|:\s)(.+)$/)
  if (m) return [m[1], m[2]]
  return [title, null]
}

export default function SearchBar({ placeholder = 'Search games…' }: { placeholder?: string }) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<GameSummary[]>([])
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
        const data: GameSummary[] = await res.json()
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

  const navigate = useCallback((slug: string) => {
    setOpen(false)
    setQuery('')
    setSearched(false)
    router.push(`/game/${slug}`)
  }, [router])

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
        navigate(results[focusedIdx].slug)
      } else if (results.length > 0) {
        navigate(results[0].slug)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setFocusedIdx(-1)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (focusedIdx >= 0 && results[focusedIdx]) {
      navigate(results[focusedIdx].slug)
    } else if (results.length > 0) {
      navigate(results[0].slug)
    }
  }

  const showDropdown = open && query.trim().length >= minLen
  const showNoResults = showDropdown && !loading && searched && results.length === 0

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
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
            placeholder={placeholder}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            className="w-full pl-12 pr-4 py-3.5 text-base rounded-xl border border-slate-300 bg-white shadow-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
              placeholder:text-slate-400"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2" aria-label="Loading results" role="status">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div
          role="listbox"
          className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-[200] overflow-hidden max-h-[70vh] overflow-y-auto"
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
                  aria-selected={isFocused}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 last:border-0 transition-colors
                    ${isFocused ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                  onClick={() => navigate(game.slug)}
                  onMouseEnter={() => setFocusedIdx(idx)}
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-indigo-100 shrink-0 flex items-center justify-center">
                    {game.backgroundImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={game.backgroundImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-indigo-600">
                        {mainTitle.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {mainTitle}
                      {subtitle && (
                        <span className="font-normal text-slate-400"> · {subtitle}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {game.developer && (
                        <span className="text-xs text-slate-500 truncate">{game.developer}</span>
                      )}
                      {game.genres[0] && (
                        <span className="text-xs text-slate-400">· {game.genres[0]}</span>
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
              <p className="text-sm text-slate-500">No results for <span className="font-semibold">"{query}"</span></p>
              <a
                href="/browse"
                className="mt-2 inline-block text-xs text-indigo-600 hover:underline font-medium"
              >
                Browse all games →
              </a>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
