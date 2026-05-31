import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import SearchBar from '@/components/SearchBar'
import { fetchSiteStats } from '@/lib/stats'

// Editorial cover headline. Replaces the legacy slate hero so the homepage
// reads as a magazine front from the Masthead down. Keeps the typeahead
// <SearchBar> as-is — its rounded chrome doesn't quite match the editorial
// palette but the typeahead UX is worth preserving over a pure-editorial
// look. Restyle the input itself in a separate pass if we want full purity.
export default async function EditorialHero({ locale }: { locale: string }) {
  const [t, stats] = await Promise.all([
    getTranslations('home'),
    fetchSiteStats(),
  ])

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-8 pt-16 pb-20 md:pt-20 md:pb-24">
        <h1
          className="font-serif text-display md:text-display-lg tracking-tight leading-[1.02] mb-8 max-w-4xl"
          style={{ fontOpticalSizing: 'auto' }}
        >
          {t('h1')}
        </h1>

        <p className="font-serif italic text-xl md:text-2xl text-muted leading-snug max-w-3xl mb-12">
          {t('subhead', { count: stats.total_games_scored })}
        </p>

        <div className="max-w-2xl">
          <SearchBar placeholder={t('searchPlaceholder')} />
        </div>

        <div className="mt-6">
          <Link
            href={`/${locale}/browse`}
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('browseAll')}
          </Link>
        </div>
      </div>
    </section>
  )
}
