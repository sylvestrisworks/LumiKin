import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Library, Download, BellRing, Users, type LucideIcon } from 'lucide-react'
import { auth } from '@/auth'

const TILE_ICONS: LucideIcon[] = [Library, Download, BellRing, Users]

type Props = {
  locale: string
}

export default async function LibrarySell({ locale }: Props) {
  const session = await auth()
  if (session?.user) return null

  const t = await getTranslations('home')

  const tiles = [
    { icon: TILE_ICONS[0], title: t('librarySellTile1Title'), body: t('librarySellTile1Body') },
    { icon: TILE_ICONS[1], title: t('librarySellTile2Title'), body: t('librarySellTile2Body') },
    { icon: TILE_ICONS[2], title: t('librarySellTile3Title'), body: t('librarySellTile3Body') },
    { icon: TILE_ICONS[3], title: t('librarySellTile4Title'), body: t('librarySellTile4Body') },
  ]

  return (
    <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
          {t('librarySellEyebrow')}
        </p>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 max-w-2xl">
          {t('librarySellHeading')}
        </h2>
        <p className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
          {t('librarySellSubhead')}
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tiles.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 flex gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" aria-hidden />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href={`/${locale}/login`}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
          >
            {t('librarySellCta')}
          </Link>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('librarySellReassure')}
          </span>
        </div>
      </div>
    </section>
  )
}
