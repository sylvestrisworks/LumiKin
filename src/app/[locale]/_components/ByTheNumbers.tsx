import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

// "By the numbers" — a Pudding-style data spread explaining the anatomy of a
// LumiScore. Deliberately about the *method* (how a score is built), not reach
// (games rated / platforms — that's the closing CoverageStrip), so the two
// don't repeat each other. The values are rubric constants (docs/RUBRIC.md):
// 60 sub-dimensions, two composites (BDS + RIS), a 0–100 LumiScore, and a
// 15–120-minute session range from the time tiers.
const FIGURES: Array<{ value: string; labelKey: 'dimensionsLabel' | 'scoresLabel' | 'scaleLabel' | 'timeLabel' }> = [
  { value: '60',     labelKey: 'dimensionsLabel' },
  { value: '2',      labelKey: 'scoresLabel' },
  { value: '0–100',  labelKey: 'scaleLabel' },
  { value: '15–120', labelKey: 'timeLabel' },
]

export default async function ByTheNumbers({ locale }: { locale: string }) {
  const te = await getTranslations('editorial')

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-16 md:py-20">
        <div className="border-t border-ink pt-4 mb-10 flex items-baseline justify-between gap-4 flex-wrap">
          <p
            className="text-kicker uppercase font-semibold text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {te('byTheNumbers.kicker')}
          </p>
        </div>

        <h2
          className="font-serif text-display-sm md:text-display tracking-tight leading-[1.05] mb-12 max-w-3xl"
          style={{ fontOpticalSizing: 'auto' }}
        >
          {te('byTheNumbers.intro')}
        </h2>

        <dl className="grid grid-cols-2 md:grid-cols-4 border-t-2 border-b border-ink md:divide-x divide-ink/30">
          {FIGURES.map(({ value, labelKey }) => (
            <div key={labelKey} className="py-6 md:px-6 md:first:pl-0 md:last:pr-0">
              <dd
                className="font-serif tabular-nums leading-none tracking-tight text-ink mb-3"
                style={{ fontSize: '4.5rem', fontOpticalSizing: 'auto', fontWeight: 500 }}
              >
                {value}
              </dd>
              <dt
                className="text-kicker uppercase text-muted"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {te(`byTheNumbers.${labelKey}`)}
              </dt>
            </div>
          ))}
        </dl>

        {/* Sourcing line — the score isn't a black box; it traces to a public rubric. */}
        <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="font-serif italic text-lg text-muted">
            {te('byTheNumbers.source')}
          </p>
          <Link
            href={`/${locale}/methodology`}
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {te('byTheNumbers.sourceCta')}
          </Link>
        </div>
      </div>
    </section>
  )
}
