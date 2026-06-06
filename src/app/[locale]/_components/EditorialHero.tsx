import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import SearchBar from '@/components/SearchBar'
import { fetchSiteStats } from '@/lib/stats'

// Editorial cover headline. Replaces the legacy slate hero so the homepage
// reads as a magazine front from the Masthead down. SearchBar renders in
// its editorial variant — hairline ink border on paper, italic Fraunces
// placeholder, accent focus rule — so it sits in the cover without breaking
// the palette.
//
// Behind the type sits a full-bleed house-style linocut (a storybook of play)
// anchored to the right. It is masked to melt into the paper and capped by a
// left→right paper wash so the headline keeps full contrast; the wash is driven
// by --paper so it inverts correctly under the .evening theme.
export default async function EditorialHero({ locale }: { locale: string }) {
  const [t, stats] = await Promise.all([
    getTranslations('home'),
    fetchSiteStats(),
  ])

  return (
    <section className="relative isolate overflow-hidden bg-paper text-ink">
      {/* Ambient backdrop — decorative, weight to the right, faded into paper. */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <Image
          src="/hero/home-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-right opacity-[0.35] md:opacity-60 select-none"
          style={{
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, black 60%), linear-gradient(to bottom, black 70%, transparent 100%)',
            maskImage:
              'linear-gradient(to right, transparent 0%, black 60%), linear-gradient(to bottom, black 70%, transparent 100%)',
            WebkitMaskComposite: 'source-in',
            maskComposite: 'intersect',
          }}
        />
        {/* Paper wash guaranteeing headline contrast over the calmer left side. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgb(var(--paper)) 0%, rgb(var(--paper) / 0.9) 32%, rgb(var(--paper) / 0.55) 58%, rgb(var(--paper) / 0) 80%)',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 pt-10 pb-12 md:pt-12 md:pb-14">
        <h1
          className="font-serif text-display md:text-display-lg tracking-tight leading-[1.02] mb-6 max-w-5xl"
          style={{ fontOpticalSizing: 'auto' }}
        >
          {t('h1')}
        </h1>

        <p className="font-serif italic text-xl md:text-2xl text-muted leading-snug max-w-3xl mb-8">
          {t('subhead', { count: stats.total_games_scored })}
        </p>

        <div className="max-w-2xl">
          <SearchBar placeholder={t('searchPlaceholder')} variant="editorial" />
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
