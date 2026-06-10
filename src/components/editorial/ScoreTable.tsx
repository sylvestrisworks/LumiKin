// Per-dimension score table with hairline rows and an ink-on-paper bar per row.
// Tone selects which color the bar fills: ink for benefits, accent for risks.

import { Term } from '@/components/Term'

export type ScoreTone = 'ink' | 'accent'

// `note` is the always-visible one-line gloss under the label; `def` is the
// fuller explanation surfaced on hover/focus via Term.
export type ScoreRow = { code: string; label: string; value: number; note?: string; def?: string }

export function ScoreBar({
  value,
  tone,
  thin = false,
}: {
  value: number
  tone: ScoreTone
  thin?: boolean
}) {
  const pct = Math.round(value * 100)
  const height = thin ? 'h-[3px]' : 'h-2'
  const fill = tone === 'accent' ? 'bg-accent' : 'bg-ink'
  return (
    <div className={`relative ${height} w-full bg-ink/10`}>
      <div className={`absolute inset-y-0 left-0 ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ScoreTable({
  title,
  rows,
  tone,
}: {
  title: string
  rows: ScoreRow[]
  tone: ScoreTone
}) {
  return (
    <section className="font-sans">
      <h3
        className="text-kicker uppercase font-semibold text-muted mb-3"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {title}
      </h3>
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.code} className={i === 0 ? 'border-t border-ink/20' : 'border-t border-ink/10'}>
              <td className="py-3 pr-4 align-top text-muted text-sm w-10 tabular-nums">{r.code}</td>
              <td className="py-3 pr-6 align-top">
                <span className="text-ink text-sm block">
                  {r.def ? <Term def={r.def}>{r.label}</Term> : r.label}
                </span>
                {r.note && (
                  <span className="text-muted text-xs block mt-0.5 leading-snug">{r.note}</span>
                )}
              </td>
              <td className="py-3 pr-6 align-top w-1/2">
                <ScoreBar value={r.value} tone={tone} />
              </td>
              <td className="py-3 align-top text-ink text-sm tabular-nums text-right w-16">
                {r.value.toFixed(2)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-ink/20" />
        </tbody>
      </table>
    </section>
  )
}
