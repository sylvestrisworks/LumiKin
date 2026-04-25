export type HistogramBucket = { bucket: number; count: number }

// Tailwind classes must be static strings — do not compute these at runtime
const BUCKET_COLORS = [
  'bg-red-600',    // 0–9
  'bg-red-500',    // 10–19
  'bg-orange-500', // 20–29
  'bg-amber-600',  // 30–39
  'bg-amber-500',  // 40–49
  'bg-yellow-500', // 50–59
  'bg-lime-500',   // 60–69
  'bg-teal-500',   // 70–79
  'bg-emerald-500',// 80–89
  'bg-emerald-600',// 90–100
]

const BUCKET_STARTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]

export default function PlatformScoreHistogram({ buckets }: { buckets: HistogramBucket[] }) {
  const map = new Map(buckets.map(b => [b.bucket, b.count]))
  const counts = BUCKET_STARTS.map(start => map.get(start) ?? 0)
  const maxCount = Math.max(...counts, 1)
  const total = counts.reduce((a, b) => a + b, 0)

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-4 pt-4 pb-3">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          Score Distribution
        </h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">{total} scored</span>
      </div>

      {/* Bars */}
      <div className="flex items-end gap-0.5 h-20">
        {counts.map((count, i) => {
          const heightPct = count > 0 ? Math.max((count / maxCount) * 100, 6) : 0
          const label = `${BUCKET_STARTS[i]}–${i < 9 ? BUCKET_STARTS[i + 1] - 1 : 100}`
          return (
            <div key={i} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end">
              <div
                className={`w-full rounded-t-sm ${BUCKET_COLORS[i]}`}
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
            className="flex-1 text-center text-[9px] text-slate-400 dark:text-slate-500 font-mono"
          >
            {i % 2 === 0 ? start : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
