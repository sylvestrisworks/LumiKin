export type TocEntry = {
  id: string
  label: string
  level: 2 | 3
}

export type MethodologyVersion = {
  version: string
  publishedDate: string
  changelogSummary: string
  isCurrent: boolean
  toc: TocEntry[]
}

const STANDARD_TOC: TocEntry[] = [
  { id: 'overview',                    label: 'Overview',                      level: 2 },
  { id: 'the-scoring-model',           label: 'The Scoring Model',             level: 2 },
  { id: 'b1-cognitive',                label: 'B1 — Cognitive',                level: 2 },
  { id: 'b2-social-emotional',         label: 'B2 — Social-Emotional',         level: 2 },
  { id: 'b3-motor',                    label: 'B3 — Motor',                    level: 2 },
  { id: 'r1-dopamine-design',          label: 'R1 — Dopamine Design',          level: 2 },
  { id: 'r2-monetization',             label: 'R2 — Monetization',             level: 2 },
  { id: 'r3-social-risk',              label: 'R3 — Social Risk',              level: 2 },
  { id: 'r4-content-risk',             label: 'R4 — Content Risk',             level: 2 },
  { id: 'update-and-versioning-policy', label: 'Update & Versioning Policy',   level: 2 },
  { id: 'limitations-and-edge-cases',  label: 'Limitations & Edge Cases',      level: 2 },
  { id: 'changelog',                   label: 'Changelog',                     level: 2 },
]

export const METHODOLOGY_REGISTRY: MethodologyVersion[] = [
  {
    version:          '1.0',
    publishedDate:    '2026-04-26',
    changelogSummary: 'Initial published methodology.',
    isCurrent:        true,
    toc:              STANDARD_TOC,
  },
]

export const CURRENT_METHODOLOGY_VERSION =
  METHODOLOGY_REGISTRY.find(m => m.isCurrent)!.version

/** Total number of scoring dimensions defined in the rubric (B1+B2+B3+R1+R2+R3+R4). */
export const RUBRIC_DIMENSION_COUNT = 49

export function getMethodologyVersion(versionParam: string | undefined): MethodologyVersion | null {
  if (!versionParam) return METHODOLOGY_REGISTRY.find(m => m.isCurrent) ?? null
  return METHODOLOGY_REGISTRY.find(m => m.version === versionParam) ?? null
}
