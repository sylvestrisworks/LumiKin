'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/Icon'

type ConnectionStatus = {
  connected:    boolean
  gogUserId?:   string
  username?:    string | null
  lastSyncedAt?: string | null
}

type Step = 'idle' | 'link' | 'paste' | 'success'

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (days > 0)  return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return 'Just now'
}

export default function GogConnectPage() {
  const [status,  setStatus]  = useState<ConnectionStatus | null>(null)
  const [step,    setStep]    = useState<Step>('idle')
  const [authUrl, setAuthUrl] = useState('')
  const [pasted,  setPasted]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch('/api/gog/connect')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
  }, [])

  async function startConnect() {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/gog/connect/start', { method: 'POST' })
      const data = await res.json() as { authUrl: string }
      setAuthUrl(data.authUrl)
      setStep('link')
    } catch {
      setError('Could not start the connection — please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verify() {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/gog/connect/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pastedUrl: pasted }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; username?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Verification failed')
      setStatus({ connected: true, username: data.username ?? undefined, lastSyncedAt: null })
      setStep('success')
    } catch (err) {
      setError(String(err).replace('Error: ', ''))
      setStep('paste')
    } finally {
      setLoading(false)
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect your GOG account? Your imported library will be removed.')) return
    await fetch('/api/gog/connect', { method: 'DELETE' })
    setStatus({ connected: false })
    setStep('idle')
  }

  if (status === null) {
    return (
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="max-w-lg mx-auto px-4 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-ink pb-4">
          <Icon name="gog" size={28} aria-hidden="true" />
          <div>
            <h1 className="font-serif text-display-sm text-ink">GOG.com</h1>
            <p className="text-sm text-muted">Connect your GOG account to import your game library</p>
          </div>
        </div>

        {/* Already connected */}
        {status.connected && step !== 'success' && (
          <div className="border border-ivy px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ivy inline-block" />
              <p className="font-serif text-ink">
                {status.username ? `Connected as ${status.username}` : 'GOG account connected'}
              </p>
            </div>
            {status.lastSyncedAt ? (
              <p className="text-xs text-muted">Library last synced: {timeAgo(status.lastSyncedAt)}</p>
            ) : (
              <p className="text-xs text-muted">First library sync runs tonight</p>
            )}
            <button onClick={disconnect} className="text-xs text-accent hover:underline transition-colors">
              Disconnect
            </button>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="border-l-2 border-ivy pl-4 py-2">
            <p className="font-serif text-ink">🎉 GOG account connected!</p>
            <p className="text-sm text-ivy mt-1">
              Your library will sync tonight. Come back tomorrow to see it filled in.
            </p>
          </div>
        )}

        {/* Idle */}
        {!status.connected && step === 'idle' && (
          <div className="border border-rule px-5 py-5 space-y-4">
            <p className="text-sm text-ink/80 leading-relaxed">
              Connect your GOG.com account to import the games you own. We use GOG&apos;s sign-in —
              read only, no passwords stored.
            </p>
            {error && <p className="text-sm text-accent border border-accent px-3 py-2">{error}</p>}
            <button
              onClick={startConnect}
              disabled={loading}
              className="w-full py-2.5 bg-ink hover:bg-accent disabled:opacity-50 text-paper text-kicker uppercase font-semibold transition-colors"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {loading ? 'Starting…' : 'Connect GOG account'}
            </button>
          </div>
        )}

        {/* Step 1: open link */}
        {step === 'link' && (
          <div className="border border-rule px-5 py-5 space-y-4">
            <p className="text-sm font-semibold text-ink">Step 1 — Sign in with GOG</p>
            <p className="text-sm text-muted leading-relaxed">
              Click below to open GOG&apos;s sign-in page. After signing in, your browser will land
              on a blank page — <strong className="text-ink/80">that&apos;s expected</strong>. Copy the
              full URL from the address bar and paste it in Step 2.
            </p>
            <a
              href={authUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setStep('paste')}
              className="block w-full py-2.5 bg-ink hover:bg-accent text-paper text-kicker uppercase font-semibold text-center transition-colors"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              Open GOG sign-in →
            </a>
            <button onClick={() => setStep('paste')} className="w-full text-sm text-accent hover:underline">
              I already signed in — go to Step 2
            </button>
          </div>
        )}

        {/* Step 2: paste URL */}
        {step === 'paste' && (
          <div className="border border-rule px-5 py-5 space-y-4">
            <p className="text-sm font-semibold text-ink">Step 2 — Paste the redirect URL</p>
            <p className="text-sm text-muted leading-relaxed">
              After signing in, copy the full URL from the browser address bar
              (it contains <code className="text-xs bg-ink/5 text-ink px-1 py-0.5">on_login_success</code>)
              and paste it below.
            </p>
            {error && <p className="text-sm text-accent border border-accent px-3 py-2">{error}</p>}
            <textarea
              value={pasted}
              onChange={e => setPasted(e.target.value)}
              placeholder="https://embed.gog.com/on_login_success?origin=client&code=..."
              rows={3}
              className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-rule bg-paper text-ink
                focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={verify}
                disabled={loading || !pasted.trim()}
                className="flex-1 py-2.5 bg-ink hover:bg-accent disabled:opacity-50 text-paper text-kicker uppercase font-semibold transition-colors"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {loading ? 'Connecting…' : 'Connect'}
              </button>
              <button
                onClick={() => { setStep('link'); setError('') }}
                className="px-4 py-2.5 border border-rule text-ink/80 text-sm hover:border-ink transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* What we access */}
        <div className="border border-rule px-5 py-4 space-y-2 text-sm text-muted">
          <p className="font-semibold text-ink">What we access</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Your GOG display name</li>
            <li>The games you own on GOG.com</li>
          </ul>
          <p className="font-semibold text-ink pt-1">What we never access</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Your GOG password or payment info</li>
            <li>Friends list or online activity</li>
          </ul>
        </div>

      </main>
    </div>
  )
}
