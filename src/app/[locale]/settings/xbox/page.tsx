'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Icon from '@/components/Icon'

type ConnectionStatus = {
  connected:    boolean
  xuid?:        string
  gamertag?:    string | null
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

export default function XboxConnectPage() {
  const [status,  setStatus]  = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    fetch('/api/xbox/connect')
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
      const res  = await fetch('/api/xbox/connect/start', { method: 'POST' })
      const data = await res.json() as { authUrl?: string; error?: string }
      if (!data.authUrl) throw new Error(data.error ?? 'Could not start connection')
      window.location.href = data.authUrl
    } catch (err) {
      setError(String(err).replace('Error: ', ''))
      setLoading(false)
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect your Xbox account? Your imported library will be removed.')) return
    await fetch('/api/xbox/connect', { method: 'DELETE' })
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
          <Icon name="xbox" size={28} aria-hidden="true" />
          <div>
            <h1 className="font-serif text-display-sm text-ink">Xbox</h1>
            <p className="text-sm text-muted">Connect your Microsoft account to import your Xbox library</p>
          </div>
        </div>

        {/* Already connected */}
        {status.connected && (
          <div className="border border-ivy px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ivy inline-block" />
              <p className="font-serif text-ink">
                {status.gamertag ? `Connected as ${status.gamertag}` : 'Xbox account connected'}
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

        {/* Not connected */}
        {!status.connected && (
          <div className="border border-rule px-5 py-5 space-y-4">
            <p className="text-sm text-ink/80 leading-relaxed">
              Connect your Microsoft account to import the games on your Xbox library. You&apos;ll be
              sent to Microsoft to sign in; we keep your library up to date automatically.
            </p>
            {error && <p className="text-sm text-accent border border-accent px-3 py-2">{error}</p>}
            <button
              onClick={startConnect}
              disabled={loading}
              className="w-full py-2.5 bg-ink hover:bg-accent disabled:opacity-50 text-paper text-kicker uppercase font-semibold transition-colors"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {loading ? 'Redirecting to Microsoft…' : 'Connect Xbox account'}
            </button>
          </div>
        )}

        {/* What we access */}
        <div className="border border-rule px-5 py-4 space-y-2 text-sm text-muted">
          <p className="font-semibold text-ink">What we access</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Your Xbox gamertag</li>
            <li>Your title history (games you&apos;ve played/own)</li>
          </ul>
          <p className="font-semibold text-ink pt-1">What we never access</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Your Microsoft password or payment info</li>
            <li>Friends list, messages, or online activity</li>
          </ul>
        </div>

      </main>
    </div>
  )
}
