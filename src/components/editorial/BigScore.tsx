// Verdict numeral display — large editorial number with small-caps label above.
// Tone maps to the ivy (growth) / accent (risk) semantic colors.

export type BigScoreTone = 'ivy' | 'accent'

export function BigScore({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: BigScoreTone
}) {
  const numColor = tone === 'ivy' ? 'text-ivy' : 'text-accent'
  return (
    <div>
      <p
        className="text-kicker uppercase text-muted mb-1"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {label}
      </p>
      <p
        className={`font-serif tabular-nums leading-none tracking-tight ${numColor}`}
        style={{ fontSize: '6.5rem', fontOpticalSizing: 'auto', fontWeight: 500 }}
      >
        {Math.round(value * 100)}
      </p>
    </div>
  )
}
