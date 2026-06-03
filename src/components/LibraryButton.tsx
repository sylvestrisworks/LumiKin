'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = {
  gameId: number
  initialOwned:     boolean
  initialWishlisted: boolean
}

export default function LibraryButton({ gameId, initialOwned, initialWishlisted }: Props) {
  const t = useTranslations('libraryButton')
  const [owned,     setOwned]     = useState(initialOwned)
  const [wishlisted, setWishlisted] = useState(initialWishlisted)
  const [loading,   setLoading]   = useState<'owned' | 'wishlist' | null>(null)

  async function toggle(listType: 'owned' | 'wishlist') {
    const isActive = listType === 'owned' ? owned : wishlisted
    setLoading(listType)

    try {
      if (isActive) {
        const res = await fetch(`/api/user-games?gameId=${gameId}&listType=${listType}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('DELETE failed')
        listType === 'owned' ? setOwned(false) : setWishlisted(false)
      } else {
        const res = await fetch('/api/user-games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, listType }),
        })
        if (!res.ok) throw new Error('POST failed')
        listType === 'owned' ? setOwned(true) : setWishlisted(true)
      }
    } catch {
      // State unchanged — UI already shows the pre-toggle value
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => toggle('owned')}
        disabled={loading !== null}
        className={`flex items-center gap-1.5 px-4 py-2 text-kicker uppercase font-semibold border transition-colors disabled:opacity-60 ${
          owned
            ? 'bg-ink text-paper border-ink hover:bg-accent'
            : 'text-ink border-rule hover:border-ink hover:text-accent'
        }`}
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {loading === 'owned' ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <span>{owned ? '✓' : '+'}</span>
        )}
        {owned ? t('inLibrary') : t('addToLibrary')}
      </button>

      <button
        onClick={() => toggle('wishlist')}
        disabled={loading !== null}
        className={`flex items-center gap-1.5 px-4 py-2 text-kicker uppercase font-semibold border transition-colors disabled:opacity-60 ${
          wishlisted
            ? 'bg-warm text-paper border-warm hover:opacity-90'
            : 'text-ink border-rule hover:border-warm hover:text-warm'
        }`}
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {loading === 'wishlist' ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <span>{wishlisted ? '★' : '☆'}</span>
        )}
        {wishlisted ? t('wishlisted') : t('wishlist')}
      </button>
    </div>
  )
}
