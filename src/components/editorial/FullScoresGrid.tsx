'use client'

import { useTranslations } from 'next-intl'
import { ScoreTable, type ScoreRow } from './ScoreTable'
import type { SerializedReview, SerializedScores } from '@/types/game'

// Granular breakdown of all ~44 review fields. Each field is normalized to
// 0-1 for the bar display (legacy uses 0-5 for benefits, 0-3 for risks).
// Field labels reuse the existing `gameCard.field*` i18n keys so we don't
// duplicate strings — these keys are already translated across all locales.

type T = ReturnType<typeof useTranslations<'gameCard'>>

function bRow(code: string, label: string, value: number | null): ScoreRow {
  return { code, label, value: (value ?? 0) / 5 }
}

function rRow(code: string, label: string, value: number | null): ScoreRow {
  return { code, label, value: (value ?? 0) / 3 }
}

// Display-only sections normalize off the 0-3 scale.
function dRow(code: string, label: string, value: number | null): ScoreRow {
  return { code, label, value: (value ?? 0) / 3 }
}

// Display-only sections — surfaced only when at least one field is non-null,
// matching legacy GameCard which skipped these entirely if data was missing.
type DisplaySection = { code: string; title: string; suffix?: string; tone: 'ink' | 'accent'; rows: ScoreRow[] }

function buildDisplayOnlySections(review: SerializedReview, t: T): DisplaySection[] {
  const sections: DisplaySection[] = []

  if ([review.violenceLevel, review.sexualContent, review.language, review.substanceRef, review.fearHorror].some((v) => v != null)) {
    sections.push({
      code: 'R4',
      title: t('r4Content'),
      suffix: t('displayOnly'),
      tone: 'accent',
      rows: [
        dRow('R4.1', t('fieldViolenceLevel'), review.violenceLevel),
        dRow('R4.2', t('fieldSexualContent'), review.sexualContent),
        dRow('R4.3', t('fieldLanguage'),      review.language),
        dRow('R4.4', t('fieldSubstanceRef'),  review.substanceRef),
        dRow('R4.5', t('fieldFearHorror'),    review.fearHorror),
      ],
    })
  }

  if ([review.r5CrossPlatform, review.r5LoadTime, review.r5MobileOptimized, review.r5LoginBarrier].some((v) => v != null)) {
    sections.push({
      code: 'R5',
      title: t('r5Accessibility'),
      suffix: t('displayOnly'),
      tone: 'ink',
      rows: [
        dRow('R5.1', t('fieldCrossPlatform'),   review.r5CrossPlatform),
        dRow('R5.2', t('fieldLoadTime'),        review.r5LoadTime),
        dRow('R5.3', t('fieldMobileOptimised'), review.r5MobileOptimized),
        dRow('R5.4', t('fieldLoginBarrier'),    review.r5LoginBarrier),
      ],
    })
  }

  if ([review.r6InfiniteGameplay, review.r6NoStoppingPoints, review.r6NoGameOver, review.r6NoChapterStructure].some((v) => v != null)) {
    sections.push({
      code: 'R6',
      title: t('r6Endless'),
      suffix: t('displayOnly'),
      tone: 'accent',
      rows: [
        dRow('R6.1', t('fieldInfiniteGameplay'),   review.r6InfiniteGameplay),
        dRow('R6.2', t('fieldNoStoppingPoints'),   review.r6NoStoppingPoints),
        dRow('R6.3', t('fieldNoGameOver'),         review.r6NoGameOver),
        dRow('R6.4', t('fieldNoChapterStructure'), review.r6NoChapterStructure),
      ],
    })
  }

  if (review.repGenderBalance != null || review.repEthnicDiversity != null) {
    sections.push({
      code: 'REP',
      title: t('repHeader'),
      suffix: t('higherIsBetter'),
      tone: 'ink',
      rows: [
        dRow('REP.1', t('fieldGenderBalance'),   review.repGenderBalance),
        dRow('REP.2', t('fieldEthnicDiversity'), review.repEthnicDiversity),
      ],
    })
  }

  if (review.propagandaLevel != null) {
    sections.push({
      code: 'PROP',
      title: t('propHeader'),
      suffix: t('displayOnly'),
      tone: 'accent',
      rows: [
        dRow('PROP.1', t('fieldPropagandaLevel'), review.propagandaLevel),
      ],
    })
  }

  return sections
}

function buildBenefitSections(review: SerializedReview, t: T) {
  return [
    {
      code: 'B1',
      title: t('b1Cognitive'),
      rows: [
        bRow('B1.1',  t('fieldProblemSolving'),    review.problemSolving),
        bRow('B1.2',  t('fieldSpatialAwareness'),  review.spatialAwareness),
        bRow('B1.3',  t('fieldStrategicThinking'), review.strategicThinking),
        bRow('B1.4',  t('fieldCriticalThinking'),  review.criticalThinking),
        bRow('B1.5',  t('fieldMemoryAttention'),   review.memoryAttention),
        bRow('B1.6',  t('fieldCreativity'),        review.creativity),
        bRow('B1.7',  t('fieldReadingLanguage'),   review.readingLanguage),
        bRow('B1.8',  t('fieldMathSystems'),       review.mathSystems),
        bRow('B1.9',  t('fieldLearningTransfer'),  review.learningTransfer),
        bRow('B1.10', t('fieldAdaptiveChallenge'), review.adaptiveChallenge),
      ],
    },
    {
      code: 'B2',
      title: t('b2Social'),
      rows: [
        bRow('B2.1', t('fieldTeamwork'),            review.teamwork),
        bRow('B2.2', t('fieldCommunication'),       review.communication),
        bRow('B2.3', t('fieldEmpathy'),             review.empathy),
        bRow('B2.4', t('fieldEmotionalRegulation'), review.emotionalRegulation),
        bRow('B2.5', t('fieldEthicalReasoning'),    review.ethicalReasoning),
        bRow('B2.6', t('fieldPositiveSocial'),      review.positiveSocial),
      ],
    },
    {
      code: 'B3',
      title: t('b3Motor'),
      rows: [
        bRow('B3.1', t('fieldHandEye'),          review.handEyeCoord),
        bRow('B3.2', t('fieldFineMotor'),        review.fineMotor),
        bRow('B3.3', t('fieldReactionTime'),     review.reactionTime),
        bRow('B3.4', t('fieldPhysicalActivity'), review.physicalActivity),
      ],
    },
  ]
}

function buildRiskSections(review: SerializedReview, t: T) {
  return [
    {
      code: 'R1',
      title: t('r1Dopamine'),
      rows: [
        rRow('R1.1',  t('fieldVariableRewards'),      review.variableRewards),
        rRow('R1.2',  t('fieldStreakMechanics'),      review.streakMechanics),
        rRow('R1.3',  t('fieldLossAversion'),         review.lossAversion),
        rRow('R1.4',  t('fieldFomoEvents'),           review.fomoEvents),
        rRow('R1.5',  t('fieldStoppingBarriers'),     review.stoppingBarriers),
        rRow('R1.6',  t('fieldNotifications'),        review.notifications),
        rRow('R1.7',  t('fieldNearMiss'),             review.nearMiss),
        rRow('R1.8',  t('fieldInfinitePlay'),         review.infinitePlay),
        rRow('R1.9',  t('fieldEscalatingCommitment'), review.escalatingCommitment),
        rRow('R1.10', t('fieldRewardFrequency'),      review.variableRewardFreq),
      ],
    },
    {
      code: 'R2',
      title: t('r2Monetization'),
      rows: [
        rRow('R2.1', t('fieldSpendingCeiling'),      review.spendingCeiling),
        rRow('R2.2', t('fieldPayToWin'),             review.payToWin),
        rRow('R2.3', t('fieldCurrencyObfuscation'),  review.currencyObfuscation),
        rRow('R2.4', t('fieldSpendingPrompts'),      review.spendingPrompts),
        rRow('R2.5', t('fieldChildTargeting'),       review.childTargeting),
        rRow('R2.6', t('fieldAdPressure'),           review.adPressure),
        rRow('R2.7', t('fieldSubscriptionPressure'), review.subscriptionPressure),
        rRow('R2.8', t('fieldSocialSpending'),       review.socialSpending),
      ],
    },
    {
      code: 'R3',
      title: t('r3Social'),
      rows: [
        rRow('R3.1', t('fieldSocialObligation'),    review.socialObligation),
        rRow('R3.2', t('fieldCompetitiveToxicity'), review.competitiveToxicity),
        rRow('R3.3', t('fieldStrangerRisk'),        review.strangerRisk),
        rRow('R3.4', t('fieldSocialComparison'),    review.socialComparison),
        rRow('R3.5', t('fieldIdentitySelfWorth'),   review.identitySelfWorth),
        rRow('R3.6', t('fieldPrivacyRisk'),         review.privacyRisk),
      ],
    },
  ]
}

export function FullScoresGrid({
  scores,
  review,
}: {
  scores: SerializedScores | null
  review: SerializedReview | null
}) {
  const t = useTranslations('gameCard')

  if (!review) {
    return (
      <p className="font-serif italic text-muted">
        {t('noReviewData')}
      </p>
    )
  }

  const benefitSections     = buildBenefitSections(review, t)
  const riskSections        = buildRiskSections(review, t)
  const displayOnlySections = buildDisplayOnlySections(review, t)
  const propagandaNotes     = review.propagandaNotes
  const bechdelResult       = review.bechdelResult

  return (
    <div className="space-y-12">
      <div className="space-y-10">
        <p
          className="text-kicker uppercase font-semibold text-ivy"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {t('benefitScoresHeader')}
          <span className="ml-3 text-muted tabular-nums normal-case tracking-normal">
            BDS {Math.round((scores?.bds ?? 0) * 100)} / 100
          </span>
        </p>
        {benefitSections.map((s) => (
          <ScoreTable key={s.code} title={`${s.code} · ${s.title}`} rows={s.rows} tone="ink" />
        ))}
      </div>

      <div className="space-y-10">
        <p
          className="text-kicker uppercase font-semibold text-accent"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {t('riskScoresHeader')}
          <span className="ml-3 text-muted tabular-nums normal-case tracking-normal">
            RIS {Math.round((scores?.ris ?? 0) * 100)} / 100
          </span>
        </p>
        {riskSections.map((s) => (
          <ScoreTable key={s.code} title={`${s.code} · ${s.title}`} rows={s.rows} tone="accent" />
        ))}
      </div>

      {/* Display-only sections — content / accessibility / endless design /
          representation / propaganda / Bechdel. Surfaced only when at least
          one field is non-null. These don't feed BDS or RIS; they sit below
          the main rubric tables under a muted "Display only" qualifier. */}
      {(displayOnlySections.length > 0 || propagandaNotes || bechdelResult) && (
        <div className="space-y-10 pt-6 border-t border-ink/30">
          <p
            className="text-kicker uppercase font-semibold text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Context · {t('displayOnly')}
          </p>
          {displayOnlySections.map((s) => (
            <div key={s.code}>
              <ScoreTable
                title={`${s.code} · ${s.title}${s.suffix ? ` · ${s.suffix}` : ''}`}
                rows={s.rows}
                tone={s.tone}
              />
              {s.code === 'PROP' && propagandaNotes && (
                <p className="mt-3 font-serif italic text-sm text-muted leading-snug max-w-prose">
                  {propagandaNotes}
                </p>
              )}
            </div>
          ))}

          {bechdelResult && (
            <div className="border-t border-ink/20 pt-6">
              <p
                className="text-kicker uppercase font-semibold text-ink mb-2"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                <span className="mr-2">♀</span>
                {t('bechdelTitle')}
                <span className="ml-3 text-muted normal-case tracking-normal font-normal">
                  — {bechdelResult === 'pass' ? t('bechdelPass') : bechdelResult === 'na' ? t('bechdelNa') : t('bechdelFail')}
                </span>
              </p>
              {review.bechdelNotes && (
                <p className="font-serif italic text-sm text-muted leading-snug max-w-prose">
                  {review.bechdelNotes}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
