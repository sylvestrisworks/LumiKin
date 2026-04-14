import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import SiteNav from '@/components/SiteNav'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import NavAuthButton from '@/components/NavAuthButton'
import CookieNotice from '@/components/CookieNotice'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  const t = await getTranslations({ locale, namespace: 'footer' })
  const year = new Date().getFullYear()

  return (
    <NextIntlClientProvider>
      <div className="flex flex-col min-h-screen">
        <SiteNav authSlot={<NavAuthButton />} />
        <div className="flex-1">{children}</div>
        <CookieNotice />
        <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-black text-indigo-700 dark:text-indigo-400 tracking-tight">
                  {t('brand')} <span className="font-normal text-slate-400 dark:text-slate-500">{t('brandSub')}</span>
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('tagline')}</p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                  <a href={`/${locale}/discover`} className="hover:text-indigo-700 dark:hover:text-indigo-400 hover:underline transition-colors">
                    Discover
                  </a>
                  <a href={`/${locale}/browse`} className="hover:text-indigo-700 dark:hover:text-indigo-400 hover:underline transition-colors">
                    Browse
                  </a>
                  <a href={`/${locale}/compare`} className="hover:text-indigo-700 dark:hover:text-indigo-400 hover:underline transition-colors">
                    Compare
                  </a>
                  <a href={`/${locale}/privacy`} className="hover:text-indigo-700 dark:hover:text-indigo-400 hover:underline transition-colors">
                    Privacy
                  </a>
                  <a href={`/${locale}/terms`} className="hover:text-indigo-700 dark:hover:text-indigo-400 hover:underline transition-colors">
                    Terms
                  </a>
                </nav>
                <LanguageSwitcher />
              </div>
            </div>
            <p className="text-xs text-slate-300 dark:text-slate-600 mt-6">
              {t('copyright', { year })}
            </p>
          </div>
        </footer>
      </div>
    </NextIntlClientProvider>
  )
}
