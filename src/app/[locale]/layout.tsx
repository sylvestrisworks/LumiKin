import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/navigation'
import { routing } from '@/i18n/routing'
import SiteNav from '@/components/SiteNav'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import NavAuthButton from '@/components/NavAuthButton'
import CookieNotice from '@/components/CookieNotice'
import BetaBanner from '@/components/BetaBanner'
import NavNotificationBell from '@/components/NavNotificationBell'

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
      <div className="flex flex-col min-h-screen overflow-x-clip">
        <SiteNav authSlot={<NavAuthButton />} notifSlot={<NavNotificationBell />} />
        <div className="flex-1">{children}</div>
        <CookieNotice />
        <BetaBanner />
        <footer className="border-t-2 border-ink bg-paper text-ink">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
            <div className="flex flex-col md:flex-row items-start md:items-baseline justify-between gap-8 md:gap-12">
              <div>
                <p
                  className="font-serif text-3xl tracking-tight leading-tight"
                  style={{ fontOpticalSizing: 'auto' }}
                >
                  {t('brand')}{' '}
                  <span className="font-serif italic text-xl text-muted">{t('brandSub')}</span>
                </p>
                <p className="font-serif italic text-sm text-muted mt-1">{t('tagline')}</p>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <nav
                  className="flex flex-wrap gap-x-6 gap-y-2 text-kicker uppercase font-semibold"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  <Link href="/browse"      className="text-ink hover:text-accent transition-colors">{t('navBrowse')}</Link>
                  <Link href="/compare"     className="text-ink hover:text-accent transition-colors">{t('navCompare')}</Link>
                  <Link href="/methodology" className="text-ink hover:text-accent transition-colors">{t('navMethodology')}</Link>
                  <Link href="/faq"         className="text-ink hover:text-accent transition-colors">{t('navFaq')}</Link>
                  <Link href="/press"       className="text-ink hover:text-accent transition-colors">{t('navPress')}</Link>
                  <Link href="/privacy"     className="text-ink hover:text-accent transition-colors">{t('navPrivacy')}</Link>
                  <Link href="/terms"       className="text-ink hover:text-accent transition-colors">{t('navTerms')}</Link>
                  <a href="/feed.xml"       className="text-ink hover:text-accent transition-colors">RSS</a>
                </nav>
                <LanguageSwitcher />
              </div>
            </div>

            <div className="mt-10 border-t border-ink/30 pt-4 flex items-baseline justify-between gap-4">
              <p
                className="text-kicker uppercase text-muted tabular-nums"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {t('copyright', { year })}
              </p>
            </div>
          </div>
        </footer>
      </div>
    </NextIntlClientProvider>
  )
}
