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
    <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ITEMS.map(({ audience, body, slug }) => (
            <Link
              key={slug}
              href={`/${locale}/${slug}`}
              className="group flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-5 py-4 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-sm transition-all"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
                  {audience}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{body}</p>
              </div>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 shrink-0 group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
