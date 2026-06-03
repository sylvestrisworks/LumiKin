'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type FeedbackT = ReturnType<typeof useTranslations<'feedback'>>

const FEEDBACK_TYPE_KEYS: Array<{ value: string; labelKey: Parameters<FeedbackT>[0] }> = [
  { value: 'too_high',     labelKey: 'typeTooHigh'  },
  { value: 'too_low',      labelKey: 'typeTooLow'   },
  { value: 'outdated',     labelKey: 'typeOutdated' },
  { value: 'missing_info', labelKey: 'typeMissing'  },
  { value: 'other',        labelKey: 'typeOther'    },
]

type FeedbackType = typeof FEEDBACK_TYPE_KEYS[number]['value']

export default function FeedbackForm({ gameSlug }: { gameSlug: string }) {
  const t = useTranslations('feedback')
  const [open, setOpen]       = useState(false)
  const [type, setType]       = useState<FeedbackType | ''>('')
  const [comment, setComment] = useState('')
  const [state, setState]     = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!type) return
    setState('submitting')
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ gameSlug, type, comment: comment.trim() || undefined }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted hover:text-accent transition-colors underline underline-offset-2"
      >
        {t('triggerLabel')}
      </button>
    )
  }

  if (state === 'done') {
    return (
      <div className="border-l-2 border-ivy pl-4 py-2 text-sm text-ivy">
        {t('thanks')}
      </div>
    )
  }

  return (
    <div className="border border-rule p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-base text-ink">{t('title')}</h3>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-ink text-lg leading-none">×</button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Type selector */}
        <div className="flex flex-col gap-2">
          {FEEDBACK_TYPE_KEYS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="feedback-type"
                value={opt.value}
                checked={type === opt.value}
                onChange={() => setType(opt.value)}
                className="accent-ink focus:ring-ink"
              />
              <span className="text-sm text-ink/80 group-hover:text-ink">{t(opt.labelKey)}</span>
            </label>
          ))}
        </div>

        {/* Optional comment */}
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={t('placeholder')}
          maxLength={1000}
          rows={3}
          className="w-full text-sm border border-rule bg-paper text-ink px-3 py-2.5 resize-none
            focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink placeholder:text-muted"
        />

        {state === 'error' && (
          <p className="text-xs text-accent">{t('errorRetry')}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!type || state === 'submitting'}
            className="px-4 py-2 bg-ink text-paper text-kicker uppercase font-semibold
              hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {state === 'submitting' ? t('submitting') : t('submit')}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            {t('cancel')}
          </button>
          <span className="ml-auto text-xs text-muted">{t('anonymous')}</span>
        </div>
      </form>
    </div>
  )
}
