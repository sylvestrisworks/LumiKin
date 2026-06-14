import type { ComplianceBadge } from '@/types/game'

/** The regulations LumiKin reports on, always shown in this order. */
export const COMPLIANCE_REGULATIONS = ['DSA', 'GDPR-K', 'ODDS'] as const

/**
 * The three explicit display states for a compliance badge.
 *  - `met`          — assessed, meets criteria
 *  - `concerns`     — assessed, concerns noted (LumiKin's view of design
 *                     practices, NOT a legal determination)
 *  - `not_assessed` — no documented assessment yet
 */
export type ResolvedComplianceStatus = 'met' | 'concerns' | 'not_assessed'

/**
 * Resolve a stored badge to a display state.
 *
 * A definite verdict only stands when there is a documented assessment behind
 * it (the `notes` field). Without that evidence we fall back to "Not yet
 * assessed" rather than publicly asserting a regulatory outcome — asserting
 * that a named game fails GDPR-K is a legally loaded claim, so we never render
 * "concerns noted" (or a meets-criteria claim) without something on record.
 */
export function resolveComplianceStatus(badge: ComplianceBadge): ResolvedComplianceStatus {
  const documented = !!badge.notes?.trim()
  if (badge.status === 'compliant'     && documented) return 'met'
  if (badge.status === 'non_compliant' && documented) return 'concerns'
  return 'not_assessed'
}

/** Fill in any regulation missing from the stored set as "not yet assessed". */
export function withAllRegulations(compliance: ComplianceBadge[]): ComplianceBadge[] {
  const byRegulation = Object.fromEntries(compliance.map((c) => [c.regulation, c]))
  return COMPLIANCE_REGULATIONS.map(
    (reg) => byRegulation[reg] ?? { regulation: reg, status: 'not_assessed', notes: null },
  )
}
