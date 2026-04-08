'use client'

import { useState, useEffect, useRef } from 'react'
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

export default function SearchBar({ placeholder = 'Search games…' }: { placeholder?: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        const data: GameSummary[] = await res.json()
        setResults(data)
        setOpen(data.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function navigate(slug: string) {
    setOpen(false)
    setQuery('')
    router.push(`/game/${slug}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (results.length > 0) navigate(results[0].slug)
  }

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
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={placeholder}
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
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {results.map((game) => (
            <button
              key={game.slug}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0 transition-colors"
              onClick={() => navigate(game.slug)}
            >
              {/* Thumbnail or initials */}
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-indigo-100 shrink-0 flex items-center justify-center">
                {game.backgroundImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={game.backgroundImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-indigo-600">
                    {game.title.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{game.title}</p>
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
          ))}
        </div>
      )}
    </div>
  )
}
