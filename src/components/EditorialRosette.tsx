type Variant = 'recommends' | 'caution'

const COPY: Record<Variant, { top: string; bottom: string; glyph: string; color: string }> = {
  recommends: { top: 'LUMIKIN · APPROVED', bottom: 'WORTH YOUR CHILD’S TIME', glyph: '✳', color: 'text-ivy' },
  caution:    { top: 'LUMIKIN · CAUTION',  bottom: 'KNOW BEFORE YOU BUY',     glyph: '!', color: 'text-accent' },
}

export default function EditorialRosette({
  variant = 'recommends',
  size = 132,
  rotate = -6,
}: {
  variant?: Variant
  size?: number
  rotate?: number
}) {
  const { top, bottom, glyph, color } = COPY[variant]

  // Stroke/fill follow `currentColor` so the wrapper's `text-ivy` / `text-accent`
  // class drives everything — keeps the rosette in step with `.evening` palette.
  return (
    <div
      className={`relative inline-block ${color}`}
      style={{ width: size, height: size, transform: `rotate(${rotate}deg)` }}
      aria-label={`${variant === 'recommends' ? 'LumiKin recommends' : 'Proceed with caution'}`}
    >
      <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
        {/* scalloped outer ring */}
        <g fill="none" stroke="currentColor" strokeWidth="1.4">
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * Math.PI * 2
            const cx = 100 + Math.cos(angle) * 92
            const cy = 100 + Math.sin(angle) * 92
            return <circle key={i} cx={cx} cy={cy} r="6" />
          })}
        </g>
        {/* inner double rule, slightly off-center for hand-pressed feel */}
        <circle cx="100.5" cy="99.5" r="78" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="0.6" />

        {/* curved label paths */}
        <defs>
          <path id="ros-top" d="M 30,100 A 70,70 0 0 1 170,100" />
          <path id="ros-bot" d="M 30,100 A 70,70 0 0 0 170,100" />
        </defs>
        <text
          fontFamily="var(--font-fraunces), Georgia, serif"
          fontSize="11"
          letterSpacing="2"
          fill="currentColor"
          fontWeight="600"
        >
          <textPath href="#ros-top" startOffset="50%" textAnchor="middle">
            {top}
          </textPath>
        </text>
        <text
          fontFamily="var(--font-fraunces), Georgia, serif"
          fontSize="9"
          letterSpacing="1.5"
          fill="currentColor"
          fontWeight="500"
        >
          <textPath href="#ros-bot" startOffset="50%" textAnchor="middle">
            {bottom}
          </textPath>
        </text>

        {/* central glyph */}
        <text
          x="100"
          y={variant === 'caution' ? '118' : '120'}
          textAnchor="middle"
          fontFamily="var(--font-fraunces), Georgia, serif"
          fontSize={variant === 'caution' ? '64' : '48'}
          fill="currentColor"
          fontWeight="600"
        >
          {glyph}
        </text>

        {/* central crossbars under glyph */}
        <line x1="60" y1="135" x2="140" y2="135" stroke="currentColor" strokeWidth="0.6" />
      </svg>
    </div>
  )
}
