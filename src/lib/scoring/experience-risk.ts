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
