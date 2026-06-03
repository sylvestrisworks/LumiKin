'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Icon from '@/components/Icon'

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
          <Icon name="fortnite" size={28} aria-hidden="true" />
          <div>
            <h1 className="font-serif text-display-sm text-ink">Epic Games</h1>
            <p className="text-sm text-muted">
              Connect your Epic account to import your game library
            </p>
          </div>
        </div>

        {/* Already connected */}
        {status.connected && (
          <div className="border border-ivy px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ivy inline-block" />
              <p className="font-serif text-ink">
                {status.displayName ? `Connected as ${status.displayName}` : 'Epic account connected'}
              </p>
            </div>
            {status.lastSyncedAt ? (
              <p className="text-xs text-muted">
                Library last synced: {timeAgo(status.lastSyncedAt)}
              </p>
            ) : (
              <p className="text-xs text-muted">
                First library sync runs tonight
              </p>
            )}
            <button
              onClick={disconnect}
              className="text-xs text-accent hover:underline transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Not connected */}
        {!status.connected && (
          <div className="border border-rule px-5 py-5 space-y-4">
            <p className="text-sm text-ink/80 leading-relaxed">
              Connect your Epic Games account to automatically import your library.
              Games you own on the Epic Games Store will appear in your LumiKin library
              with ratings already attached where available.
            </p>
            {error && (
              <p className="text-sm text-accent border border-accent px-3 py-2">
                {error}
              </p>
            )}
            <button
              onClick={startConnect}
              disabled={loading}
              className="w-full py-2.5 bg-ink hover:bg-accent disabled:opacity-50 text-paper text-kicker uppercase font-semibold transition-colors"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {loading ? 'Redirecting to Epic…' : 'Connect Epic Games account'}
            </button>
          </div>
        )}

        {/* What we access */}
        <div className="border border-rule px-5 py-4 space-y-2 text-sm text-muted">
          <p className="font-semibold text-ink">What we access</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Your Epic display name</li>
            <li>Games you own on the Epic Games Store</li>
          </ul>
          <p className="font-semibold text-ink pt-1">What we never access</p>
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
