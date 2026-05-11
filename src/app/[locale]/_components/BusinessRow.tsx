import Link from 'next/link'

type Props = {
  locale: string
}

const ITEMS = [
  {
    audience: 'For partners',
    body: 'Child-safety ratings API for parental control vendors, ISPs, and platforms.',
    slug: 'partners',
  },
  {
    audience: 'For journalists',
    body: 'Coverage stats, methodology, press kit, and contact info.',
    slug: 'press',
  },
]

export default function BusinessRow({ locale }: Props) {
  return (
    <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ITEMS.map(({ audience, body, slug }) => (
            <Link
              key={slug}
              href={`/${locale}/${slug}`}
              className="group flex items-center justify-between gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-5 py-4 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-sm transition-all"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">
                  {audience}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{body}</p>
              </div>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 shrink-0 group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
