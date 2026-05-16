import type { ExperienceRiskInput, ExperienceRiskResult, ExperienceBenefitResult } from './types'

const v = (n: number | null | undefined): number => n ?? 0

export function calculateExperienceRisk(input: ExperienceRiskInput): ExperienceRiskResult {
  const dopamine     = v(input.dopamineTrapScore) / 3       // R1 normalized
  const monetization = v(input.monetizationScore) / 3       // R2 normalized

  // R3 social: toxicity and stranger exposure dominate; privacy is real but narrower
  const toxicity  = v(input.toxicityScore) / 3
  const stranger  = v(input.strangerRisk) / 3
  const privacy   = v(input.privacyRisk) / 3
  const social    = toxicity * 0.4 + stranger * 0.4 + privacy * 0.2

  // R4 content: display only, not in RIS
  const contentRisk = v(input.ugcContentRisk) / 3

  // Same category weights as the standalone rubric
  const ris = dopamine * 0.45 + monetization * 0.30 + social * 0.25

  return { dopamine, monetization, social, contentRisk, ris }
}

export function calculateExperienceBenefits(
  creativityScore: number | null | undefined,
  socialScore: number | null | undefined,
  learningScore: number | null | undefined,
): ExperienceBenefitResult {
  // creativity spans both expressive (B1) and collaborative (B2) — split 50/50
  // Max input to each composite = learning/social(3) + creativity(3)×0.5 = 4.5 → divide by 4.5
  const cognitive       = (v(learningScore) + v(creativityScore) * 0.5) / 4.5
  const socialEmotional = (v(socialScore)   + v(creativityScore) * 0.5) / 4.5
  // motor = 0: experience pipeline does not assess motor skills

  const bds = cognitive * 0.50 + socialEmotional * 0.30
  return { cognitive, socialEmotional, bds }
}

// ─── Score floors and confidence caps ─────────────────────────────────────────
//
// Title-only inputs lead the AI toward implausible extremes (all-zero risks,
// max-creativity from a single word like "Studio"). These rules reflect the
// floors already documented in the cron prompt's own calibration table:
//   - All UGC sessions have at least mild dopamine pull → dopamine ≥ 1
//   - Multiplayer-by-default platforms expose strangers unless the experience
//     is verifiably solo-instance → stranger ≥ 1 unless solo-indicators match
//   - Without a description, max creativity/learning (3) cannot be justified
//     from a title alone → cap at 2

export type DimensionalScores = {
  dopamineTrapScore: number
  toxicityScore:     number
  ugcContentRisk:    number
  strangerRisk:      number
  monetizationScore: number
  privacyRisk:       number
  creativityScore:   number
  socialScore:       number
  learningScore:     number
}

// Words/phrases that signal a genuinely solo-instance experience where
// strangerRisk=0 is plausible per the cron prompt's calibration.
const SOLO_PATTERN = /\b(solo|1p|single[\s-]?player|aim[\s-]?(train(er|ing)?|course|map|practice)|deathrun|parkour|obby|obstacle\s*course|escape\s*room)\b/i

const SHORT_DESC_THRESHOLD = 30

export type FloorContext = {
  title:        string | null | undefined
  description:  string | null | undefined
  genre:        string | null | undefined
  platformSlug: string
}

export type AppliedFloor = {
  dimension: keyof DimensionalScores
  from:      number
  to:        number
  reason:    string
}

export function applyScoreFloors(
  scores: DimensionalScores,
  ctx: FloorContext,
): { scores: DimensionalScores; applied: AppliedFloor[] } {
  const isUgcPlatform = ctx.platformSlug === 'fortnite-creative' || ctx.platformSlug === 'roblox'
  if (!isUgcPlatform) return { scores, applied: [] }

  const applied: AppliedFloor[] = []
  const out: DimensionalScores = { ...scores }

  // Dopamine floor: session-based platforms always have some pull.
  if (out.dopamineTrapScore < 1) {
    applied.push({ dimension: 'dopamineTrapScore', from: out.dopamineTrapScore, to: 1, reason: 'UGC-platform session floor' })
    out.dopamineTrapScore = 1
  }

  // Stranger floor: 0 is reserved for verifiably solo-instance maps.
  const haystack = [ctx.title, ctx.description, ctx.genre].filter(Boolean).join(' ')
  const looksSolo = SOLO_PATTERN.test(haystack)
  if (out.strangerRisk < 1 && !looksSolo) {
    applied.push({ dimension: 'strangerRisk', from: out.strangerRisk, to: 1, reason: 'no solo-instance signal in title/description/genre' })
    out.strangerRisk = 1
  }

  // Low-confidence cap: title-only input cannot justify max creativity/learning.
  const descLen = (ctx.description ?? '').trim().length
  if (descLen < SHORT_DESC_THRESHOLD) {
    if (out.creativityScore > 2) {
      applied.push({ dimension: 'creativityScore', from: out.creativityScore, to: 2, reason: `description <${SHORT_DESC_THRESHOLD} chars — title-only confidence cap` })
      out.creativityScore = 2
    }
    if (out.learningScore > 2) {
      applied.push({ dimension: 'learningScore', from: out.learningScore, to: 2, reason: `description <${SHORT_DESC_THRESHOLD} chars — title-only confidence cap` })
      out.learningScore = 2
    }
  }

  return { scores: out, applied }
}

// ─── Input confidence ─────────────────────────────────────────────────────────
//
// Confidence (0–1) is "how much real data did we have to score from?" UGC
// platforms list thousands of obscure maps with title-only metadata; floors
// stop the AI from inventing extreme scores but cannot rescue confidence in
// the result. When confidence is low we hide the curascore in the UI and
// surface "not enough info yet" instead — honest absence over a wonky number.
//
// Fortnite Creative doesn't expose freeform descriptions, but the public
// island page surfaces tagline, content descriptors, tags, age rating, and
// active player count. Roblox exposes a real description + visit count via
// its public API. The formula accepts narrative copy from either path so
// both platforms can clear the threshold honestly.
//
// Weights (sum to 1.0):
//   narrative copy (description OR tagline ≥ 30 chars)  0.35
//   content descriptors (≥ 1, e.g. "Moderate Violence")  0.20
//   popularity signal (visits OR active players > 0)     0.15
//   age rating (PEGI / ESRB / USK / …)                   0.15
//   tags (≥ 2)                                           0.10
//   creator handle present                               0.05

export type ConfidenceContext = {
  description:        string | null | undefined
  tagline:            string | null | undefined
  contentDescriptors: string[] | null | undefined
  tags:               string[] | null | undefined
  ageRating:          string | null | undefined
  visitCount:         number | null | undefined
  activePlayers:      number | null | undefined
  creatorName:        string | null | undefined
}

export const CONFIDENCE_THRESHOLD = 0.5

export function computeInputConfidence(ctx: ConfidenceContext): number {
  const narrativeLen = Math.max(
    (ctx.description ?? '').trim().length,
    (ctx.tagline ?? '').trim().length,
  )
  let c = 0
  if (narrativeLen >= 30)                                                c += 0.35
  if ((ctx.contentDescriptors ?? []).length >= 1)                        c += 0.20
  if ((ctx.visitCount ?? 0) > 0 || (ctx.activePlayers ?? 0) > 0)         c += 0.15
  if ((ctx.ageRating ?? '').trim().length > 0)                           c += 0.15
  if ((ctx.tags ?? []).length >= 2)                                      c += 0.10
  if ((ctx.creatorName ?? '').trim().length > 0)                         c += 0.05
  return Math.round(c * 1000) / 1000
}
