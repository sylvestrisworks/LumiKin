import type { MethodologyVersion } from '@/lib/methodology'
import { CURRENT_METHODOLOGY_VERSION } from '@/lib/methodology'

type Props = {
  version: MethodologyVersion
  locale: string
}

export default function VersionBanner({ version, locale }: Props) {
  if (version.isCurrent) return null

  return (
    <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 print:hidden">
      <div className="max-w-5xl mx-auto px-6 py-3 flex flex-wrap items-center gap-3 text-sm text-amber-800 dark:text-amber-300">
        <span className="font-semibold">Archived version</span>
        <span className="text-amber-600 dark:text-amber-500">
          You're viewing methodology v{version.version} (published {version.publishedDate}).
        </span>
        <a
          href={`/${locale}/methodology`}
          className="font-semibold underline underline-offset-2 hover:no-underline"
        >
          View current version (v{CURRENT_METHODOLOGY_VERSION}) →
        </a>
      </div>
    </div>
  )
}
