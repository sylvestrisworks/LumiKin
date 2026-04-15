'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">{tCommon('loading')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-lg mx-auto px-4 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">🎮</span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Nintendo Switch</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('connectDesc')}</p>
          </div>
        </div>

        {/* Already connected */}
        {status.connected && step !== 'success' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-sm px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <p className="font-semibold text-slate-900 dark:text-white">
                {status.nickname ? t('connectedAs', { name: status.nickname }) : t('connected')}
              </p>
            </div>
            {status.lastSyncedAt && (
              <p className="text-xs text-slate-400 dark:text-slate-500">Last synced: {timeAgo(status.lastSyncedAt)}</p>
            )}
            {!status.lastSyncedAt && (
              <p className="text-xs text-slate-400 dark:text-slate-500">First sync runs tonight at 04:30 UTC</p>
            )}
            <button
              onClick={disconnect}
              className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              {t('disconnect')}
            </button>
          </div>
        )}

        {/* Success state */}
        {step === 'success' && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-5 py-4">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">🎉 Nintendo account connected!</p>
            <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
              Play time will sync tonight. Come back tomorrow to see your dashboard.
            </p>
          </div>
        )}

        {/* Not connected — idle */}
        {!status.connected && step === 'idle' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Connect your Nintendo Account (the parent/guardian account) to import Switch play time.
              We use the official Nintendo Parental Controls API — read only, no passwords stored.
            </p>
            <button
              onClick={startConnect}
              disabled={loading}
              className="w-full py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
            >
              {loading ? t('connecting') : t('connectButton')}
            </button>
          </div>
        )}

        {/* Step 1: open the link */}
        {step === 'link' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5 space-y-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Step 1 — Sign in with Nintendo</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Click the link below to open Nintendo&apos;s sign-in page. After signing in, your browser
              will show an error page — <strong className="text-slate-700 dark:text-slate-200">that&apos;s expected</strong>.
              Copy the full URL from the address bar and paste it in Step 2.
            </p>
            <a
              href={authUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setStep('paste')}
              className="block w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-center transition-colors"
            >
              Open Nintendo sign-in →
            </a>
            <button onClick={() => setStep('paste')} className="w-full text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
              I already signed in — go to Step 2
            </button>
          </div>
        )}

        {/* Step 2: paste the URL */}
        {step === 'paste' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5 space-y-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Step 2 — Paste the redirect URL</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              After signing in, copy the full URL from the browser address bar
              (it starts with <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">npf54789befb391a838://</code>)
              and paste it below.
            </p>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            <textarea
              value={pasted}
              onChange={e => setPasted(e.target.value)}
              placeholder="npf54789befb391a838://auth#session_token_code=..."
              rows={3}
              className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600
                bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
                focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={verify}
                disabled={loading || !pasted.trim()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
              >
                {loading ? t('connecting') : t('connectButton')}
              </button>
              <button
                onClick={() => { setStep('link'); setError('') }}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {tCommon('back')}
              </button>
            </div>
          </div>
        )}

        {/* What data we collect */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 px-5 py-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <p className="font-semibold text-slate-700 dark:text-slate-300">{t('whatWeAccess')}</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Daily play time per game (last 7 days, refreshed nightly)</li>
            <li>Game titles and icons from your Switch</li>
            <li>Device names registered with parental controls</li>
          </ul>
          <p className="font-semibold text-slate-700 dark:text-slate-300 pt-1">What we never access</p>
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
