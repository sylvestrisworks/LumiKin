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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {t('indexTitle')}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            {t('indexSubtitle')}
          </p>
        </header>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3">
          {AGES.map(age => (
            <Link
              key={age}
              href={`/${locale}/age/${age}`}
              className="flex flex-col items-center justify-center aspect-square rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 hover:shadow-sm transition-all group"
            >
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 leading-none">
                {age}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wide">
                {t('yearsOld')}
              </span>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8 max-w-md mx-auto">
          {t('indexFooter')}
        </p>
      </div>
    </div>
  )
}
