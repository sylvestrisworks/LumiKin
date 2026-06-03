'use client'

import { useState } from 'react'

type Props = {
  tipId: number
  initialCount: number
  initialVoted: boolean
}

export default function TipVoteButton({ tipId, initialCount, initialVoted }: Props) {
  const [voted, setVoted]   = useState(initialVoted)
  const [count, setCount]   = useState(initialCount)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (loading) return
    setLoading(true)
    // Optimistic update
    setVoted(v => !v)
    setCount(c => voted ? c - 1 : c + 1)

    const res = await fetch(`/api/game-tips/${tipId}/vote`, { method: 'POST' })
    if (!res.ok) {
      // Revert on failure
      setVoted(v => !v)
      setCount(c => voted ? c + 1 : c - 1)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 border transition-all ${
        voted
          ? 'bg-ink border-ink text-paper hover:bg-accent'
          : 'border-rule text-muted hover:border-ink hover:text-accent'
      }`}
      title={voted ? 'Remove vote' : 'Helpful'}
    >
      ▲ {count > 0 && <span>{count}</span>}
    </button>
  )
}
