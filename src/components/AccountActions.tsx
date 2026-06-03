'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { LogOut } from 'lucide-react'

export default function AccountActions() {
  const t = useTranslations('account')
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await signOut({ callbackUrl: '/' })
    } catch {
      setError(t('deleteError'))
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sign out */}
      <div className="border border-rule px-5 py-4">
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-2 text-sm font-semibold text-ink/80 hover:text-accent transition-colors"
        >
          <LogOut size={15} strokeWidth={2.5} />
          {t('signOut')}
        </button>
      </div>

      {/* Danger zone */}
      <div className="border border-accent px-5 py-4 space-y-3">
        <p className="text-kicker uppercase font-semibold text-accent" style={{ fontVariantCaps: 'all-small-caps' }}>{t('dangerZone')}</p>
        <p className="text-sm text-muted">{t('deleteWarning')}</p>

        {error && <p className="text-sm text-accent">{error}</p>}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-sm font-semibold text-accent hover:underline transition-colors"
          >
            {t('deleteAccount')}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{t('deleteConfirmPrompt')}</p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-accent hover:opacity-90 disabled:opacity-50 text-paper text-kicker uppercase font-semibold transition-colors"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {deleting ? t('deleting') : t('confirmDelete')}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="px-4 py-2 border border-rule text-ink text-kicker uppercase font-semibold hover:border-ink transition-colors"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
