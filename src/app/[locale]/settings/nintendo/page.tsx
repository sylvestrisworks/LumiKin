'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Icon from '@/components/Icon'

type ConnectionStatus = {
  connected: boolean
  naId?: string
  nickname?: string
  lastSyncedAt?: string | null
}

type Step = 'idle' | 'link' | 'paste' | 'success' | 'error'

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (days > 0)  return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return 'Just now'
}

export default function NintendoConnectPage() {
  const [status,   setStatus]   = useState<ConnectionStatus | null>(null)
  const [step,     setStep]     = useState<Step>('idle')
  const [authUrl,  setAuthUrl]  = useState('')
  const [verifier, setVerifier] = useState('')
  const [pasted,   setPasted]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const t = useTranslations('nintendo')
  const tCommon = useTranslations('common')

  useEffect(() => {
    fetch('/api/nintendo/connect')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
  }, [])

  async function startConnect() {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/nintendo/connect/start', { method: 'POST' })
      const data = await res.json() as { authUrl: string; verifier: string }
      setAuthUrl(data.authUrl)
      setVerifier(data.verifier)
      sessionStorage.setItem('nintendo_verifier', data.verifier)
      setStep('link')
    } catch {
      setError(t('error'))
    } finally {
      setLoading(false)
    }
  }

  async function verify() {
    setLoading(true)
    setError('')
    const v = verifier || sessionStorage.getItem('nintendo_verifier') || ''
    try {
      const res  = await fetch('/api/nintendo/connect/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pastedUrl: pasted, verifier: v }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; nickname?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Verification failed')
      setStatus({ connected: true, nickname: data.nickname ?? undefined, lastSyncedAt: null })
      sessionStorage.removeItem('nintendo_verifier')
      setStep('success')
    } catch (err) {
      setError(String(err).replace('Error: ', ''))
      setStep('paste')
    } finally {
      setLoading(false)
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect your Nintendo account? Your play time history will be removed.')) return
    await fetch('/api/nintendo/connect', { method: 'DELETE' })
    setStatus({ connected: false })
    setStep('idle')
  }

  if (status === null) {
    return (
      <div className="min-h-screen bg-ink/[0.03] flex items-center justify-center">
        <p className="text-muted">{tCommon('loading')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="max-w-lg mx-auto px-4 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Icon name="switch" size={28} aria-hidden="true" />
          <div>
            <h1 className="text-xl font-bold text-ink font-serif">Nintendo Switch</h1>
            <p className="text-sm text-muted">{t('connectDesc')}</p>
          </div>
        </div>

        {/* Already connected */}
        {status.connected && step !== 'success' && (
          <div className="border border-ivy px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ivy inline-block" />
              <p className="font-serif text-ink">
                {status.nickname ? t('connectedAs', { name: status.nickname }) : t('connected')}
              </p>
            </div>
            {status.lastSyncedAt && (
              <p className="text-xs text-muted">Last synced: {timeAgo(status.lastSyncedAt)}</p>
            )}
            {!status.lastSyncedAt && (
              <p className="text-xs text-muted">First sync runs tonight at 04:30 UTC</p>
            )}
            <button
              onClick={disconnect}
              className="text-xs text-accent hover:underline transition-colors"
            >
              {t('disconnect')}
            </button>
          </div>
        )}

        {/* Success state */}
        {step === 'success' && (
          <div className="border-l-2 border-ivy pl-4 py-2">
            <p className="font-serif text-ink">🎉 Nintendo account connected!</p>
            <p className="text-sm text-ivy mt-1">
              Play time will sync tonight. Come back tomorrow to see your dashboard.
            </p>
          </div>
        )}

        {/* Not connected — idle */}
        {!status.connected && step === 'idle' && (
          <div className="bg-paper rounded-2xl border border-rule shadow-sm px-5 py-5 space-y-4">
            <p className="text-sm text-muted leading-relaxed">
              Connect your Nintendo Account (the parent/guardian account) to import Switch play time.
              We use the official Nintendo Parental Controls API — read only, no passwords stored.
            </p>
            <button
              onClick={startConnect}
              disabled={loading}
              className="w-full py-2.5 bg-ink hover:bg-accent disabled:opacity-50 text-paper text-kicker uppercase font-semibold transition-colors" style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {loading ? t('connecting') : t('connectButton')}
            </button>
          </div>
        )}

        {/* Step 1: open the link */}
        {step === 'link' && (
          <div className="bg-paper rounded-2xl border border-rule shadow-sm px-5 py-5 space-y-4">
            <p className="text-sm font-semibold text-ink">Step 1 — Sign in with Nintendo</p>
            <p className="text-sm text-muted leading-relaxed">
              Click the link below to open Nintendo&apos;s sign-in page. After signing in, your browser
              will show an error page — <strong className="text-ink/80">that&apos;s expected</strong>.
              Copy the full URL from the address bar and paste it in Step 2.
            </p>
            <a
              href={authUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setStep('paste')}
              className="block w-full py-2.5 bg-ink hover:bg-accent text-paper text-kicker uppercase font-semibold text-center transition-colors" style={{ fontVariantCaps: 'all-small-caps' }}
            >
              Open Nintendo sign-in →
            </a>
            <button onClick={() => setStep('paste')} className="w-full text-sm text-accent hover:underline">
              I already signed in — go to Step 2
            </button>
          </div>
        )}

        {/* Step 2: paste the URL */}
        {step === 'paste' && (
          <div className="bg-paper rounded-2xl border border-rule shadow-sm px-5 py-5 space-y-4">
            <p className="text-sm font-semibold text-ink">Step 2 — Paste the redirect URL</p>
            <p className="text-sm text-muted leading-relaxed">
              After signing in, copy the full URL from the browser address bar
              (it starts with <code className="text-xs bg-ink/5 text-ink px-1 py-0.5">npf54789befb391a838://</code>)
              and paste it below.
            </p>
            {error && (
              <p className="text-sm text-accent border border-accent px-3 py-2">
                {error}
              </p>
            )}
            <textarea
              value={pasted}
              onChange={e => setPasted(e.target.value)}
              placeholder="npf54789befb391a838://auth#session_token_code=..."
              rows={3}
              className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-rule
                bg-paper text-ink
                focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={verify}
                disabled={loading || !pasted.trim()}
                className="flex-1 py-2.5 bg-ink hover:bg-accent disabled:opacity-50 text-paper text-kicker uppercase font-semibold transition-colors" style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {loading ? t('connecting') : t('connectButton')}
              </button>
              <button
                onClick={() => { setStep('link'); setError('') }}
                className="px-4 py-2.5 border border-rule text-ink/80 text-sm hover:border-ink transition-colors"
              >
                {tCommon('back')}
              </button>
            </div>
          </div>
        )}

        {/* What data we collect */}
        <div className="border border-rule px-5 py-4 space-y-2 text-sm text-muted">
          <p className="font-semibold text-ink/80">{t('whatWeAccess')}</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Daily play time per game (last 7 days, refreshed nightly)</li>
            <li>Game titles and icons from your Switch</li>
            <li>Device names registered with parental controls</li>
          </ul>
          <p className="font-semibold text-ink/80 pt-1">What we never access</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Nintendo eShop purchases or payment info</li>
            <li>Online play history or friend lists</li>
            <li>Your Nintendo Account password</li>
          </ul>
        </div>

      </main>
    </div>
  )
}
