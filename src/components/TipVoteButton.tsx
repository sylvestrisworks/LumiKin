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
      className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
        voted
          ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
          : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600'
      }`}
      title={voted ? 'Remove vote' : 'Helpful'}
    >
      ▲ {count > 0 && <span>{count}</span>}
    </button>
  )
}
