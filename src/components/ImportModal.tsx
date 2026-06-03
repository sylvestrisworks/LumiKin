'use client'

import { useState, useRef } from 'react'
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

type Step = 'input' | 'loading' | 'preview' | 'done'
type Platform = 'steam' | 'xbox'

export default function ImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const t = useTranslations('importModal')
  const tCommon = useTranslations('common')
  const [platform, setPlatform] = useState<Platform>('steam')
  const [step, setStep] = useState<Step>('input')
  const [steamInput, setSteamInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [addedCount, setAddedCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

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
    // Pre-select all unowned matched games
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-paper border-2 border-ink shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule/50">
          <h2 className="font-serif text-lg text-ink">{t('title')}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        {/* Platform tabs */}
        <div className="flex border-b border-rule/50">
          {(['steam', 'xbox'] as Platform[]).map(p => (
            <button
              key={p}
              onClick={() => { setPlatform(p); setStep('input'); setError(null) }}
              className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-colors ${
                platform === p
                  ? 'border-b-2 border-ink text-ink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {p === 'steam'
                ? <><Icon name="steam" size={16} aria-hidden="true" /> Steam</>
                : <><Icon name="xbox"  size={16} aria-hidden="true" /> Xbox</>
              }
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Xbox placeholder */}
          {platform === 'xbox' && (
            <div className="text-center py-8">
              <div className="mb-3 flex justify-center"><Icon name="xbox" size={48} aria-hidden="true" className="text-rule" /></div>
              <p className="font-semibold text-ink/80">Xbox import coming soon</p>
              <p className="text-sm text-muted mt-2 max-w-xs mx-auto">
                Xbox doesn&apos;t offer a public game library API — it requires Microsoft OAuth integration which we&apos;re working on.
              </p>
              <p className="text-sm text-muted mt-3 max-w-xs mx-auto">
                For now, browse our catalogue and use the <strong>Add to Library</strong> button on any game page.
              </p>
            </div>
          )}

          {/* Steam: input */}
          {platform === 'steam' && step === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink/80 mb-1.5">
                  {t('steamIdLabel')}
                </label>
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

          {/* Loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted">{t('importing')}</p>
            </div>
          )}

          {/* Preview */}
          {platform === 'steam' && step === 'preview' && preview && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="border border-rule px-4 py-3 text-sm text-ink/80 flex gap-4 flex-wrap">
                <span><strong className="text-ink">{preview.totalSteamGames}</strong> games on Steam</span>
                <span><strong className="text-ivy">{preview.matched.length}</strong> found in LumiKin</span>
                {preview.unmatchedTotal > 0 && (
                  <span className="text-muted">{preview.unmatchedTotal} not yet in our database</span>
                )}
              </div>

              {/* Matched games */}
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
                                m.curascore >= 70 ? 'text-ivy' :
                                m.curascore >= 50 ? 'text-warm' : 'text-accent'
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

              {/* Unmatched */}
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

          {/* Done */}
          {step === 'done' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✓</div>
              <p className="font-semibold text-ink/80">
                {addedCount > 0 ? t('success', { count: addedCount }) : t('nothingNew')}
              </p>
              <p className="text-sm text-muted mt-1">{t('successSub')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-rule/50 flex justify-end gap-3">
          {step === 'done' || platform === 'xbox' ? (
            <button onClick={onClose} className="px-4 py-2 bg-ink text-paper text-kicker uppercase font-semibold hover:bg-accent transition-colors" style={{ fontVariantCaps: 'all-small-caps' }}>
              {t('close')}
            </button>
          ) : step === 'preview' ? (
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
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-ink/80 hover:text-ink transition-colors">
                {t('cancel')}
              </button>
              <button
                onClick={handlePreview}
                disabled={!steamInput.trim() || step === 'loading'}
                className="px-4 py-2 bg-ink text-paper text-kicker uppercase font-semibold hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {t('importButton')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
