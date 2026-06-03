'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type TipType = 'tip' | 'warning' | 'praise'

export default function TipForm({ gameId }: { gameId: number }) {
  const t = useTranslations('parentTips')
  const router = useRouter()
  const [content, setContent]     = useState('')
  const [tipType, setTipType]     = useState<TipType>('tip')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const TYPE_CONFIG: Record<TipType, { labelKey: 'typePraise' | 'typeTip' | 'typeWarning'; icon: string; color: string }> = {
    praise:  { labelKey: 'typePraise',  icon: '★', color: 'border-ivy text-ivy' },
    tip:     { labelKey: 'typeTip',     icon: '💡', color: 'border-ink text-ink' },
    warning: { labelKey: 'typeWarning', icon: '⚠',  color: 'border-warm text-warm' },
  }

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
      <div className="text-sm text-ivy border-l-2 border-ivy pl-3 py-2">
        {t('thankYou')}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        {(Object.entries(TYPE_CONFIG) as [TipType, typeof TYPE_CONFIG[TipType]][]).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTipType(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-all ${
              tipType === key ? cfg.color : 'border-rule text-muted hover:border-ink'
            }`}
          >
            <span>{cfg.icon}</span> {t(cfg.labelKey)}
          </button>
        ))}
      </div>

      <div className="relative">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value.slice(0, 280))}
          placeholder={
            tipType === 'warning' ? t('placeholderWarning') :
            tipType === 'praise'  ? t('placeholderPraise') :
                                    t('placeholderTip')
          }
          rows={3}
          className="w-full text-sm border border-rule bg-paper text-ink px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink placeholder:text-muted"
        />
        <span className={`absolute bottom-3 right-3 text-[11px] font-medium ${remaining < 20 ? 'text-accent' : 'text-muted'}`}>
          {remaining}
        </span>
      </div>

      {error && <p className="text-xs text-accent">{error}</p>}

      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="px-4 py-2 bg-ink text-paper text-kicker uppercase font-semibold hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {loading ? t('posting') : t('postTip')}
      </button>
    </form>
  )
}
