'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { Lightbulb, Sparkles, Zap, Clock, CheckCircle2, User, GitCompareArrows } from 'lucide-react'
import type { DarkPattern, GameCardProps, SerializedReview, SerializedScores } from '@/types/game'
import { esrbToAge, ageBadgeColor } from '@/lib/ui'
import DarkPatternPills from './DarkPatternPills'
import ComplianceBadges from './ComplianceBadges'
import ShareButton from './ShareCard'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(title: string): string {
  return title.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

const PLACEHOLDER_COLORS = [
  'from-violet-500 to-indigo-600', 'from-indigo-500 to-blue-600',
  'from-blue-500 to-cyan-600',     'from-teal-500 to-emerald-600',
  'from-amber-500 to-orange-600',  'from-orange-500 to-red-600',
]
function placeholderGradient(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash)
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length]
}

function pct(value: number | null | undefined): string {
  return `${Math.round((value ?? 0) * 100)}%`
}


function riskBarColor(value: number | null): string {
  const v = value ?? 0
  if (v < 0.3) return 'bg-emerald-400'
  if (v < 0.6) return 'bg-amber-400'
  return 'bg-red-400'
}

function riskLevel(value: number | null): { labelKey: 'riskLow' | 'riskModerate' | 'riskHigh'; color: string; bg: string } {
  const v = value ?? 0
  if (v < 0.3) return { labelKey: 'riskLow',      color: 'text-emerald-700', bg: 'bg-emerald-100' }
  if (v < 0.6) return { labelKey: 'riskModerate', color: 'text-amber-700',   bg: 'bg-amber-100'   }
  return              { labelKey: 'riskHigh',     color: 'text-red-700',     bg: 'bg-red-100'     }
}

function scoreBarColor(value: number | null): string {
  const v = value ?? 0
  if (v >= 0.7) return 'bg-emerald-400'
  if (v >= 0.4) return 'bg-blue-400'
  return 'bg-slate-300'
}

function curascoreGradient(score: number | null): string {
  const s = score ?? 0
  if (s >= 70) return 'from-emerald-400 to-teal-500'
  if (s >= 40) return 'from-amber-400 to-orange-500'
  return 'from-red-400 to-rose-500'
}

type StatusVerdict = { label: string; color: string; bg: string; ring: string }
function getVerdict(score: number | null): StatusVerdict {
  const s = score ?? 0
  if (s >= 70) return { label: 'GREAT',   color: 'text-emerald-600', bg: 'bg-emerald-50',  ring: '#10b981' }
  if (s >= 50) return { label: 'GOOD',    color: 'text-teal-600',    bg: 'bg-teal-50',     ring: '#14b8a6' }
  if (s >= 35) return { label: 'CAUTION', color: 'text-amber-600',   bg: 'bg-amber-50',    ring: '#f59e0b' }
  return              { label: 'AVOID',   color: 'text-red-600',     bg: 'bg-red-50',      ring: '#ef4444' }
}

// ─── Horseshoe ring ───────────────────────────────────────────────────────────

function HorseshoeRing({ score }: { score: number | null }) {
  const s       = score ?? 0
  const verdict = getVerdict(s)
  const size    = 160
  const cx      = size / 2
  const cy      = size / 2
  const r       = 62
  const stroke  = 12
  const circ    = 2 * Math.PI * r
  // 270° arc — gap at bottom
  const totalArc = (270 / 360) * circ
  const gap      = circ - totalArc
  const filled   = (s / 100) * totalArc

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(135deg)' }} aria-hidden="true">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0"
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${totalArc} ${gap}`} />
        {/* Fill */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={verdict.ring} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-4">
        <span className="text-5xl font-black tracking-tighter leading-none" style={{ color: verdict.ring }}>{s}</span>
        <span className="text-xs font-bold text-slate-400 mt-1">/ 100</span>
      </div>
    </div>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex items-center ml-1">
      <span className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 text-[9px] font-black flex items-center justify-center cursor-help leading-none">
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-xl bg-slate-800 px-3 py-2 text-xs text-white leading-snug opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 text-center shadow-lg">
        {text}
      </span>
    </span>
  )
}

// ─── Shared small components ──────────────────────────────────────────────────

function SkillDots({ score, max = 5 }: { score: number | null; max?: number }) {
  const filled = Math.round(score ?? 0)
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < filled ? 'bg-emerald-500' : 'bg-slate-200'}`} />
      ))}
    </span>
  )
}

function CategoryBar({ label, value, tooltip }: { label: string; value: number | null; tooltip?: string }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="w-28 sm:w-36 text-xs sm:text-sm text-slate-600 shrink-0 flex items-center">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </span>
      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${scoreBarColor(value)}`} style={{ width: pct(value) }} />
      </div>
      <span className="w-8 sm:w-10 text-right text-xs sm:text-sm font-medium text-slate-700 shrink-0">
        {Math.round((value ?? 0) * 100)}
      </span>
    </div>
  )
}

function RiskMeter({ label, value, note, tooltip }: { label: string; value: number | null; note?: string; tooltip?: string }) {
  const tGC = useTranslations('gameCard')
  const level = riskLevel(value)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-medium text-slate-700 flex items-center min-w-0">
          {label}
          {tooltip && <Tooltip text={tooltip} />}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${level.bg} ${level.color}`}>
          {tGC(level.labelKey)}
        </span>
      </div>
      <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${riskBarColor(value)}`} style={{ width: pct(value) }} />
      </div>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  )
}

function DetailRow({ label, score, max }: { label: string; score: number | null; max: number }) {
  const value = score ?? 0
  const fraction = value / max
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex-1 text-xs text-slate-600 min-w-0">{label}</span>
      <div className="w-16 sm:w-28 bg-slate-100 rounded-full h-2 overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${scoreBarColor(fraction)}`} style={{ width: `${(fraction * 100).toFixed(0)}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-medium text-slate-500 shrink-0">{value}/{max}</span>
    </div>
  )
}

// ─── Tab content ──────────────────────────────────────────────────────────────

type T = ReturnType<typeof useTranslations<'gameCard'>>

function BenefitsTab({ scores, review, t }: { scores: SerializedScores; review: SerializedReview | null; t: T }) {
  return (
    <div className="space-y-8">
      {scores.topBenefits && scores.topBenefits.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{t('topSkillsDeveloped')}</h3>
          <div className="space-y-2">
            {scores.topBenefits.map((b) => (
              <div key={b.skill} className="flex items-center gap-2">
                <span className="w-32 sm:w-44 text-xs sm:text-sm font-medium text-slate-700 shrink-0">{b.skill}</span>
                <SkillDots score={b.score} max={b.maxScore} />
                <span className="text-xs text-slate-400 ml-1">{b.score}/{b.maxScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{t('developmentAreas')}</h3>
        <div className="space-y-3">
          <CategoryBar label={t('cognitive')}       value={scores.cognitiveScore}       tooltip={t('tooltipCognitive')} />
          <CategoryBar label={t('socialEmotional')} value={scores.socialEmotionalScore} tooltip={t('tooltipSocialEmotional')} />
          <CategoryBar label={t('motorSkills')}     value={scores.motorScore}           tooltip={t('tooltipMotor')} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-500">{t('overallBds')}</span>
          <span className="text-sm font-bold text-emerald-700">{Math.round((scores.bds ?? 0) * 100)}/100</span>
        </div>
      </div>
      {/* Representation */}
      {review && (review.repGenderBalance != null || review.repEthnicDiversity != null || review.bechdelResult != null) && (
        <div className="bg-purple-50 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-1.5">
            {t('representationSection')}
            <Tooltip text={t('tooltipRepresentation')} />
          </h3>
          <div className="space-y-1.5">
            {review.repGenderBalance != null && (
              <div className="flex items-center gap-3">
                <span className="w-28 sm:w-36 text-xs text-purple-700 shrink-0">{t('genderBalance')}</span>
                <div className="flex-1 bg-purple-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full bg-purple-400 transition-all" style={{ width: `${(review.repGenderBalance / 3) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-medium text-purple-700">{review.repGenderBalance}/3</span>
              </div>
            )}
            {review.repEthnicDiversity != null && (
              <div className="flex items-center gap-3">
                <span className="w-28 sm:w-36 text-xs text-purple-700 shrink-0">{t('ethnicDiversity')}</span>
                <div className="flex-1 bg-purple-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full bg-purple-400 transition-all" style={{ width: `${(review.repEthnicDiversity / 3) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-medium text-purple-700">{review.repEthnicDiversity}/3</span>
              </div>
            )}
          </div>
          {review.bechdelResult != null && (
            <div className={`flex items-start gap-3 rounded-xl p-3 ${
              review.bechdelResult === 'pass' ? 'bg-violet-100' : 'bg-purple-100'
            }`}>
              <span className="text-base leading-none mt-0.5">♀</span>
              <div>
                <p className={`text-xs font-semibold ${review.bechdelResult === 'pass' ? 'text-violet-800' : 'text-purple-600'}`}>
                  {t('bechdelPasses')}
                  {review.bechdelResult !== 'pass' && (
                    <span className="font-normal ml-1">
                      {review.bechdelResult === 'na' ? `— ${t('bechdelNa')}` : '— does not pass'}
                    </span>
                  )}
                </p>
                {review.bechdelNotes && (
                  <p className="text-xs text-purple-700 mt-0.5 leading-relaxed">{review.bechdelNotes}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {review?.parentTipBenefits && (
        <div className="bg-blue-50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={14} className="text-blue-600 shrink-0" strokeWidth={2.5} />
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-700">{t('parentProTip')}</h3>
          </div>
          <p className="text-sm text-blue-900 leading-relaxed">{review.parentTipBenefits}</p>
        </div>
      )}

      {review?.benefitsNarrative && (
        <div className="bg-emerald-50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-emerald-800 mb-1">{t('whatChildDevelops')}</h3>
          <p className="text-sm text-emerald-900 leading-relaxed">{review.benefitsNarrative}</p>
        </div>
      )}
    </div>
  )
}

function RisksTab({ scores, game, review, darkPatterns, t }: {
  scores: SerializedScores; game: GameCardProps['game']
  review: SerializedReview | null; darkPatterns: DarkPattern[]; t: T
}) {
  const flags = [
    game.hasMicrotransactions && t('flagInAppPurchases'),
    game.hasLootBoxes         && t('flagLootBoxes'),
    game.hasBattlePass        && t('flagBattlePass'),
    game.hasSubscription      && t('flagSubscription'),
    game.hasStrangerChat      && t('flagStrangerChat'),
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <RiskMeter label={t('dopamineManipulation')} value={scores.dopamineRisk}     note={t('riskNotesDopamine')}    tooltip={t('tooltipDopamine')} />
        <RiskMeter label={t('monetizationPressure')} value={scores.monetizationRisk} note={t('riskNotesMonetization')} tooltip={t('tooltipMonetization')} />
        <RiskMeter label={t('socialRisk')}           value={scores.socialRisk}       note={t('riskNotesSocial')}      tooltip={t('tooltipSocialRisk')} />
        <div>
          <RiskMeter label={t('contentRisk')} value={scores.contentRisk} note={t('riskNotesContent')} tooltip={t('tooltipContent')} />
          <p className="text-xs text-slate-400 mt-1">{t('contentRiskNote')}</p>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">{t('flags')}</h3>
          <div className="flex flex-wrap gap-2">
            {flags.map((f) => (
              <span key={f} className="text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Propaganda flag */}
      {review?.propagandaLevel != null && review.propagandaLevel > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-yellow-800 mb-1 flex items-center gap-1.5">
            {t('ideologicalContent')}
            <Tooltip text={t('tooltipIdeological')} />
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
              review.propagandaLevel === 1 ? 'bg-yellow-100 text-yellow-700' :
              review.propagandaLevel === 2 ? 'bg-orange-100 text-orange-700' :
              'bg-red-100 text-red-700'
            }`}>
              {review.propagandaLevel === 1 ? t('propagandaMild') : review.propagandaLevel === 2 ? t('propagandaNotable') : t('propagandaHeavy')}
            </span>
          </h3>
          {review.propagandaNotes && (
            <p className="text-xs text-yellow-800 leading-relaxed">{review.propagandaNotes}</p>
          )}
        </div>
      )}

      {review?.risksNarrative && (
        <div className="bg-slate-50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">{t('whatToWatch')}</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{review.risksNarrative}</p>
        </div>
      )}

      <DarkPatternPills patterns={darkPatterns} />

      {darkPatterns.some((p) => p.patternId === 'DP05') && (
        <div className="bg-purple-50 rounded-2xl p-3 text-sm text-purple-900">
          {t('dp05Message')}
        </div>
      )}

    </div>
  )
}

function FullScoresTab({ scores, review, t }: { scores: SerializedScores; review: SerializedReview | null; t: T }) {
  const [expanded, setExpanded] = useState(false)

  if (!review) return <p className="text-sm text-slate-400">{t('noReviewData')}</p>

  return (
    <div className="space-y-6">
      {/* Summary always visible */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-xl p-3 text-emerald-800">
          <p className="text-xs font-semibold mb-0.5">{t('bdsLabel')}</p>
          <p className="text-[10px] text-emerald-600 leading-snug">{t('bdsFormula')}</p>
          <p className="text-lg font-black mt-1">{Math.round((scores.bds ?? 0) * 100)}<span className="text-xs font-semibold">/100</span></p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-red-800">
          <p className="text-xs font-semibold mb-0.5">{t('risLabel')}</p>
          <p className="text-[10px] text-red-600 leading-snug">{t('risFormula')}</p>
          <p className="text-lg font-black mt-1">{Math.round((scores.ris ?? 0) * 100)}<span className="text-xs font-semibold">/100</span></p>
        </div>
      </div>

      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors py-1 border border-dashed border-indigo-200 rounded-lg hover:border-indigo-400"
      >
        {expanded ? t('hideItemScores') : t('expandItemScores')}
      </button>

      {expanded && (
      <>
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{t('benefitScoresHeader')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">{t('b1Cognitive')}</p>
            <DetailRow label={t('fieldProblemSolving')}    score={review.problemSolving}    max={5} />
            <DetailRow label={t('fieldSpatialAwareness')}  score={review.spatialAwareness}  max={5} />
            <DetailRow label={t('fieldStrategicThinking')} score={review.strategicThinking} max={5} />
            <DetailRow label={t('fieldCriticalThinking')}  score={review.criticalThinking}  max={5} />
            <DetailRow label={t('fieldMemoryAttention')}   score={review.memoryAttention}   max={5} />
            <DetailRow label={t('fieldCreativity')}        score={review.creativity}        max={5} />
            <DetailRow label={t('fieldReadingLanguage')}   score={review.readingLanguage}   max={5} />
            <DetailRow label={t('fieldMathSystems')}       score={review.mathSystems}       max={5} />
            <DetailRow label={t('fieldLearningTransfer')}  score={review.learningTransfer}  max={5} />
            <DetailRow label={t('fieldAdaptiveChallenge')} score={review.adaptiveChallenge} max={5} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">{t('b2Social')}</p>
            <DetailRow label={t('fieldTeamwork')}             score={review.teamwork}            max={5} />
            <DetailRow label={t('fieldCommunication')}        score={review.communication}       max={5} />
            <DetailRow label={t('fieldEmpathy')}              score={review.empathy}             max={5} />
            <DetailRow label={t('fieldEmotionalRegulation')}  score={review.emotionalRegulation} max={5} />
            <DetailRow label={t('fieldEthicalReasoning')}     score={review.ethicalReasoning}    max={5} />
            <DetailRow label={t('fieldPositiveSocial')}       score={review.positiveSocial}      max={5} />
            <p className="text-xs font-semibold text-slate-400 mt-3 mb-1">{t('b3Motor')}</p>
            <DetailRow label={t('fieldHandEye')}          score={review.handEyeCoord}     max={5} />
            <DetailRow label={t('fieldFineMotor')}        score={review.fineMotor}         max={5} />
            <DetailRow label={t('fieldReactionTime')}     score={review.reactionTime}      max={5} />
            <DetailRow label={t('fieldPhysicalActivity')} score={review.physicalActivity}  max={5} />
          </div>
        </div>
        <div className="mt-4 bg-emerald-50 rounded-xl p-3 text-xs text-emerald-800">
          <span className="font-semibold">BDS</span> = {t('bdsFormula')}{' = '}
          <span className="font-semibold">{Math.round((scores.bds ?? 0) * 100)}/100</span>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{t('riskScoresHeader')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">{t('r1Dopamine')}</p>
            <DetailRow label={t('fieldVariableRewards')}      score={review.variableRewards}      max={3} />
            <DetailRow label={t('fieldStreakMechanics')}      score={review.streakMechanics}      max={3} />
            <DetailRow label={t('fieldLossAversion')}         score={review.lossAversion}         max={3} />
            <DetailRow label={t('fieldFomoEvents')}           score={review.fomoEvents}           max={3} />
            <DetailRow label={t('fieldStoppingBarriers')}     score={review.stoppingBarriers}     max={3} />
            <DetailRow label={t('fieldNotifications')}        score={review.notifications}        max={3} />
            <DetailRow label={t('fieldNearMiss')}             score={review.nearMiss}             max={3} />
            <DetailRow label={t('fieldInfinitePlay')}         score={review.infinitePlay}         max={3} />
            <DetailRow label={t('fieldEscalatingCommitment')} score={review.escalatingCommitment} max={3} />
            <DetailRow label={t('fieldRewardFrequency')}      score={review.variableRewardFreq}   max={3} />
            <p className="text-xs font-semibold text-slate-400 mt-3 mb-1">{t('r2Monetization')}</p>
            <DetailRow label={t('fieldSpendingCeiling')}      score={review.spendingCeiling}      max={3} />
            <DetailRow label={t('fieldPayToWin')}             score={review.payToWin}             max={3} />
            <DetailRow label={t('fieldCurrencyObfuscation')}  score={review.currencyObfuscation}  max={3} />
            <DetailRow label={t('fieldSpendingPrompts')}      score={review.spendingPrompts}      max={3} />
            <DetailRow label={t('fieldChildTargeting')}       score={review.childTargeting}       max={3} />
            <DetailRow label={t('fieldAdPressure')}           score={review.adPressure}           max={3} />
            <DetailRow label={t('fieldSubscriptionPressure')} score={review.subscriptionPressure} max={3} />
            <DetailRow label={t('fieldSocialSpending')}       score={review.socialSpending}       max={3} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">{t('r3Social')}</p>
            <DetailRow label={t('fieldSocialObligation')}    score={review.socialObligation}    max={3} />
            <DetailRow label={t('fieldCompetitiveToxicity')} score={review.competitiveToxicity} max={3} />
            <DetailRow label={t('fieldStrangerRisk')}        score={review.strangerRisk}        max={3} />
            <DetailRow label={t('fieldSocialComparison')}    score={review.socialComparison}    max={3} />
            <DetailRow label={t('fieldIdentitySelfWorth')}   score={review.identitySelfWorth}   max={3} />
            <DetailRow label={t('fieldPrivacyRisk')}         score={review.privacyRisk}         max={3} />
            <p className="text-xs font-semibold text-slate-400 mt-3 mb-1">{t('r4Content')} {t('displayOnly')}</p>
            <DetailRow label={t('fieldViolenceLevel')}       score={review.violenceLevel}       max={3} />
            <DetailRow label={t('fieldSexualContent')}       score={review.sexualContent}       max={3} />
            <DetailRow label={t('fieldLanguage')}            score={review.language}            max={3} />
            <DetailRow label={t('fieldSubstanceRef')}        score={review.substanceRef}        max={3} />
            <DetailRow label={t('fieldFearHorror')}          score={review.fearHorror}          max={3} />
          </div>
        </div>
        <div className="mt-4 bg-red-50 rounded-xl p-3 text-xs text-red-800">
          <span className="font-semibold">RIS</span> = {t('risFormula')}{' = '}
          <span className="font-semibold">{Math.round((scores.ris ?? 0) * 100)}/100</span>
        </div>
      </div>

      {review && (review.r5CrossPlatform != null || review.r5LoadTime != null) && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            {t('r5Accessibility')} <span className="normal-case font-normal">{t('displayOnly')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8">
            <div>
              <DetailRow label={t('fieldCrossPlatform')}   score={review.r5CrossPlatform}   max={3} />
              <DetailRow label={t('fieldLoadTime')}         score={review.r5LoadTime}         max={3} />
              <DetailRow label={t('fieldMobileOptimised')}  score={review.r5MobileOptimized}  max={3} />
              <DetailRow label={t('fieldLoginBarrier')}     score={review.r5LoginBarrier}     max={3} />
            </div>
          </div>
        </div>
      )}

      {review && (review.r6InfiniteGameplay != null || review.r6NoStoppingPoints != null) && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            {t('r6Endless')} <span className="normal-case font-normal">{t('displayOnly')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8">
            <div>
              <DetailRow label={t('fieldInfiniteGameplay')}    score={review.r6InfiniteGameplay}   max={3} />
              <DetailRow label={t('fieldNoStoppingPoints')}    score={review.r6NoStoppingPoints}   max={3} />
              <DetailRow label={t('fieldNoGameOver')}          score={review.r6NoGameOver}         max={3} />
              <DetailRow label={t('fieldNoChapterStructure')}  score={review.r6NoChapterStructure} max={3} />
            </div>
          </div>
        </div>
      )}

      {review && (review.repGenderBalance != null || review.repEthnicDiversity != null) && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            {t('repHeader')} <span className="normal-case font-normal">{t('higherIsBetter')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8">
            <div>
              <DetailRow label={t('fieldGenderBalance')}   score={review.repGenderBalance}   max={3} />
              <DetailRow label={t('fieldEthnicDiversity')} score={review.repEthnicDiversity} max={3} />
            </div>
          </div>
        </div>
      )}

      {review && review.propagandaLevel != null && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            {t('propHeader')} <span className="normal-case font-normal">{t('displayOnly')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8">
            <div>
              <DetailRow label={t('fieldPropagandaLevel')} score={review.propagandaLevel} max={3} />
              {review.propagandaNotes && (
                <p className="text-xs text-slate-500 mt-1 italic">{review.propagandaNotes}</p>
              )}
            </div>
          </div>
        </div>
      )}
      </>
      )} {/* end expanded */}
    </div>
  )
}

// ─── Main GameCard — Bento Box layout ─────────────────────────────────────────

type Tab = 'benefits' | 'risks' | 'scores'

export default function GameCard({ game, scores, review, darkPatterns, compliance }: GameCardProps) {
  const t      = useTranslations('gameCard')
  const locale = useLocale()
  const [activeTab, setActiveTab] = useState<Tab>('benefits')

  const gradient = placeholderGradient(game.title)
  const abbr = game.title.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  const hasReview = scores !== null
  const risk = hasReview ? riskLevel(scores.ris) : null

  const tabClass = (tab: Tab) =>
    `px-4 py-2.5 text-sm font-semibold tracking-tight transition-colors rounded-xl ${
      activeTab === tab
        ? 'bg-white text-slate-900 shadow-sm'
        : 'text-slate-500 hover:text-slate-700'
    }`

  return (
    <div className="bg-gray-50 rounded-3xl p-5 space-y-4">

      {/* ── 1. HERO IMAGE — title + meta overlaid ──────────────────────────────── */}
      <div className="rounded-3xl overflow-hidden relative">
        {game.backgroundImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.backgroundImage} alt="" className="w-full h-52 object-cover" />
        ) : (
          <div className={`h-52 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-7xl font-black text-white/20 select-none">{abbr}</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Top-right badges */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {game.metacriticScore != null && (
            <span className="text-xs font-bold bg-black/40 backdrop-blur-sm text-white px-2.5 py-1 rounded-full border border-white/20">
              Metacritic {game.metacriticScore}
            </span>
          )}
          {game.esrbRating && (
            <span className={`text-xs font-black px-2 py-1 rounded-full text-white flex items-center gap-1 ${ageBadgeColor(game.esrbRating)}`}>
              <User size={10} strokeWidth={2.5} />
              {esrbToAge(game.esrbRating)}
            </span>
          )}
        </div>

        {/* Bottom overlay — title + dev/year + genre tags */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white leading-tight drop-shadow mb-1">
            {game.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {game.developer && (
              <span className="text-xs font-semibold text-white/80">{game.developer}</span>
            )}
            {game.developer && (game.releaseDate || game.genres.length > 0) && (
              <span className="text-white/40 text-xs">|</span>
            )}
            {game.releaseDate && (
              <span className="text-xs font-semibold text-white/70">{new Date(game.releaseDate).getFullYear()}</span>
            )}
            {game.genres.slice(0, 3).map((g) => (
              <span key={g} className="text-xs font-semibold text-white/70 bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-sm">
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. SCORE CARD — ring + verdict + share ──────────────────────────────── */}
      {hasReview && scores.curascore != null ? (() => {
        const verdict = getVerdict(scores.curascore)
        return (
          <div className="bg-white rounded-3xl shadow-sm px-6 pt-5 pb-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">{t('curascore')}</p>

            {/* Horseshoe ring */}
            <div className="flex justify-center mb-3">
              <HorseshoeRing score={scores.curascore} />
            </div>

            {/* Verdict badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-wide mb-3 ${verdict.bg} ${verdict.color}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: verdict.ring }} />
              {verdict.label}
            </div>

            {/* Executive summary */}
            {scores.executiveSummary && (
              <p className="text-sm text-slate-600 leading-snug mb-4 max-w-xs mx-auto">
                {scores.executiveSummary}
              </p>
            )}

            {/* min/day */}
            {scores.timeRecommendationMinutes != null && (
              <div className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 bg-slate-50 px-4 py-2 rounded-full mb-4">
                <Clock size={14} strokeWidth={2.5} className="text-emerald-500" />
                {scores.timeRecommendationMinutes >= 120 ? '120+' : scores.timeRecommendationMinutes} min/day recommended
              </div>
            )}

            {/* Share button */}
            <div className="flex justify-center mt-1">
              <ShareButton data={{ game, scores, review, darkPatterns, compliance }} />
            </div>

            {scores.debateRounds != null && (
              <div className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 text-xs font-semibold text-violet-700">
                <span>⚖️</span>
                {t('adversarialDebate', { rounds: scores.debateRounds ?? 0 })}
              </div>
            )}
          </div>
        )
      })() : (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 text-center">
          <p className="text-sm font-semibold text-slate-400">{t('ratingPending')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('ratingPendingSub')}</p>
        </div>
      )}

      {/* ── 3. TWO PILLARS ─────────────────────────────────────────────────────── */}
      {hasReview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Growth Value */}
          <div className="bg-green-50 rounded-3xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-200 rounded-xl flex items-center justify-center">
                <Sparkles size={16} className="text-green-700" strokeWidth={2.5} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-green-700">{t('growth')}</p>
            </div>
            <p className="text-3xl font-black tracking-tighter text-green-900">
              {Math.round((scores.bds ?? 0) * 100)}
              <span className="text-base font-bold text-green-600">/100</span>
            </p>
            <p className="text-xs font-semibold text-green-700 -mt-1">{t('growthValue')}</p>
            {scores.topBenefits && scores.topBenefits.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {scores.topBenefits.slice(0, 3).map((b) => (
                  <li key={b.skill} className="flex items-center gap-1.5 text-xs text-green-800">
                    <CheckCircle2 size={13} className="text-green-500 shrink-0" strokeWidth={2.5} />
                    {b.skill}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Addictive Hooks */}
          <div className="bg-orange-50 rounded-3xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-200 rounded-xl flex items-center justify-center">
                <Zap size={16} className="text-orange-700" strokeWidth={2.5} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-orange-700">{t('risk')}</p>
            </div>
            {risk && (
              <>
                <p className={`text-3xl font-black tracking-tighter ${risk.color}`}>
                  {t(risk.labelKey)}
                </p>
                <p className="text-xs font-semibold text-orange-700 -mt-1">{t('engagementPatterns')}</p>
              </>
            )}
            <p className="text-xs text-orange-800 leading-snug pt-1">
              {(scores.ris ?? 0) < 0.3
                ? t('risMinimal')
                : (scores.ris ?? 0) < 0.6
                ? t('risSome')
                : t('risNotable')}
            </p>
          </div>

        </div>
      )}

      {/* ── 4. VITALS STRIP ────────────────────────────────────────────────────── */}
      {hasReview && (() => {
        const highFlags = darkPatterns.filter(p => p.severity === 'high')
        const hasCost   = review?.estimatedMonthlyCostLow != null
        const hasChat   = game.hasStrangerChat
        if (!highFlags.length && !hasCost && !hasChat) return null
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl px-5 py-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Heads up</p>
            {highFlags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {highFlags.map(p => (
                  <span key={p.patternId} className="text-xs font-semibold bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">
                    {t(`dp${p.patternId.slice(2)}Label` as Parameters<typeof t>[0])}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-semibold text-amber-900">
              {hasCost && (
                <span>
                  💸 Monthly cost:{' '}
                  {review!.estimatedMonthlyCostLow === 0 && review!.estimatedMonthlyCostHigh === 0
                    ? 'Free'
                    : review!.estimatedMonthlyCostHigh != null
                    ? `$${review!.estimatedMonthlyCostLow}–$${review!.estimatedMonthlyCostHigh}/mo`
                    : `$${review!.estimatedMonthlyCostLow}/mo`}
                </span>
              )}
              {hasChat && (
                <span>💬 Stranger chat enabled</span>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── 5. PARENT TIP ──────────────────────────────────────────────────────── */}
      {review?.parentTip && (
        <div className="bg-blue-50 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-200 rounded-xl flex items-center justify-center">
              <Lightbulb size={16} className="text-blue-700" strokeWidth={2.5} />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-700">{t('parentProTip')}</p>
          </div>
          <p className="text-sm text-blue-900 leading-relaxed">{review.parentTip}</p>
        </div>
      )}

      {/* ── 5. VIRTUAL CURRENCY BANNER ─────────────────────────────────────────── */}
      {darkPatterns.some((p) => p.patternId === 'DP04') && (
        <div className="bg-amber-50 border border-amber-100 rounded-3xl px-5 py-4 text-sm text-amber-900">
          <span className="font-bold">💱 {t('virtualCurrency')}</span>
          {' — '}{t('virtualCurrencySub')}
          {review?.virtualCurrencyName && (
            <span className="block text-xs text-amber-700 mt-0.5">
              {review.virtualCurrencyName}
              {review.virtualCurrencyRate && ` — ${review.virtualCurrencyRate}`}
            </span>
          )}
        </div>
      )}

      {/* ── 6. DETAIL TABS ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="p-2 bg-gray-100 m-3 rounded-2xl flex gap-1">
          {(['benefits', 'risks', 'scores'] as Tab[]).map((tab) => (
            <button key={tab} className={`flex-1 ${tabClass(tab)}`} onClick={() => setActiveTab(tab)}>
              {tab === 'benefits'
              ? t('tabBenefits')
              : tab === 'risks'
              ? t('tabRisks')
              : <><span className="hidden sm:inline">{t('tabFullScores')}</span><span className="sm:hidden">{t('tabScores')}</span></>}
            </button>
          ))}
        </div>

        <div className="px-5 pb-5 min-h-48">
          {!hasReview ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">{t('scoringPending')}</p>
            </div>
          ) : activeTab === 'benefits' ? (
            <BenefitsTab scores={scores} review={review} t={t} />
          ) : activeTab === 'risks' ? (
            <RisksTab scores={scores} game={game} review={review} darkPatterns={darkPatterns} t={t} />
          ) : (
            <FullScoresTab scores={scores} review={review} t={t} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
          <span>
            <span className="font-semibold text-slate-600">{t('base')}: </span>
            {game.basePrice != null ? `$${game.basePrice.toFixed(2)}` : t('baseUnknown')}
          </span>
          {review?.estimatedMonthlyCostLow != null && (
            <span>
              <span className="font-semibold text-slate-600">{t('monthly')}: </span>
              {review.estimatedMonthlyCostLow === 0 && review.estimatedMonthlyCostHigh === 0
                ? t('free')
                : review.estimatedMonthlyCostHigh != null
                ? `$${review.estimatedMonthlyCostLow}–$${review.estimatedMonthlyCostHigh}/mo`
                : `$${review.estimatedMonthlyCostLow}/mo`}
            </span>
          )}
          {game.avgPlaytimeHours != null && game.avgPlaytimeHours > 0 && (
            <span>
              <span className="font-semibold text-slate-600">{t('playtime')}: </span>~{game.avgPlaytimeHours}h
            </span>
          )}
          <span className="ml-auto">
            {scores?.calculatedAt
              ? `${t('reviewed')} ${new Date(scores.calculatedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
              : game.updatedAt
              ? `${t('updated')} ${new Date(game.updatedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
              : null}
          </span>
        </div>
      </div>

      {/* ── 7. DEBATE TRANSCRIPT ───────────────────────────────────────────────── */}
      {scores?.debateTranscript && (
        <details className="group bg-violet-50 border border-violet-100 rounded-2xl overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none">
            <div className="flex items-center gap-2">
              <span className="text-violet-600">⚖️</span>
              <span className="text-sm font-semibold text-violet-800">{t('debateTitle')}</span>
            </div>
            <span className="text-xs text-violet-500 group-open:hidden">{t('debateShow')}</span>
            <span className="text-xs text-violet-500 hidden group-open:inline">{t('debateHide')}</span>
          </summary>
          <div className="px-5 pb-5 pt-1">
            <p className="text-xs text-violet-600 mb-3 leading-relaxed">
              Two AI models debated this score in {scores.debateRounds} round{scores.debateRounds !== 1 ? 's' : ''}:
              an <strong>Advocate</strong> arguing for the highest defensible scores,
              and a <strong>Critic</strong> arguing for the lowest. The final score averages their round-2 positions.
            </p>
            <pre className="text-xs text-slate-600 bg-white border border-violet-100 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
              {scores.debateTranscript}
            </pre>
          </div>
        </details>
      )}

      {/* ── 8. COMPLIANCE ──────────────────────────────────────────────────────── */}
      <ComplianceBadges compliance={compliance} />

      {/* ── 9. COMPARE CTA ─────────────────────────────────────────────────────── */}
      <Link
        href={`/${locale}/compare?a=${game.slug}`}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 text-sm font-semibold hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
      >
        <GitCompareArrows size={15} strokeWidth={2.5} />
        {t('compareThis')}
      </Link>

    </div>
  )
}
