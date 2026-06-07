import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

type DekKey = 'ageDek' | 'platformDek' | 'robloxDek' | 'fortniteDek'
type TitleKey = 'browseByAge' | 'browseByPlatform' | 'browseByRoblox' | 'browseByFortnite'
type Entry = { key: string; href: string; titleKey: TitleKey; dekKey: DekKey }

export default async function BrowseByEditorial({ locale }: { locale: string }) {
  const [t, te] = await Promise.all([
    getTranslations('home'),
    getTranslations('editorial'),
  ])

  const entries: Entry[] = [
    { key: 'age',      href: `/${locale}/age`,                titleKey: 'browseByAge',      dekKey: 'ageDek'      },
    { key: 'platform', href: `/${locale}/platform`,           titleKey: 'browseByPlatform', dekKey: 'platformDek' },
    { key: 'roblox',   href: `/${locale}/platform/roblox`,    titleKey: 'browseByRoblox',   dekKey: 'robloxDek'   },
    { key: 'fortnite', href: `/${locale}/platform/fortnite`,  titleKey: 'browseByFortnite', dekKey: 'fortniteDek' },
  ]

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-16 md:py-20">
        <div className="border-t border-ink pt-4 mb-6">
          <p
            className="text-kicker uppercase font-semibold text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('browseByLabel')}
          </p>
        </div>

        {/* Directory grid — hairline-bounded top/bottom, internal rules between
            cells (horizontal on mobile, vertical on md+). */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 border-t-2 border-b border-ink divide-y sm:divide-y-0 sm:divide-x divide-ink/30">
          {entries.map((entry) => (
            <li key={entry.key} className="flex">
              <Link
                href={entry.href}
                className="group flex flex-col flex-1 px-6 py-6 md:px-8 md:py-8 hover:bg-ink/[0.03] transition-colors"
              >
                <h3
                  className="font-serif text-2xl md:text-3xl tracking-tight leading-tight mb-2 group-hover:text-accent transition-colors"
                  style={{ fontOpticalSizing: 'auto' }}
                >
                  {t(entry.titleKey)}
                </h3>
                <p className="font-serif italic text-base text-muted leading-snug">
                  {te(`browseBy.${entry.dekKey}`)}
                </p>
                <p
                  className="mt-auto pt-4 text-kicker uppercase font-semibold text-ink/60 group-hover:text-accent transition-colors"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  {te('actions.browse')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
