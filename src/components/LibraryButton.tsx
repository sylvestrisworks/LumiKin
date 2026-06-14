'use client'

import { useState, useEffect, useCallback } from 'react'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'

type Props = {
  gameId: number
  initialOwned:     boolean
  initialWishlisted: boolean
  /** Whether the visitor is signed in. When false, actions kick off sign-in. */
  signedIn: boolean
  /** Slug + locale used to build the post-sign-in return URL. */
  gameSlug: string
  locale: string
}

export default function LibraryButton({
  gameId, initialOwned, initialWishlisted, signedIn, gameSlug, locale,
}: Props) {
  const t = useTranslations('libraryButton')
  const [owned,     setOwned]     = useState(initialOwned)
  const [wishlisted, setWishlisted] = useState(initialWishlisted)
  const [loading,   setLoading]   = useState<'owned' | 'wishlist' | null>(null)

  const add = useCallback(async (listType: 'owned' | 'wishlist') => {
    setLoading(listType)
    try {
      const res = await fetch('/api/user-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, listType }),
      })
      if (!res.ok) throw new Error('POST failed')
      listType === 'owned' ? setOwned(true) : setWishlisted(true)
    } catch {
      /* leave state unchanged */
    } finally {
      setLoading(null)
    }
  }, [gameId])

  // Post-sign-in handoff: if we returned from Google with ?save=owned|wishlist,
  // complete the pending add once, then strip the param so a refresh won't repeat it.
  useEffect(() => {
    if (!signedIn || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const save = params.get('save')
    if (save !== 'owned' && save !== 'wishlist') return

    params.delete('save')
    const clean = window.location.pathname + (params.toString() ? `?${params}` : '')
    window.history.replaceState(null, '', clean)

    const already = save === 'owned' ? initialOwned : initialWishlisted
    if (!already) add(save)
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggle(listType: 'owned' | 'wishlist') {
    // Signed-out: send to Google, returning to this game to finish the save.
    if (!signedIn) {
      signIn('google', { callbackUrl: `/${locale}/game/${gameSlug}?save=${listType}` })
      return
    }

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
