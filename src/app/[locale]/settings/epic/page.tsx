'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

type ConnectionStatus = {
  connected:     boolean
  epicAccountId?: string
  displayName?:  string | null
  lastSyncedAt?: string | null
}

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (days > 0)  return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return 'Just now'
}

export default function EpicConnectPage() {
  const [status,  setStatus]  = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    fetch('/api/epic/connect')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))

    if (searchParams.get('error'))   setError('Connection failed — please try again.')
    if (searchParams.get('success')) setStatus(s => s ? { ...s, connected: true } : { connected: true })
  }, [searchParams])

  async function startConnect() {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/epic/connect/start', { method: 'POST' })
      const data = await res.json() as { authUrl: string }
      window.location.href = data.authUrl
    } catch {
      setError('Could not start connection — please try again.')
      setLoading(false)
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect your Epic Games account? Your imported library will be removed.')) return
    await fetch('/api/epic/connect', { method: 'DELETE' })
    setStatus({ connected: false })
  }

  if (status === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
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
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Epic Games</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Connect your Epic account to import your game library
            </p>
          </div>
        </div>

        {/* Already connected */}
        {status.connected && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-sm px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <p className="font-semibold text-slate-900 dark:text-white">
                {status.displayName ? `Connected as ${status.displayName}` : 'Epic account connected'}
              </p>
            </div>
            {status.lastSyncedAt ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Library last synced: {timeAgo(status.lastSyncedAt)}
              </p>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                First library sync runs tonight
              </p>
            )}
            <button
              onClick={disconnect}
              className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Not connected */}
        {!status.connected && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Connect your Epic Games account to automatically import your library.
              Games you own on the Epic Games Store will appear in your LumiKin library
              with ratings already attached where available.
            </p>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            <button
              onClick={startConnect}
              disabled={loading}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-700 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
            >
              {loading ? 'Redirecting to Epic…' : 'Connect Epic Games account'}
            </button>
          </div>
        )}

        {/* What we access */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 px-5 py-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <p className="font-semibold text-slate-700 dark:text-slate-300">What we access</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Your Epic display name</li>
            <li>Games you own on the Epic Games Store</li>
          </ul>
          <p className="font-semibold text-slate-700 dark:text-slate-300 pt-1">What we never access</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Your Epic password or payment info</li>
            <li>Friends list or online activity</li>
            <li>V-Bucks balance or purchase history</li>
          </ul>
        </div>

      </main>
    </div>
  )
}
