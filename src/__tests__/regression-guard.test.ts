// Credibility regression guard (P2-12).
//
// Fails the build if the trust-breaking issues from the June 2026 hardening
// pass reappear:
//   1. Bracketed editorial placeholders ("[Rationale…", "To be added") or other
//      scaffold markers in shipped content.
//   2. Duplicated score-label strings ("recommended recommended",
//      "children recommended").
//   3. A methodology version string that has drifted from the canonical
//      constant (page, changelog, and PDF artifact must agree).
//   4. The retired "PlaySmart" brand reappearing on a user-facing surface.
//
// Deliberately reintroducing any of these makes this test — and therefore CI —
// fail. It scans the editable content surfaces (content/, messages/) and the
// app source (src/), not a live render, so it runs without a server or DB.

import { describe, expect, test } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, extname } from 'path'
import {
  CURRENT_METHODOLOGY_VERSION,
  METHODOLOGY_PDF_VERSION,
  METHODOLOGY_REGISTRY,
} from '@/lib/methodology'

const REPO_ROOT = join(__dirname, '..', '..')

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, exts, acc)
    else if (exts.includes(extname(full))) acc.push(full)
  }
  return acc
}

const CONTENT_FILES = [
  ...walk(join(REPO_ROOT, 'content'), ['.mdx', '.md']),
  ...walk(join(REPO_ROOT, 'messages'), ['.json']),
]
// Scan shipped source only — exclude test files (they name the very patterns
// they guard against, e.g. "PlaySmart", and would self-trip the scan).
const SRC_FILES = walk(join(REPO_ROOT, 'src'), ['.ts', '.tsx']).filter(
  (f) => !/(__tests__|\.test\.)/.test(f),
)

const read = (f: string) => readFileSync(f, 'utf8')
const rel = (f: string) => f.slice(REPO_ROOT.length + 1).replace(/\\/g, '/')

describe('regression guard: editorial placeholders', () => {
  const PLACEHOLDER =
    /\[(Rationale|Citations|Research basis|Versioning policy|Communication policy|Placeholder|TODO|TK)\b|To be (added|compiled|confirmed|determined|written)/i

  test('no bracketed placeholder text in shipped content', () => {
    const offenders = CONTENT_FILES.filter((f) => PLACEHOLDER.test(read(f))).map(rel)
    expect(offenders, `placeholder text found in: ${offenders.join(', ')}`).toEqual([])
  })
})

describe('regression guard: duplicated score labels', () => {
  const DUPLICATED = /recommended\s+recommended|children recommended/i

  test('no doubled "recommended" strings in content', () => {
    const offenders = CONTENT_FILES.filter((f) => DUPLICATED.test(read(f))).map(rel)
    expect(offenders, `duplicated label found in: ${offenders.join(', ')}`).toEqual([])
  })
})

describe('regression guard: methodology version is single-sourced', () => {
  test('the current version has a changelog row in its MDX', () => {
    const mdx = read(join(REPO_ROOT, 'content', 'methodology', `v${CURRENT_METHODOLOGY_VERSION}.mdx`))
    expect(mdx).toContain(CURRENT_METHODOLOGY_VERSION)
  })

  test('a PDF artifact exists for the version the links point at', () => {
    const pdf = join(REPO_ROOT, 'public', `lumikin-methodology-v${METHODOLOGY_PDF_VERSION}.pdf`)
    expect(existsSync(pdf), `missing PDF artifact: ${pdf}`).toBe(true)
    const entry = METHODOLOGY_REGISTRY.find((m) => m.version === METHODOLOGY_PDF_VERSION)
    expect(entry?.pdfAvailable, 'METHODOLOGY_PDF_VERSION points at a version not marked pdfAvailable').toBe(true)
  })

  test('no source file hardcodes a methodology PDF version — must use the constant', () => {
    // The single source of truth builds the path from a constant
    // (`lumikin-methodology-v${METHODOLOGY_PDF_VERSION}.pdf`); a literal version
    // digit means someone bypassed it and can drift.
    const HARDCODED = /lumikin-methodology-v\d/
    const offenders = SRC_FILES.filter((f) => HARDCODED.test(read(f))).map(rel)
    expect(offenders, `hardcoded methodology PDF version in: ${offenders.join(', ')}`).toEqual([])
  })
})

describe('regression guard: retired brand', () => {
  test('"PlaySmart" does not appear in source or content', () => {
    const PLAYSMART = /playsmart/i
    const offenders = [...SRC_FILES, ...CONTENT_FILES].filter((f) => PLAYSMART.test(read(f))).map(rel)
    expect(offenders, `"PlaySmart" found in: ${offenders.join(', ')}`).toEqual([])
  })
})
