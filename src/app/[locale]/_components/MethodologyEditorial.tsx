import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Term } from '@/components/Term'
import { METHODOLOGY_PDF_PATH } from '@/lib/methodology'

export default async function MethodologyEditorial({ locale }: { locale: string }) {
  const [t, tg, te] = await Promise.all([
    getTranslations('home'),
    getTranslations('glossary'),
    getTranslations('editorial'),
  ])

  // Inline-term wrappers for t.rich(). Defs come from the `glossary` namespace
  // so each Term renders its definition in the user's locale.
  const termTags = {
    bds:      (c: React.ReactNode) => <Term def={tg('bds')}>{c}</Term>,
    ris:      (c: React.ReactNode) => <Term def={tg('ris')}>{c}</Term>,
    variable: (c: React.ReactNode) => <Term def={tg('variableRewards')}>{c}</Term>,
    streaks:  (c: React.ReactNode) => <Term def={tg('streaks')}>{c}</Term>,
    fomo:     (c: React.ReactNode) => <Term def={tg('fomo')}>{c}</Term>,
    paytowin: (c: React.ReactNode) => <Term def={tg('payToWin')}>{c}</Term>,
    currency: (c: React.ReactNode) => <Term def={tg('currencyObfuscation')}>{c}</Term>,
  }

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8 md:py-10">
        <div className="border-t border-ink pt-4 mb-6">
          <p
            className="text-kicker uppercase font-semibold text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {te('sections.methodology')}
          </p>
        </div>

        <h2
          className="font-serif text-display-sm md:text-display tracking-tight leading-[1.05] mb-6 max-w-4xl"
          style={{ fontOpticalSizing: 'auto' }}
        >
          {t('methodologyEyebrow')}
        </h2>

        <p className="font-serif italic text-xl md:text-2xl text-muted leading-snug max-w-3xl mb-12">
          {t('methodologyIntro')}
        </p>

        {/* Two-column body — benefits left, risks right. Stacks on mobile. */}
        <div className="grid md:grid-cols-2 gap-10 md:gap-16">
          <div>
            <p
              className="text-kicker uppercase font-semibold text-ivy mb-4"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {t('featuredBenefits')}
            </p>
            <p className="font-serif text-lg leading-relaxed text-ink/90">
              {t.rich('methodologyDetailsBenefits', termTags)}
            </p>
          </div>
          <div>
            <p
              className="text-kicker uppercase font-semibold text-accent mb-4"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {t('featuredRisks')}
            </p>
            <p className="font-serif text-lg leading-relaxed text-ink/90">
              {t.rich('methodologyDetailsRisks', termTags)}
            </p>
          </div>
        </div>

        {/* Sourcing line — the score is auditable, not a black box. */}
        <p className="mt-12 font-serif italic text-lg text-muted max-w-3xl">
          {t('methodologySource')}
        </p>

        {/* CTA row — small-caps links, hairline above */}
        <div className="mt-6 border-t border-ink pt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <Link
            href={`/${locale}/methodology`}
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('methodologyReadFull')}
          </Link>
          <a
            href={METHODOLOGY_PDF_PATH}
            download
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('methodologyDownloadPdf')}
          </a>
        </div>
      </div>
    </section>
  )
}
