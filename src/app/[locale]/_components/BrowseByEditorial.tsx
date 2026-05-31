import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

// TODO(editorial i18n sweep): move deks to editorial.browseBy.*Dek
// Inline English deks for now so the visual lands; translation pass collects
// them alongside the other hardcoded editorial strings on this branch.
type Entry = { key: 'age' | 'platform' | 'roblox' | 'fortnite'; href: string; titleKey: 'browseByAge' | 'browseByPlatform' | 'browseByRoblox' | 'browseByFortnite'; dek: string }

const DEKS: Record<Entry['key'], string> = {
  age:      'Find what fits your child at their age — and what to wait on.',
  platform: 'Switch, PlayStation, Xbox, PC, mobile — narrow by what they actually play.',
  roblox:   'Inside the Roblox catalogue, scored experience by experience.',
  fortnite: 'Creative islands and modes rated separately from the base game.',
}

export default async function BrowseByEditorial({ locale }: { locale: string }) {
  const t = await getTranslations('home')

  const entries: Entry[] = [
    { key: 'age',      href: `/${locale}/age`,                titleKey: 'browseByAge',      dek: DEKS.age      },
    { key: 'platform', href: `/${locale}/platform`,           titleKey: 'browseByPlatform', dek: DEKS.platform },
    { key: 'roblox',   href: `/${locale}/platform/roblox`,    titleKey: 'browseByRoblox',   dek: DEKS.roblox   },
    { key: 'fortnite', href: `/${locale}/platform/fortnite`,  titleKey: 'browseByFortnite', dek: DEKS.fortnite },
  ]

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-8 py-16 md:py-20">
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
                className="group flex-1 px-6 py-6 md:px-8 md:py-8 hover:bg-ink/[0.03] transition-colors"
              >
                <h3
                  className="font-serif text-2xl md:text-3xl tracking-tight leading-tight mb-2 group-hover:text-accent transition-colors"
                  style={{ fontOpticalSizing: 'auto' }}
                >
                  {t(entry.titleKey)}
                </h3>
                <p className="font-serif italic text-base text-muted leading-snug">
                  {entry.dek}
                </p>
                <p
                  className="mt-4 text-kicker uppercase font-semibold text-ink/60 group-hover:text-accent transition-colors"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  Browse →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
