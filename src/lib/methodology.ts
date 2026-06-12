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
  /** Whether a downloadable PDF exists at /lumikin-methodology-v{version}.pdf */
  pdfAvailable: boolean
}

const TOC_V10: TocEntry[] = [
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

// v1.1 adds nested entries under R4 for the new Age-Floor Policy section.
const TOC_V11: TocEntry[] = [
  { id: 'overview',                     label: 'Overview',                    level: 2 },
  { id: 'the-scoring-model',            label: 'The Scoring Model',           level: 2 },
  { id: 'b1-cognitive',                 label: 'B1 — Cognitive',              level: 2 },
  { id: 'b2-social-emotional',          label: 'B2 — Social-Emotional',       level: 2 },
  { id: 'b3-motor',                     label: 'B3 — Motor',                  level: 2 },
  { id: 'r1-dopamine-design',           label: 'R1 — Dopamine Design',        level: 2 },
  { id: 'r2-monetization',              label: 'R2 — Monetization',           level: 2 },
  { id: 'r3-social-risk',               label: 'R3 — Social Risk',            level: 2 },
  { id: 'r4-content-risk',              label: 'R4 — Content Risk',           level: 2 },
  { id: 'age-floor-policy',             label: 'Age-Floor Policy',            level: 3 },
  { id: 'r4-context-modifiers',         label: 'R4 context modifiers',        level: 3 },
  { id: 'update-and-versioning-policy', label: 'Update & Versioning Policy',  level: 2 },
  { id: 'limitations-and-edge-cases',   label: 'Limitations & Edge Cases',    level: 2 },
  { id: 'changelog',                    label: 'Changelog',                   level: 2 },
]

export const METHODOLOGY_REGISTRY: MethodologyVersion[] = [
  {
    version:          '1.0',
    publishedDate:    '2026-04-26',
    changelogSummary: 'Initial published methodology.',
    isCurrent:        false,
    toc:              TOC_V10,
    pdfAvailable:     true,
  },
  {
    version:          '1.1',
    publishedDate:    '2026-05-01',
    changelogSummary: 'Age-Floor Policy formalised; R4.5 (fear/horror) added as a third age-floor dimension alongside R4.1 and R4.2. Fear floors: 0→0, 1→7, 2→10, 3→13. Context modifiers (trivialized, defenceless_target, mixed_sexual_violent) introduced for R4.1 and R4.2. Games with fearHorror ≥ 1 may receive a higher recommendedMinAge than under v1.0.',
    isCurrent:        true,
    toc:              TOC_V11,
    pdfAvailable:     true,
  },
]

export const CURRENT_METHODOLOGY_VERSION =
  METHODOLOGY_REGISTRY.find(m => m.isCurrent)!.version

/**
 * Single source of truth for the downloadable methodology PDF.
 *
 * Points at the newest registry version that actually has a committed PDF
 * artifact (`pdfAvailable: true`). This prevents the homepage/partners/press
 * links from 404ing when the current methodology version ships before its PDF
 * has been generated. Once `scripts/generate-methodology-pdf.ts` produces the
 * PDF for the current version and its registry entry flips `pdfAvailable` to
 * true, every link upgrades to the current version automatically.
 *
 * Every surface that links the methodology PDF MUST read `METHODOLOGY_PDF_PATH`
 * (or `METHODOLOGY_PDF_VERSION`) — never hand-build the path from a version
 * string — so the displayed page and the downloadable artifact cannot drift.
 */
export const METHODOLOGY_PDF_VERSION =
  [...METHODOLOGY_REGISTRY].reverse().find(m => m.pdfAvailable)?.version
  ?? CURRENT_METHODOLOGY_VERSION

export const METHODOLOGY_PDF_PATH = `/lumikin-methodology-v${METHODOLOGY_PDF_VERSION}.pdf`

/** Total number of scoring dimensions defined in the rubric (B1+B2+B3+R1+R2+R3+R4). */
export const RUBRIC_DIMENSION_COUNT = 49

export function getMethodologyVersion(versionParam: string | undefined): MethodologyVersion | null {
  if (!versionParam) return METHODOLOGY_REGISTRY.find(m => m.isCurrent) ?? null
  return METHODOLOGY_REGISTRY.find(m => m.version === versionParam) ?? null
}
