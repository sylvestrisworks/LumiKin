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

  const benefitSections = buildBenefitSections(review, t)
  const riskSections    = buildRiskSections(review, t)

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
    </div>
  )
}
