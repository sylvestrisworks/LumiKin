export const dynamic = 'force-dynamic'

import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

const AGES = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'ageHub' })
  return {
    title: t('indexMetaTitle'),
    description: t('indexMetaDescription'),
  }
}

export default async function AgeHubIndex({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'ageHub' })

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center mb-10 border-b border-ink pb-6">
          <h1 className="font-serif text-display-sm sm:text-display text-ink tracking-tight">
            {t('indexTitle')}
          </h1>
          <p className="mt-2 font-serif italic text-sm sm:text-base text-muted max-w-xl mx-auto">
            {t('indexSubtitle')}
          </p>
        </header>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-px bg-rule border border-rule">
          {AGES.map(age => (
            <Link
              key={age}
              href={`/${locale}/age/${age}`}
              className="flex flex-col items-center justify-center aspect-square bg-paper hover:bg-ink/[0.03] transition-colors group"
            >
              <span className="font-serif text-2xl sm:text-3xl text-ink group-hover:text-accent leading-none">
                {age}
              </span>
              <span
                className="text-kicker uppercase font-semibold text-muted mt-1"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {t('yearsOld')}
              </span>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-muted mt-8 max-w-md mx-auto">
          {t('indexFooter')}
        </p>
      </div>
    </div>
  )
}
