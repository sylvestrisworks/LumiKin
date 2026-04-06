'use client'

import { useState } from 'react'
import type { ComplianceBadge } from '@/types/game'

const REGULATION_META: Record<string, { label: string; description: string }> = {
  DSA: {
    label: 'EU Digital Services Act',
    description: 'Meets transparency requirements for minors under the EU Digital Services Act.',
  },
  'GDPR-K': {
    label: 'GDPR Children',
    description: 'Proper consent and age-gating in place for users under 16 (GDPR Article 8).',
  },
  ODDS: {
    label: 'Loot Box Odds',
    description: 'Publishes drop rates for paid random rewards (required in CN, JP, KR).',
  },
}

const ALL_REGULATIONS = ['DSA', 'GDPR-K', 'ODDS']

function badgeClasses(status: ComplianceBadge['status']): string {
  switch (status) {
    case 'compliant':     return 'bg-emerald-50 text-emerald-800 border-emerald-300'
    case 'non_compliant': return 'bg-red-50 text-red-800 border-red-300'
    default:              return 'bg-slate-100 text-slate-500 border-slate-300'
  }
}

function statusLabel(status: ComplianceBadge['status']): string {
  switch (status) {
    case 'compliant':     return '✓'
    case 'non_compliant': return '✗'
    default:              return '?'
  }
}

function Badge({ badge }: { badge: ComplianceBadge }) {
  const [expanded, setExpanded] = useState(false)
  const meta = REGULATION_META[badge.regulation]
  if (!meta) return null

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1 rounded-full transition-colors cursor-pointer ${badgeClasses(badge.status)}`}
        aria-expanded={expanded}
      >
        <span className="font-bold">{statusLabel(badge.status)}</span>
        {badge.regulation}
      </button>
      {expanded && (
        <p className="mt-1.5 ml-1 text-xs text-slate-600 leading-relaxed max-w-sm">
          {badge.notes ?? meta.description}
        </p>
      )}
    </div>
  )
}

export default function ComplianceBadges({ compliance }: { compliance: ComplianceBadge[] }) {
  // Build a full set — fill in not_assessed for any missing regulations
  const byRegulation = Object.fromEntries(compliance.map((c) => [c.regulation, c]))
  const badges: ComplianceBadge[] = ALL_REGULATIONS.map((reg) =>
    byRegulation[reg] ?? { regulation: reg, status: 'not_assessed', notes: null }
  )

  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
        Regulatory Compliance
      </h3>
      <div className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <Badge key={b.regulation} badge={b} />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Tap a badge for details. Grey = not yet assessed.
      </p>
    </div>
  )
}
