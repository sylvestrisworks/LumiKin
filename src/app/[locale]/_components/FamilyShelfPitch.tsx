import { getTranslations } from 'next-intl/server'
import SignInCta from '@/components/SignInCta'

// Anonymous-visitor pitch for the personal Library/Dashboard feature, in the
// editorial house style. Rendered inside <AnonOnly> so it only shows to
// signed-out visitors. Keeps the homepage statically cacheable.
export default async function FamilyShelfPitch({ locale }: { locale: string }) {
  const t = await getTranslations('promo')

  const points = [t('shelfPoint1'), t('shelfPoint2'), t('shelfPoint3')]

  return (
    <section className="bg-paper text-ink border-t border-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-16 md:py-20 grid md:grid-cols-2 gap-10 md:gap-12 items-center">
        <div>
          <p
            className="text-kicker uppercase font-semibold text-accent mb-3"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('shelfKicker')}
          </p>
          <h2
            className="font-serif text-display-sm md:text-display tracking-tight leading-[1.05] mb-4"
            style={{ fontOpticalSizing: 'auto' }}
          >
            {t('shelfTitle')}
          </h2>
          <p className="font-serif italic text-muted text-lg leading-snug max-w-md">
            {t('shelfDek')}
          </p>
        </div>

        <div className="md:pl-8 md:border-l border-rule">
          <ul className="space-y-4 mb-8">
            {points.map((p, i) => (
              <li key={i} className="flex gap-3 items-baseline">
                <span className="text-accent font-serif text-lg leading-none">{i + 1}</span>
                <span className="text-ink leading-snug">{p}</span>
              </li>
            ))}
          </ul>
          <SignInCta
            callbackPath={`/${locale}/library`}
            label={t('shelfCta')}
            className="inline-flex items-center px-5 py-2.5 text-kicker uppercase font-semibold bg-ink text-paper border border-ink hover:bg-accent hover:border-accent transition-colors"
          />
        </div>
      </div>
    </section>
  )
}
