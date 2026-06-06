import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

// Editorial cover for /discover — a title block only. Search lives in the
// global SiteNav header, so the hero stays a clean small-caps kicker + Fraunces
// headline with a single browse affordance.
export default async function DiscoverHero({ locale }: { locale: string }) {
  const t = await getTranslations('discover')

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-8 pb-8 md:pt-10 md:pb-10">
        <p
          className="text-kicker uppercase font-semibold text-accent mb-3"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {t('tagline')}
        </p>

        <h1
          className="font-serif text-display md:text-display-lg tracking-tight leading-[1.02] mb-5 max-w-4xl"
          style={{ fontOpticalSizing: 'auto' }}
        >
          {t('heading')}
        </h1>

        <Link
          href={`/${locale}/browse`}
          className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {t('browseAll')} →
        </Link>
      </div>
    </section>
  )
}
