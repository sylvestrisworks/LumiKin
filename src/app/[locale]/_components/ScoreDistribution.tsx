import { getTranslations } from 'next-intl/server'
import { fetchScoreDistribution } from '../_data/distribution'

// "Where games land" — a paper-and-ink histogram of the whole catalogue across
// the 0–100 LumiScore scale. Bars are colour-banded on the same thresholds as
// curascoreTextEditorial (accent < 35, warm 35–49, ivy ≥ 50) so the chart reads
// left-to-right as risk → benefit. Full-width figure that anchors the hero.

// Band colour by the band's midpoint score, matching the score-text thresholds.
function bandFill(band: number): string {
  const mid = band * 10 + 5
  if (mid < 35) return 'bg-accent'
  if (mid < 50) return 'bg-warm'
  return 'bg-ivy'
}

export default async function ScoreDistribution({ locale }: { locale: string }) {
  const [te, bands] = await Promise.all([
    getTranslations('editorial'),
    fetchScoreDistribution(),
  ])

  const total = bands.reduce((sum, b) => sum + b.count, 0)
  if (total === 0) return null

  const max = Math.max(...bands.map(b => b.count))

  return (
    <figure
      role="img"
      aria-label={te('distribution.caption', { count: total.toLocaleString(locale) })}
    >
      {/* Heading rule + kicker, with the scale label on the right */}
      <figcaption className="border-t-2 border-ink pt-3 mb-8 flex items-baseline justify-between gap-4 flex-wrap">
        <p
          className="text-kicker uppercase font-semibold text-muted"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {te('distribution.kicker')}
        </p>
        <p
          className="text-kicker uppercase text-muted tabular-nums"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          LumiScore 0–100
        </p>
      </figcaption>

      {/* Bars — baseline-aligned on a hairline. aria-hidden: the figure role +
          label carry the meaning for assistive tech. */}
      <div className="h-32 md:h-40 flex items-end gap-1.5 md:gap-2" aria-hidden>
        {bands.map((b) => (
          <div
            key={b.band}
            className={`flex-1 ${bandFill(b.band)}`}
            style={{ height: `${b.count === 0 ? 0 : Math.max(3, (b.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="border-t border-ink" />

      {/* Scale ticks + risk→benefit axis */}
      <div className="mt-2 flex items-baseline justify-between text-kicker uppercase text-muted tabular-nums" style={{ fontVariantCaps: 'all-small-caps' }}>
        <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-4">
        <span
          className="text-kicker uppercase font-semibold text-accent"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          ◀ {te('distribution.axisLow')}
        </span>
        <span className="font-serif italic text-base text-muted">
          {te('distribution.caption', { count: total.toLocaleString(locale) })}
        </span>
        <span
          className="text-kicker uppercase font-semibold text-ivy"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {te('distribution.axisHigh')} ▶
        </span>
      </div>
    </figure>
  )
}
