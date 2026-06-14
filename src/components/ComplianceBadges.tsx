'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ComplianceBadge } from '@/types/game'
import { resolveComplianceStatus, withAllRegulations, type ResolvedComplianceStatus } from '@/lib/compliance'

type ResolvedStatus = ResolvedComplianceStatus

function stateClasses(status: ResolvedStatus): string {
  switch (status) {
    case 'met':      return 'bg-emerald-50 text-emerald-800 border-emerald-300'
    case 'concerns': return 'bg-amber-50 text-amber-800 border-amber-300'
    default:         return 'bg-slate-100 text-slate-500 border-slate-300'
  }
}

function stateIcon(status: ResolvedStatus): string {
  switch (status) {
    case 'met':      return '✓'
    case 'concerns': return '⚠'
    default:         return '–'
  }
}

type T = ReturnType<typeof useTranslations<'compliance'>>

function stateLabel(status: ResolvedStatus, t: T): string {
  switch (status) {
    case 'met':      return t('stateMet')
    case 'concerns': return t('stateConcerns')
    default:         return t('stateNotAssessed')
  }
}

type RegMeta = { label: string; criteria: string }

function getRegulationMeta(t: T): Record<string, RegMeta> {
  return {
    DSA:      { label: t('dsaLabel'),   criteria: t('dsaDesc')   },
    'GDPR-K': { label: t('gdprkLabel'), criteria: t('gdprkDesc') },
    ODDS:     { label: t('oddsLabel'),  criteria: t('oddsDesc')  },
  }
}

function Badge({ badge, meta, t }: { badge: ComplianceBadge; meta: RegMeta; t: T }) {
  const [expanded, setExpanded] = useState(false)
  const status = resolveComplianceStatus(badge)

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        title={`${badge.regulation} — ${stateLabel(status, t)}`}
        className={`inline-flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1 rounded-full transition-colors cursor-pointer ${stateClasses(status)}`}
        aria-expanded={expanded}
      >
        <span className="font-bold" aria-hidden>{stateIcon(status)}</span>
        {badge.regulation}
        <span className="font-normal opacity-80">· {stateLabel(status, t)}</span>
      </button>
      {expanded && (
        <div className="mt-1.5 ml-1 text-xs text-slate-600 leading-relaxed max-w-sm space-y-1">
          <p><span className="font-semibold">{meta.label}.</span> {t('criteriaPrefix')} {meta.criteria}</p>
          {/* Only show stored notes for a documented verdict — not for the
              defaulted "not yet assessed" state. */}
          {status !== 'not_assessed' && badge.notes?.trim() && (
            <p className="text-slate-500">{badge.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function ComplianceBadges({ compliance }: { compliance: ComplianceBadge[] }) {
  const t    = useTranslations('compliance')
  const meta = getRegulationMeta(t)

  const badges = withAllRegulations(compliance)

  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
        {t('heading')}
      </h3>
      <div className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <Badge key={b.regulation} badge={b} meta={meta[b.regulation] ?? { label: b.regulation, criteria: '' }} t={t} />
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400 leading-relaxed">
        {t('disclaimer')}
      </p>
    </div>
  )
}
