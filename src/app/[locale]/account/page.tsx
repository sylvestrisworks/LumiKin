import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { childProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import Icon from '@/components/Icon'
import ProfileManager from '@/components/ProfileManager'
import AccountActions from '@/components/AccountActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Account Settings — LumiKin' }

export default async function AccountPage() {
  const [session, locale, t] = await Promise.all([auth(), getLocale(), getTranslations('account')])
  if (!session?.user) redirect(`/${locale}/login`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id ?? session.user.email!
  const profiles = await db.select().from(childProfiles).where(eq(childProfiles.userId, userId))

  const { name, email, image } = session.user

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-lg mx-auto px-4 py-10 space-y-6">

        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>

        {/* ── Profile ─────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 flex items-center gap-4">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-full shrink-0 ring-2 ring-indigo-100 dark:ring-indigo-900" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
              {(name ?? email ?? '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}
            </div>
          )}
          <div className="min-w-0">
            {name && <p className="font-semibold text-slate-900 dark:text-white truncate">{name}</p>}
            <p className="text-sm text-slate-400 dark:text-slate-500 truncate">{email}</p>
          </div>
        </div>

        {/* ── Child profiles ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 px-1">
            {t('childProfiles')}
          </h2>
          <ProfileManager initialProfiles={profiles.map(p => ({
            id:          p.id,
            name:        p.name,
            birthYear:   p.birthYear,
            birthDate:   p.birthDate ?? null,
            platforms:   Array.isArray(p.platforms) ? (p.platforms as string[]) : [],
            focusSkills: Array.isArray(p.focusSkills) ? (p.focusSkills as string[]) : [],
          }))} />
        </section>

        {/* ── Connected accounts ───────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 px-1">
            {t('connectedAccounts')}
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t('googleAccount')}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[160px]">{email}</span>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
              <Link
                href={`/${locale}/settings/nintendo`}
                className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <span className="flex items-center gap-2"><Icon name="switch" size={16} aria-hidden="true" /> Nintendo Switch</span>
                <span className="text-slate-400 text-xs">{t('manage')} →</span>
              </Link>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
              <Link
                href={`/${locale}/settings/epic`}
                className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <span className="flex items-center gap-2"><Icon name="epicgames" size={16} aria-hidden="true" /> Epic Games</span>
                <span className="text-slate-400 text-xs">{t('manage')} →</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Legal ────────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 px-1">
            {t('legal')}
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 space-y-2">
            <Link href={`/${locale}/privacy`} className="block text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
              {t('privacyPolicy')}
            </Link>
            <Link href={`/${locale}/terms`} className="block text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
              {t('termsOfService')}
            </Link>
          </div>
        </section>

        {/* ── Sign out + Danger zone ───────────────────────────────────────── */}
        <AccountActions />

      </main>
    </div>
  )
}
