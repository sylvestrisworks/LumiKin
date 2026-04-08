'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/navigation'
import { routing } from '@/i18n/routing'

const LOCALE_LABELS: Record<string, string> = {
  en: '🇬🇧 EN',
  es: '🇪🇸 ES',
  fr: '🇫🇷 FR',
  sv: '🇸🇪 SV',
  de: '🇩🇪 DE',
}

export default function LanguageSwitcher() {
  const locale   = useLocale()
  const pathname = usePathname()
  const router   = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.replace(pathname, { locale: e.target.value })
  }

  return (
    <select
      value={locale}
      onChange={handleChange}
      className="text-xs text-slate-500 bg-transparent border border-slate-200 rounded-lg px-2 py-1.5 hover:border-indigo-300 focus:outline-none focus:border-indigo-400 cursor-pointer"
      aria-label="Select language"
    >
      {routing.locales.map(l => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l] ?? l.toUpperCase()}
        </option>
      ))}
    </select>
  )
}
