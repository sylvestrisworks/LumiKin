'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { DarkPattern } from '@/types/game'

// ─── Pill styles ──────────────────────────────────────────────────────────────

function pillClasses(severity: DarkPattern['severity']): string {
  switch (severity) {
    case 'high':   return 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
    case 'medium': return 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
    case 'low':    return 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
  }
}

// ─── Single pill ─────────────────────────────────────────────────────────────

type T = ReturnType<typeof useTranslations<'darkPatterns'>>

const LABEL_KEYS: Record<string, Parameters<T>[0]> = {
  DP01: 'dp01Label', DP02: 'dp02Label', DP03: 'dp03Label', DP04: 'dp04Label',
  DP05: 'dp05Label', DP06: 'dp06Label', DP07: 'dp07Label', DP08: 'dp08Label',
  DP09: 'dp09Label', DP10: 'dp10Label', DP11: 'dp11Label', DP12: 'dp12Label',
}

const DESC_KEYS: Record<string, Parameters<T>[0]> = {
  DP01: 'dp01Desc', DP02: 'dp02Desc', DP03: 'dp03Desc', DP04: 'dp04Desc',
  DP05: 'dp05Desc', DP06: 'dp06Desc', DP07: 'dp07Desc', DP08: 'dp08Desc',
  DP09: 'dp09Desc', DP10: 'dp10Desc', DP11: 'dp11Desc', DP12: 'dp12Desc',
}

function Pill({ pattern, t }: { pattern: DarkPattern; t: T }) {
  const [expanded, setExpanded] = useState(false)
  const labelKey = LABEL_KEYS[pattern.patternId]
  const descKey  = DESC_KEYS[pattern.patternId]
  const label    = labelKey ? t(labelKey) : pattern.patternId
  const desc     = descKey ? t(descKey) : pattern.description

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`text-xs font-medium border px-2.5 py-1 rounded-full transition-colors cursor-pointer ${pillClasses(pattern.severity)}`}
        aria-expanded={expanded}
      >
        {label}
      </button>
      {expanded && desc && (
        <p className="mt-1.5 ml-1 text-xs text-slate-600 leading-relaxed max-w-sm">
          {desc}
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DarkPatternPills({ patterns }: { patterns: DarkPattern[] }) {
  const t = useTranslations('darkPatterns')

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        {t('heading')}
      </h3>

      {patterns.length === 0 ? (
        <p className="text-sm text-emerald-700 font-medium">
          {t('noneDetected')}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {patterns.map((p) => (
            <Pill key={p.patternId} pattern={p} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
