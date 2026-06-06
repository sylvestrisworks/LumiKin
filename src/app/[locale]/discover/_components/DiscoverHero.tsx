import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import SearchBar from '@/components/SearchBar'

// Editorial cover for /discover. Mirrors the homepage EditorialHero so the two
// landing surfaces read as the same publication: small-caps kicker, Fraunces
// cover headline, and the wired SearchBar in its editorial variant (hairline
// ink border on paper, italic Fraunces placeholder, accent focus rule).
export default async function DiscoverHero({ locale }: { locale: string }) {
  const t = await getTranslations('discover')

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-8 pb-10 md:pt-10 md:pb-12">
        <p
          className="text-kicker uppercase font-semibold text-accent mb-3"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {t('tagline')}
        </p>

        <h1
          className="font-serif text-display md:text-display-lg tracking-tight leading-[1.02] mb-6 max-w-4xl"
          style={{ fontOpticalSizing: 'auto' }}
        >
          {t('heading')}
        </h1>

        <div className="max-w-2xl">
          <SearchBar placeholder={t('searchPlaceholder')} variant="editorial" />
        </div>

        <div className="mt-6">
          <Link
            href={`/${locale}/browse`}
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('browseAll')} →
          </Link>
        </div>
      </div>
    </section>
  )
}
