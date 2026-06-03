'use client'

import { useState, type FormEvent } from 'react'
import { trackGoal } from '@/lib/plausible'

type FormState = 'idle' | 'submitting' | 'success' | 'error'

const FALLBACK_EMAIL = 'johan@sylvestris.works'

export default function ContactForm() {
  const [state, setState] = useState<FormState>('idle')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('submitting')

    const data = Object.fromEntries(new FormData(e.currentTarget))

    try {
      const res = await fetch('/api/partner-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      trackGoal('partners_form_submit')
      setState('success')
    } catch {
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="border border-rule p-8">
        <p className="font-serif text-lg text-ink">
          Thanks — I'll be in touch within two business days.
        </p>
      </div>
    )
  }

  const inputClass =
    'border border-rule bg-paper px-3 py-2.5 text-sm text-ink placeholder-muted focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink'
  const labelClass =
    'text-kicker uppercase font-semibold text-muted'

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">

      {/* Honeypot — hidden from humans, filled by bots */}
      <div aria-hidden="true" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClass}>Name</label>
        <input
          id="name" name="name" type="text" required autoComplete="name"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="company" className={labelClass}>Company</label>
        <input
          id="company" name="company" type="text" required autoComplete="organization"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="role" className={labelClass}>Role</label>
        <input
          id="role" name="role" type="text" required autoComplete="organization-title"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={labelClass}>Work email</label>
        <input
          id="email" name="email" type="email" required autoComplete="email"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="usecase" className={labelClass}>Use case</label>
        <textarea
          id="usecase" name="usecase" required rows={4}
          placeholder="Describe what you're building and how LumiKin data would fit in."
          className={`${inputClass} resize-none`}
        />
      </div>

      {state === 'error' && (
        <div className="sm:col-span-2 border border-accent px-4 py-3 text-sm text-accent">
          Something went wrong. Email{' '}
          <a
            href={`mailto:${FALLBACK_EMAIL}`}
            className="underline underline-offset-2 font-medium"
          >
            {FALLBACK_EMAIL}
          </a>{' '}
          directly and I'll get back to you.
        </div>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={state === 'submitting'}
          className="inline-flex items-center gap-2 bg-ink px-6 py-3 text-kicker uppercase font-semibold text-paper hover:bg-accent disabled:opacity-50 transition-colors"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {state === 'submitting' ? 'Sending…' : 'Get in touch'}
        </button>
      </div>
    </form>
  )
}
