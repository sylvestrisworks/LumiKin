'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type TipType = 'tip' | 'warning' | 'praise'

const TYPE_CONFIG: Record<TipType, { label: string; icon: string; color: string }> = {
  praise:  { label: 'Praise',   icon: '★', color: 'bg-emerald-50 border-emerald-300 text-emerald-700' },
  tip:     { label: 'Tip',      icon: '💡', color: 'bg-indigo-50 border-indigo-300 text-indigo-700' },
  warning: { label: 'Warning',  icon: '⚠', color: 'bg-amber-50 border-amber-300 text-amber-700' },
}

export default function TipForm({ gameId }: { gameId: number }) {
  const router = useRouter()
  const [content, setContent]   = useState('')
  const [tipType, setTipType]   = useState<TipType>('tip')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const remaining = 280 - content.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/game-tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, content: content.trim(), tipType }),
    })

    if (res.ok) {
      setSubmitted(true)
      setContent('')
      router.refresh()
    } else {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Something went wrong.')
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        Thanks for the tip! It will appear shortly.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Type selector */}
      <div className="flex gap-2">
        {(Object.entries(TYPE_CONFIG) as [TipType, typeof TYPE_CONFIG[TipType]][]).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTipType(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              tipType === key ? cfg.color : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
            }`}
          >
            <span>{cfg.icon}</span> {cfg.label}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value.slice(0, 280))}
          placeholder={
            tipType === 'warning' ? 'What should parents watch out for?' :
            tipType === 'praise'  ? "What's great about this game for kids?" :
            'Share a helpful tip for other parents…'
          }
          rows={3}
          className="w-full text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
        <span className={`absolute bottom-3 right-3 text-[11px] font-medium ${remaining < 20 ? 'text-red-500' : 'text-slate-400'}`}>
          {remaining}
        </span>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Posting…' : 'Post tip'}
      </button>
    </form>
  )
}
