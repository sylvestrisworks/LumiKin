'use client'

import { useState } from 'react'
import type { DarkPattern } from '@/types/game'

// ─── Pattern catalogue ────────────────────────────────────────────────────────

const PATTERN_LABELS: Record<string, string> = {
  DP01: 'Gateway Purchase',
  DP02: 'Confirm-Shaming',
  DP03: 'False Scarcity',
  DP04: 'Currency Obfuscation',
  DP05: 'Parasocial Prompts',
  DP06: 'Streak Punishment',
  DP07: 'Artificial Energy',
  DP08: 'Social Obligation',
  DP09: 'Loot Box / Gacha',
  DP10: 'Pay-to-Skip',
  DP11: 'Notification Spam',
  DP12: 'FOMO Events',
}

const PATTERN_DEFAULT_DESC: Record<string, string> = {
  DP01: 'Low-cost starter pack normalizes spending before expensive offers appear',
  DP02: 'Guilting language on decline buttons ("Are you sure you don\'t want to be cool?")',
  DP03: 'Fake countdown timers or "limited stock" on unlimited digital goods',
  DP04: 'Real money converted to gems/crystals/coins, reducing spending awareness',
  DP05: 'In-game character the child has bonded with asks them to buy things',
  DP06: 'Streak mechanics that punish missed days rather than just rewarding attendance',
  DP07: 'Stamina/energy system that refills on timer or purchase',
  DP08: 'Progress requires friends (gift exchanges, raid parties, co-op gates)',
  DP09: 'Random-chance paid rewards with undisclosed or poor odds',
  DP10: 'Paywalled shortcuts past intentionally tedious progression',
  DP11: 'Aggressive re-engagement push notifications',
  DP12: 'Time-limited content/events designed to create urgency',
}

// ─── Pill styles ──────────────────────────────────────────────────────────────

function pillClasses(severity: DarkPattern['severity']): string {
  switch (severity) {
    case 'high':   return 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
    case 'medium': return 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
    case 'low':    return 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
  }
}

// ─── Single pill ─────────────────────────────────────────────────────────────

function Pill({ pattern }: { pattern: DarkPattern }) {
  const [expanded, setExpanded] = useState(false)
  const label = PATTERN_LABELS[pattern.patternId] ?? pattern.patternId
  const desc = pattern.description ?? PATTERN_DEFAULT_DESC[pattern.patternId] ?? null

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
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Detected Tactics
      </h3>

      {patterns.length === 0 ? (
        <p className="text-sm text-emerald-700 font-medium">
          ✓ No manipulative tactics detected
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {patterns.map((p) => (
            <Pill key={p.patternId} pattern={p} />
          ))}
        </div>
      )}
    </div>
  )
}
