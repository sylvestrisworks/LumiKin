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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">{t('title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {/* Platform tabs */}
        <div className="flex border-b border-slate-100">
          {(['steam', 'xbox'] as Platform[]).map(p => (
            <button
              key={p}
              onClick={() => { setPlatform(p); setStep('input'); setError(null) }}
              className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-colors ${
                platform === p
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
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
              <div className="mb-3 flex justify-center"><Icon name="xbox" size={48} aria-hidden="true" className="text-slate-300" /></div>
              <p className="font-semibold text-slate-700">Xbox import coming soon</p>
              <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                Xbox doesn&apos;t offer a public game library API — it requires Microsoft OAuth integration which we&apos;re working on.
              </p>
              <p className="text-sm text-slate-500 mt-3 max-w-xs mx-auto">
                For now, browse our catalogue and use the <strong>Add to Library</strong> button on any game page.
              </p>
            </div>
          )}

          {/* Steam: input */}
          {platform === 'steam' && step === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('steamIdLabel')}
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={steamInput}
                  onChange={e => setSteamInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePreview()}
                  placeholder={t('steamIdPlaceholder')}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                  autoFocus
                />
                {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
              </div>

              <details className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                <summary className="cursor-pointer font-medium text-slate-600">{t('howToFind')}</summary>
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
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">{t('importing')}</p>
            </div>
          )}

          {/* Preview */}
          {platform === 'steam' && step === 'preview' && preview && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-600 flex gap-4 flex-wrap">
                <span><strong className="text-slate-800">{preview.totalSteamGames}</strong> games on Steam</span>
                <span><strong className="text-indigo-700">{preview.matched.length}</strong> found in LumiKin</span>
                {preview.unmatchedTotal > 0 && (
                  <span className="text-slate-400">{preview.unmatchedTotal} not yet in our database</span>
                )}
              </div>

              {/* Matched games */}
              {preview.matched.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select games to add</p>
                    <button
                      onClick={() => {
                        const unowned = preview.matched.filter(m => !m.alreadyOwned).map(m => m.gameId)
                        setSelected(selected.size === unowned.length ? new Set() : new Set(unowned))
                      }}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      {selected.size === preview.matched.filter(m => !m.alreadyOwned).length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>

                  <ul className="space-y-1 max-h-56 overflow-y-auto">
                    {preview.matched.map(m => (
                      <li key={m.gameId}>
                        <label className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          m.alreadyOwned ? 'opacity-50 cursor-default' : 'hover:bg-slate-50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={m.alreadyOwned || selected.has(m.gameId)}
                            disabled={m.alreadyOwned}
                            onChange={() => !m.alreadyOwned && toggleGame(m.gameId)}
                            className="rounded"
                          />
                          <span className="flex-1 text-sm text-slate-700 truncate">{m.title}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {m.curascore != null && (
                              <span className={`text-xs font-black px-1.5 py-0.5 rounded-full text-white ${
                                m.curascore >= 70 ? 'bg-emerald-500' :
                                m.curascore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              }`}>{m.curascore}</span>
                            )}
                            {m.alreadyOwned && <span className="text-[10px] text-slate-400 italic">in library</span>}
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Unmatched */}
              {preview.unmatched.length > 0 && (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer font-medium text-slate-600">
                    {preview.unmatchedTotal} games not in LumiKin yet
                  </summary>
                  <ul className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
                    {preview.unmatched.map(u => (
                      <li key={u.appid} className="py-0.5 text-slate-400">{u.steamName}</li>
                    ))}
                    {preview.unmatchedTotal > preview.unmatched.length && (
                      <li className="text-slate-300 italic">…and {preview.unmatchedTotal - preview.unmatched.length} more</li>
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
              <p className="font-semibold text-slate-700">
                {addedCount > 0 ? t('success', { count: addedCount }) : t('nothingNew')}
              </p>
              <p className="text-sm text-slate-500 mt-1">{t('successSub')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          {step === 'done' || platform === 'xbox' ? (
            <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
              {t('close')}
            </button>
          ) : step === 'preview' ? (
            <>
              <button onClick={() => { setStep('input'); setPreview(null) }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add {selected.size > 0 ? `${selected.size} game${selected.size > 1 ? 's' : ''}` : 'selected'} to library
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
                {t('cancel')}
              </button>
              <button
                onClick={handlePreview}
                disabled={!steamInput.trim() || step === 'loading'}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
