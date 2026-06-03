export type HistogramBucket = { bucket: number; count: number }

// Tailwind classes must be static strings — do not compute these at runtime
const BUCKET_COLORS = [
  'bg-accent',     // 0–9
  'bg-accent',     // 10–19
  'bg-accent/70',  // 20–29
  'bg-warm',       // 30–39
  'bg-warm',       // 40–49
  'bg-warm/70',    // 50–59
  'bg-ivy/60',     // 60–69
  'bg-ivy',        // 70–79
  'bg-ivy',        // 80–89
  'bg-ivy',        // 90–100
]

const BUCKET_STARTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]

export default function PlatformScoreHistogram({
  buckets,
  scoreDistributionLabel = 'Score Distribution',
  scoredSuffix = 'scored',
}: {
  buckets: HistogramBucket[]
  scoreDistributionLabel?: string
  scoredSuffix?: string
}) {
  const map = new Map(buckets.map(b => [b.bucket, b.count]))
  const counts = BUCKET_STARTS.map(start => map.get(start) ?? 0)
  const maxCount = Math.max(...counts, 1)
  const total = counts.reduce((a, b) => a + b, 0)

  return (
    <div className="border border-rule px-4 pt-4 pb-3">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-kicker uppercase font-semibold text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
          {scoreDistributionLabel}
        </h2>
        <span className="text-xs text-muted">{total} {scoredSuffix}</span>
      </div>

      {/* Bars */}
      <div className="flex items-end gap-0.5 h-20">
        {counts.map((count, i) => {
          const heightPct = count > 0 ? Math.max((count / maxCount) * 100, 6) : 0
          const label = `${BUCKET_STARTS[i]}–${i < 9 ? BUCKET_STARTS[i + 1] - 1 : 100}`
          return (
            <div key={i} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end">
              <div
                className={`w-full ${BUCKET_COLORS[i]}`}
                style={{ height: `${heightPct}%` }}
                title={`${label}: ${count}`}
              />
            </div>
          )
        })}
      </div>

      {/* X-axis labels — only show every other one to avoid crowding */}
      <div className="flex mt-1">
        {BUCKET_STARTS.map((start, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[9px] text-muted font-mono"
          >
            {i % 2 === 0 ? start : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
