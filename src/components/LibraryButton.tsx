'use client'

import { useState } from 'react'

type Props = {
  gameId: number
  initialOwned:     boolean
  initialWishlisted: boolean
}

export default function LibraryButton({ gameId, initialOwned, initialWishlisted }: Props) {
  const [owned,     setOwned]     = useState(initialOwned)
  const [wishlisted, setWishlisted] = useState(initialWishlisted)
  const [loading,   setLoading]   = useState<'owned' | 'wishlist' | null>(null)

  async function toggle(listType: 'owned' | 'wishlist') {
    const isActive = listType === 'owned' ? owned : wishlisted
    setLoading(listType)

    if (isActive) {
      await fetch(`/api/user-games?gameId=${gameId}&listType=${listType}`, { method: 'DELETE' })
      listType === 'owned' ? setOwned(false) : setWishlisted(false)
    } else {
      await fetch('/api/user-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, listType }),
      })
      listType === 'owned' ? setOwned(true) : setWishlisted(true)
    }

    setLoading(null)
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => toggle('owned')}
        disabled={loading !== null}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-60 ${
          owned
            ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
            : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:text-indigo-700'
        }`}
      >
        {loading === 'owned' ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <span>{owned ? '✓' : '+'}</span>
        )}
        {owned ? 'In Library' : 'Add to Library'}
      </button>

      <button
        onClick={() => toggle('wishlist')}
        disabled={loading !== null}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-60 ${
          wishlisted
            ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
            : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400 hover:text-amber-600'
        }`}
      >
        {loading === 'wishlist' ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <span>{wishlisted ? '★' : '☆'}</span>
        )}
        {wishlisted ? 'Wishlisted' : 'Wishlist'}
      </button>
    </div>
  )
}
