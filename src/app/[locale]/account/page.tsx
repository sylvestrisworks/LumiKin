'use client'

import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function AccountPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const t = useTranslations('account')
  const tCommon = useTranslations('common')
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">{tCommon('loading')}</p>
      </div>
    )
  }

  if (!session) {
    router.replace('/login')
    return null
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE' })
      if (!res.ok) throw new Error('Deletion failed')
      await signOut({ callbackUrl: '/' })
    } catch {
      setError(t('deleteError'))
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-lg mx-auto px-4 py-10 space-y-6">

        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>

        {/* Profile */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 flex items-center gap-4">
          {session.user?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt="" className="w-10 h-10 rounded-full shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white truncate">{session.user?.name}</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 truncate">{session.user?.email}</p>
          </div>
        </div>

        {/* Connected accounts */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">{t('connectedAccounts')}</p>
          <Link href="/settings/nintendo" className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            <span className="flex items-center gap-2">🎮 Nintendo Switch</span>
            <span className="text-slate-400 text-xs">Manage →</span>
          </Link>
        </div>

        {/* Legal links */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Legal</p>
          <Link href="/privacy" className="block text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Privacy Policy</Link>
          <Link href="/terms" className="block text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Terms of Service</Link>
        </div>

        {/* Danger zone */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm px-5 py-4 space-y-3">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-widest">{t('dangerZone')}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('deleteWarning')}
          </p>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="text-sm font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            >
              {t('deleteAccount')}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('deleteConfirmPrompt')}</p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {deleting ? t('deleting') : t('confirmDelete')}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {t('cancel') ?? 'Cancel'}
                </button>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
