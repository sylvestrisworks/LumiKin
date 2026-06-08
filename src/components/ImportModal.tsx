'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Icon from '@/components/Icon'

type MatchedGame = {
  gameId: number
  slug: string
  title: string
  curascore: number | null
  steamName: string
  alreadyOwned: boolean
}

type PreviewResult = {
  totalSteamGames: number
  matched: MatchedGame[]
  unmatched: { steamName: string; appid: number }[]
  unmatchedTotal: number
}

type ConnectionStatus = {
  connected: boolean
  displayName?: string | null
  username?: string | null
  lastSyncedAt?: string | null
}

type Step = 'input' | 'loading' | 'preview' | 'done'
type Platform = 'steam' | 'epic' | 'gog'

const PLATFORMS: { id: Platform; label: string; icon: 'steam' | 'epic' | 'gog' }[] = [
  { id: 'steam', label: 'Steam', icon: 'steam' },
  { id: 'epic',  label: 'Epic',  icon: 'epic' },
  { id: 'gog',   label: 'GOG',   icon: 'gog' },
]

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (days > 0)  return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return 'Just now'
}

export default function ImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const t = useTranslations('importModal')
  const [platform, setPlatform] = useState<Platform>('steam')

  // ── Steam state ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('input')
  const [steamInput, setSteamInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [addedCount, setAddedCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Connection state (Epic + GOG) ─────────────────────────────────────────────
  const [epicStatus, setEpicStatus] = useState<ConnectionStatus | null>(null)
  const [gogStatus,  setGogStatus]  = useState<ConnectionStatus | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [gogStep, setGogStep] = useState<'idle' | 'link' | 'paste' | 'success'>('idle')
  const [gogAuthUrl, setGogAuthUrl] = useState('')
  const [gogPasted, setGogPasted] = useState('')
  const [connError, setConnError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/epic/connect').then(r => r.json()).then(setEpicStatus).catch(() => setEpicStatus({ connected: false }))
    fetch('/api/gog/connect').then(r => r.json()).then(setGogStatus).catch(() => setGogStatus({ connected: false }))
  }, [])

  // ── Steam handlers (unchanged behaviour) ───────────────────────────────────────
  async function handlePreview() {
    if (!steamInput.trim()) return
    setError(null)
    setStep('loading')

    const res = await fetch('/api/import/steam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preview', steamInput: steamInput.trim() }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'Something went wrong.')
      setStep('input')
      return
    }

    setPreview(json)
    setSelected(new Set(json.matched.filter((m: MatchedGame) => !m.alreadyOwned).map((m: MatchedGame) => m.gameId)))
    setStep('preview')
  }

  async function handleConfirm() {
    if (selected.size === 0) { onClose(); return }
    setStep('loading')

    const res = await fetch('/api/import/steam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', gameIds: Array.from(selected) }),
    })
    const json = await res.json()
    setAddedCount(json.added ?? 0)
    setStep('done')
    router.refresh()
  }

  function toggleGame(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Epic handler ────────────────────────────────────────────────────────────
  async function connectEpic() {
    setConnecting(true)
    setConnError(null)
    try {
      const res  = await fetch('/api/epic/connect/start', { method: 'POST' })
      const data = await res.json() as { authUrl?: string; error?: string }
      if (!data.authUrl) throw new Error(data.error ?? 'Could not start connection')
      window.location.href = data.authUrl
    } catch (err) {
      setConnError(String(err).replace('Error: ', ''))
      setConnecting(false)
    }
  }

  // ── GOG handlers ──────────────────────────────────────────────────────────────
  async function startGog() {
    setConnecting(true)
    setConnError(null)
    try {
      const res  = await fetch('/api/gog/connect/start', { method: 'POST' })
      const data = await res.json() as { authUrl: string }
      setGogAuthUrl(data.authUrl)
      setGogStep('link')
    } catch {
      setConnError('Could not start the connection — please try again.')
    } finally {
      setConnecting(false)
    }
  }

  async function verifyGog() {
    setConnecting(true)
    setConnError(null)
    try {
      const res  = await fetch('/api/gog/connect/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pastedUrl: gogPasted }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; username?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Verification failed')
      setGogStatus({ connected: true, username: data.username ?? undefined, lastSyncedAt: null })
      setGogStep('success')
      router.refresh()
    } catch (err) {
      setConnError(String(err).replace('Error: ', ''))
      setGogStep('paste')
    } finally {
      setConnecting(false)
    }
  }

  // ── Reusable connected card ─────────────────────────────────────────────────
  function ConnectedCard({ name, status }: { name: string; status: ConnectionStatus }) {
    return (
      <div className="border border-ivy px-5 py-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ivy inline-block" />
          <p className="font-serif text-ink">
            {status.displayName ?? status.username
              ? `Connected as ${status.displayName ?? status.username}`
              : `${name} account connected`}
          </p>
        </div>
        <p className="text-xs text-muted">
          {status.lastSyncedAt
            ? `Library last synced: ${timeAgo(status.lastSyncedAt)}`
            : 'Your library syncs automatically every night.'}
        </p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-paper border-2 border-ink shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule/50">
          <h2 className="font-serif text-lg text-ink">{t('title')}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        {/* Platform tabs */}
        <div className="flex border-b border-rule/50">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => { setPlatform(p.id); setError(null); setConnError(null) }}
              className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                platform === p.id ? 'border-b-2 border-ink text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon name={p.icon} size={16} aria-hidden="true" /> {p.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── STEAM ──────────────────────────────────────────────────────── */}
          {platform === 'steam' && step === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink/80 mb-1.5">{t('steamIdLabel')}</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={steamInput}
                  onChange={e => setSteamInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePreview()}
                  placeholder={t('steamIdPlaceholder')}
                  className="w-full text-sm border border-rule bg-paper text-ink px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink"
                  autoFocus
                />
                {error && <p className="text-xs text-accent mt-1.5">{error}</p>}
              </div>

              <details className="text-xs text-muted border border-rule p-3">
                <summary className="cursor-pointer font-medium text-ink/80">{t('howToFind')}</summary>
                <ol className="mt-2 space-y-1 list-decimal list-inside">
                  <li>Open Steam and go to your Profile</li>
                  <li>The URL will be <code>steamcommunity.com/id/yourname</code> or <code>steamcommunity.com/profiles/76561...</code></li>
                  <li>Paste either format above</li>
                  <li>Make sure your <strong>Game details</strong> are set to Public in Steam Privacy Settings</li>
                </ol>
              </details>
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted">{t('importing')}</p>
            </div>
          )}

          {platform === 'steam' && step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="border border-rule px-4 py-3 text-sm text-ink/80 flex gap-4 flex-wrap">
                <span><strong className="text-ink">{preview.totalSteamGames}</strong> games on Steam</span>
                <span><strong className="text-ivy">{preview.matched.length}</strong> found in LumiKin</span>
                {preview.unmatchedTotal > 0 && (
                  <span className="text-muted">{preview.unmatchedTotal} not yet in our database</span>
                )}
              </div>

              {preview.matched.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide">Select games to add</p>
                    <button
                      onClick={() => {
                        const unowned = preview.matched.filter(m => !m.alreadyOwned).map(m => m.gameId)
                        setSelected(selected.size === unowned.length ? new Set() : new Set(unowned))
                      }}
                      className="text-xs text-accent hover:underline"
                    >
                      {selected.size === preview.matched.filter(m => !m.alreadyOwned).length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>

                  <ul className="space-y-1 max-h-56 overflow-y-auto">
                    {preview.matched.map(m => (
                      <li key={m.gameId}>
                        <label className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          m.alreadyOwned ? 'opacity-50 cursor-default' : 'hover:bg-ink/[0.04]'
                        }`}>
                          <input
                            type="checkbox"
                            checked={m.alreadyOwned || selected.has(m.gameId)}
                            disabled={m.alreadyOwned}
                            onChange={() => !m.alreadyOwned && toggleGame(m.gameId)}
                            className="rounded"
                          />
                          <span className="flex-1 text-sm text-ink/80 truncate">{m.title}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {m.curascore != null && (
                              <span className={`font-serif text-sm font-semibold tabular-nums ${
                                m.curascore >= 70 ? 'text-ivy' : m.curascore >= 50 ? 'text-warm' : 'text-accent'
                              }`}>{m.curascore}</span>
                            )}
                            {m.alreadyOwned && <span className="text-[10px] text-muted italic">in library</span>}
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.unmatched.length > 0 && (
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer font-medium text-ink/80">
                    {preview.unmatchedTotal} games not in LumiKin yet
                  </summary>
                  <ul className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
                    {preview.unmatched.map(u => (
                      <li key={u.appid} className="py-0.5 text-muted">{u.steamName}</li>
                    ))}
                    {preview.unmatchedTotal > preview.unmatched.length && (
                      <li className="text-rule italic">…and {preview.unmatchedTotal - preview.unmatched.length} more</li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          )}

          {platform === 'steam' && step === 'done' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✓</div>
              <p className="font-semibold text-ink/80">
                {addedCount > 0 ? t('success', { count: addedCount }) : t('nothingNew')}
              </p>
              <p className="text-sm text-muted mt-1">{t('successSub')}</p>
            </div>
          )}

          {/* ── EPIC ───────────────────────────────────────────────────────── */}
          {platform === 'epic' && (
            epicStatus === null ? (
              <p className="text-sm text-muted py-8 text-center">Loading…</p>
            ) : epicStatus.connected ? (
              <ConnectedCard name="Epic" status={epicStatus} />
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-ink/80 leading-relaxed">
                  Connect your Epic Games account and we&apos;ll import the games you own, then keep
                  your library up to date automatically. You&apos;ll be sent to Epic to sign in.
                </p>
                {connError && <p className="text-sm text-accent border border-accent px-3 py-2">{connError}</p>}
                <button
                  onClick={connectEpic}
                  disabled={connecting}
                  className="w-full py-2.5 bg-ink hover:bg-accent disabled:opacity-50 text-paper text-kicker uppercase font-semibold transition-colors"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  {connecting ? 'Redirecting to Epic…' : 'Connect Epic Games account'}
                </button>
              </div>
            )
          )}

          {/* ── GOG ────────────────────────────────────────────────────────── */}
          {platform === 'gog' && (
            gogStatus === null ? (
              <p className="text-sm text-muted py-8 text-center">Loading…</p>
            ) : gogStatus.connected && gogStep !== 'success' ? (
              <ConnectedCard name="GOG" status={gogStatus} />
            ) : gogStep === 'success' ? (
              <div className="border-l-2 border-ivy pl-4 py-2">
                <p className="font-serif text-ink">🎉 GOG account connected!</p>
                <p className="text-sm text-ivy mt-1">Your library will sync tonight.</p>
              </div>
            ) : gogStep === 'idle' ? (
              <div className="space-y-4">
                <p className="text-sm text-ink/80 leading-relaxed">
                  Connect your GOG.com account to import the games you own. It&apos;s a quick two-step
                  sign-in — read only, no passwords stored.
                </p>
                {connError && <p className="text-sm text-accent border border-accent px-3 py-2">{connError}</p>}
                <button
                  onClick={startGog}
                  disabled={connecting}
                  className="w-full py-2.5 bg-ink hover:bg-accent disabled:opacity-50 text-paper text-kicker uppercase font-semibold transition-colors"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  {connecting ? 'Starting…' : 'Connect GOG account'}
                </button>
              </div>
            ) : gogStep === 'link' ? (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-ink">Step 1 — Sign in with GOG</p>
                <p className="text-sm text-muted leading-relaxed">
                  Open GOG&apos;s sign-in page. Afterwards your browser lands on a blank page —
                  <strong className="text-ink/80"> that&apos;s expected</strong>. Copy the full URL and
                  paste it in Step 2.
                </p>
                <a
                  href={gogAuthUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setGogStep('paste')}
                  className="block w-full py-2.5 bg-ink hover:bg-accent text-paper text-kicker uppercase font-semibold text-center transition-colors"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  Open GOG sign-in →
                </a>
                <button onClick={() => setGogStep('paste')} className="w-full text-sm text-accent hover:underline">
                  I already signed in — go to Step 2
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-ink">Step 2 — Paste the redirect URL</p>
                <p className="text-sm text-muted leading-relaxed">
                  Paste the full URL from your browser (it contains{' '}
                  <code className="text-xs bg-ink/5 text-ink px-1 py-0.5">on_login_success</code>).
                </p>
                {connError && <p className="text-sm text-accent border border-accent px-3 py-2">{connError}</p>}
                <textarea
                  value={gogPasted}
                  onChange={e => setGogPasted(e.target.value)}
                  placeholder="https://embed.gog.com/on_login_success?origin=client&code=..."
                  rows={3}
                  className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-rule bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={verifyGog}
                    disabled={connecting || !gogPasted.trim()}
                    className="flex-1 py-2.5 bg-ink hover:bg-accent disabled:opacity-50 text-paper text-kicker uppercase font-semibold transition-colors"
                    style={{ fontVariantCaps: 'all-small-caps' }}
                  >
                    {connecting ? 'Connecting…' : 'Connect'}
                  </button>
                  <button
                    onClick={() => { setGogStep('link'); setConnError(null) }}
                    className="px-4 py-2.5 border border-rule text-ink/80 text-sm hover:border-ink transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-rule/50 flex justify-end gap-3">
          {platform === 'steam' && step === 'preview' ? (
            <>
              <button onClick={() => { setStep('input'); setPreview(null) }} className="px-4 py-2 text-sm font-medium text-ink/80 hover:text-ink transition-colors">
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                className="px-4 py-2 bg-ink text-paper text-kicker uppercase font-semibold hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                Add {selected.size > 0 ? `${selected.size} game${selected.size > 1 ? 's' : ''}` : 'selected'} to library
              </button>
            </>
          ) : platform === 'steam' && step === 'input' ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-ink/80 hover:text-ink transition-colors">
                {t('cancel')}
              </button>
              <button
                onClick={handlePreview}
                disabled={!steamInput.trim()}
                className="px-4 py-2 bg-ink text-paper text-kicker uppercase font-semibold hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {t('importButton')}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="px-4 py-2 bg-ink text-paper text-kicker uppercase font-semibold hover:bg-accent transition-colors" style={{ fontVariantCaps: 'all-small-caps' }}>
              {t('close')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
