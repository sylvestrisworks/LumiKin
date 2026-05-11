import { Sparkles, Clock, ClipboardCheck, type LucideIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

const TILE_ICONS: LucideIcon[] = [Sparkles, Clock, ClipboardCheck]

export default async function ParentValueTiles() {
  const t = await getTranslations('home')
  const tiles = [
    { icon: TILE_ICONS[0], title: t('tile1Title'), body: t('tile1Body') },
    { icon: TILE_ICONS[1], title: t('tile2Title'), body: t('tile2Body') },
    { icon: TILE_ICONS[2], title: t('tile3Title'), body: t('tile3Body') },
  ]
  return (
    <section className="border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-8">
          {t('tilesHeading')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {tiles.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5" aria-hidden />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
