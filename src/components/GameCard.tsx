'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { Lightbulb, Sparkles, Zap, Clock, User, GitCompareArrows, AlertTriangle } from 'lucide-react'
import type { DarkPattern, GameCardProps, SerializedReview, SerializedScores } from '@/types/game'
import { Tooltip } from './Tooltip'
import { esrbToAge, ageBadgeColor } from '@/lib/ui'
import DarkPatternPills from './DarkPatternPills'
import ComplianceBadges from './ComplianceBadges'
import ShareButton from './ShareCard'
import { LumiScoreHero } from './LumiScoreHero'
import { ScoreMetaLine } from './ScoreMetaLine'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Risk bar colors — gul/orange/röd skala ───────────────────────────────────
function riskBarColor(value: number | null): string {
  const v = value ?? 0
  if (v < 0.3) return 'bg-emerald-400'
  if (v < 0.6) return 'bg-amber-400'
  return 'bg-red-600'
}

// ─── Risk level pills — gul/orange/röd skala ─────────────────────────────────
function riskLevel(value: number | null): { labelKey: 'riskLow' | 'riskModerate' | 'riskHigh'; color: string; bg: string } {
  const v = value ?? 0
  if (v < 0.3) return {
    labelKey: 'riskLow',
    color: 'text-emerald-800 dark:text-emerald-200',
    bg:    'bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700',
  }
  if (v < 0.6) return {
    labelKey: 'riskModerate',
    color: 'text-amber-800 dark:text-amber-200',
    bg:    'bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-600',
  }
  return {
    labelKey: 'riskHigh',
    color: 'text-red-800 dark:text-red-200',
    bg:    'bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-600',
  }
}

// ─── BDS verdict — higher is better ─────────────────────────────────────────
function bdsVerdict(value: number | null): { labelKey: 'bdsStrong' | 'bdsGood' | 'bdsDeveloping' | 'bdsLimited'; color: string } {
  const v = value ?? 0
  if (v >= 0.70) return { labelKey: 'bdsStrong',     color: 'text-emerald-700 dark:text-emerald-400' }
  if (v >= 0.50) return { labelKey: 'bdsGood',       color: 'text-teal-700 dark:text-teal-400' }
  if (v >= 0.35) return { labelKey: 'bdsDeveloping', color: 'text-amber-700 dark:text-amber-400' }
  return              { labelKey: 'bdsLimited',   color: 'text-slate-500 dark:text-slate-400' }
}

// ─── Bar colors ───────────────────────────────────────────────────────────────

// Benefit bars — emerald scale, higher = better
function benefitBarColor(value: number | null): string {
  const v = value ?? 0
  if (v >= 0.7) return 'bg-emerald-400'
  if (v >= 0.4) return 'bg-emerald-300'
  return 'bg-slate-300 dark:bg-slate-600'
}

// Risk detail bars — gul/orange/röd, högre = sämre
function riskDetailBarColor(value: number, max: number): string {
  const fraction = value / max
  if (fraction >= 0.67) return 'bg-red-600'
  if (fraction >= 0.34) return 'bg-orange-500'
  return 'bg-yellow-400'
}

type StatusVerdict = { labelKey: string; color: string; bg: string; ring: string }
function getVerdict(score: number | null): StatusVerdict {
  const s = score ?? 0
  if (s >= 70) return { labelKey: 'verdictGreat',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30',  ring: '#10b981' }
  if (s >= 50) return { labelKey: 'verdictGood',    color: 'text-teal-600 dark:text-teal-400',       bg: 'bg-teal-50 dark:bg-teal-900/30',        ring: '#14b8a6' }
  if (s >= 35) return { labelKey: 'verdictCaution', color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/30',      ring: '#f59e0b' }
  return              { labelKey: 'verdictAvoid',   color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-900/30',          ring: '#ef4444' }
}

// ─── topBenefits skill → i18n key map ────────────────────────────────────────

const SKILL_KEY_MAP: Record<string, string> = {
  'Problem Solving':       'fieldProblemSolving',
  'Spatial Awareness':     'fieldSpatialAwareness',
  'Strategic Thinking':    'fieldStrategicThinking',
  'Critical Thinking':     'fieldCriticalThinking',
  'Memory & Attention':    'fieldMemoryAttention',
  'Creativity':            'fieldCreativity',
  'Reading & Language':    'fieldReadingLanguage',
  'Math & Systems':        'fieldMathSystems',
  'Learning Transfer':     'fieldLearningTransfer',
  'Adaptive Challenge':    'fieldAdaptiveChallenge',
  'Teamwork':              'fieldTeamwork',
  'Communication':         'fieldCommunication',
  'Empathy':               'fieldEmpathy',
  'Emotional Regulation':  'fieldEmotionalRegulation',
  'Ethical Reasoning':     'fieldEthicalReasoning',
  'Positive Social':       'fieldPositiveSocial',
  'Hand-Eye Coordination': 'fieldHandEye',
  'Fine Motor':            'fieldFineMotor',
  'Reaction Time':         'fieldReactionTime',
  'Physical Activity':     'fieldPhysicalActivity',
}

// ─── Risk flag pill colors ────────────────────────────────────────────────────

const RISK_FLAG_COLORS: Record<string, string> = {
  'flagLootBoxes':       'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700',
  'flagBattlePass':      'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700',
  'flagInAppPurchases':  'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-700',
  'flagSubscription':    'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-700',
  'flagStrangerChat':    'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700',
}

function riskFlagClass(flagKey: string): string {
  return RISK_FLAG_COLORS[flagKey] ?? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-700'
}


// ─── Shared small components ──────────────────────────────────────────────────

function SkillDots({ score, max = 5 }: { score: number | null; max?: number }) {
  const filled = Math.round(score ?? 0)
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < filled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
      ))}
    </span>
  )
}

function CategoryBar({ label, value, tooltip }: { label: string; value: number | null; tooltip?: string }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="w-28 sm:w-36 text-xs sm:text-sm text-slate-600 dark:text-slate-300 shrink-0 flex items-center">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </span>
      <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${benefitBarColor(value)}`} style={{ width: pct(value) }} />
      </div>
      <span className="w-8 sm:w-10 text-right text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0">
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
        <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center min-w-0">
          {label}
          {tooltip && <Tooltip text={tooltip} />}
        </span>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${level.bg} ${level.color}`}>
          {tGC(level.labelKey)}
        </span>
      </div>
      <div className="bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${riskBarColor(value)}`} style={{ width: pct(value) }} />
      </div>
      {note && <p className="text-xs text-slate-500 dark:text-slate-400">{note}</p>}
    </div>
  )
}

// ─── DetailRow — två varianter: benefit och risk ──────────────────────────────

function BenefitDetailRow({ label, score, max }: { label: string; score: number | null; max: number }) {
  const value = score ?? 0
  const fraction = value / max
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex-1 text-xs text-slate-600 dark:text-slate-400 min-w-0">{label}</span>
      <div className="w-16 sm:w-28 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${benefitBarColor(fraction)}`} style={{ width: `${(fraction * 100).toFixed(0)}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">{value}/{max}</span>
    </div>
  )
}

function RiskDetailRow({ label, score, max }: { label: string; score: number | null; max: number }) {
  const value = score ?? 0
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex-1 text-xs text-slate-600 dark:text-slate-400 min-w-0">{label}</span>
      <div className="w-16 sm:w-28 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full ${riskDetailBarColor(value, max)}`}
          style={{ width: `${((value / max) * 100).toFixed(0)}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">{value}/{max}</span>
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
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t('topSkillsDeveloped')}</h3>
          <div className="space-y-2">
            {scores.topBenefits.map((b) => (
              <div key={b.skill} className="flex items-center gap-2">
                <span className="w-32 sm:w-44 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0">
                  {SKILL_KEY_MAP[b.skill] ? t(SKILL_KEY_MAP[b.skill] as Parameters<T>[0]) : b.skill}
                </span>
                <SkillDots score={b.score} max={b.maxScore} />
                <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">{b.score}/{b.maxScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t('developmentAreas')}</h3>
        <div className="space-y-3">
          <CategoryBar label={t('cognitive')}       value={scores.cognitiveScore}       tooltip={t('tooltipCognitive')} />
          <CategoryBar label={t('socialEmotional')} value={scores.socialEmotionalScore} tooltip={t('tooltipSocialEmotional')} />
          <CategoryBar label={t('motorSkills')}     value={scores.motorScore}           tooltip={t('tooltipMotor')} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">{t('overallBds')}</span>
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{Math.round((scores.bds ?? 0) * 100)}/100</span>
        </div>
      </div>

      {review?.benefitsNarrative && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1">{t('whatChildDevelops')}</h3>
          <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">{review.benefitsNarrative}</p>
        </div>
      )}
    </div>
  )
}

function RisksTab({ scores, game, review, darkPatterns, t }: {
  scores: SerializedScores; game: GameCardProps['game']
  review: SerializedReview | null; darkPatterns: DarkPattern[]; t: T
}) {
  const flagDefs: { key: string; label: string; colorClass: string }[] = [
    game.hasLootBoxes         ? { key: 'flagLootBoxes',      label: t('flagLootBoxes'),      colorClass: riskFlagClass('flagLootBoxes')      } : null,
    game.hasBattlePass        ? { key: 'flagBattlePass',     label: t('flagBattlePass'),     colorClass: riskFlagClass('flagBattlePass')     } : null,
    game.hasMicrotransactions ? { key: 'flagInAppPurchases', label: t('flagInAppPurchases'), colorClass: riskFlagClass('flagInAppPurchases') } : null,
    game.hasSubscription      ? { key: 'flagSubscription',   label: t('flagSubscription'),   colorClass: riskFlagClass('flagSubscription')   } : null,
    game.hasStrangerChat      ? { key: 'flagStrangerChat',   label: t('flagStrangerChat'),   colorClass: riskFlagClass('flagStrangerChat')   } : null,
  ].filter(Boolean) as { key: string; label: string; colorClass: string }[]

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <RiskMeter label={t('dopamineManipulation')} value={scores.dopamineRisk}     note={t('riskNotesDopamine')}     tooltip={t('tooltipDopamine')} />
        <RiskMeter label={t('monetizationPressure')} value={scores.monetizationRisk} note={t('riskNotesMonetization')} tooltip={t('tooltipMonetization')} />
        <RiskMeter label={t('socialRisk')}           value={scores.socialRisk}       note={t('riskNotesSocial')}       tooltip={t('tooltipSocialRisk')} />
        <div>
          <RiskMeter label={t('contentRisk')} value={scores.contentRisk} note={t('riskNotesContent')} tooltip={t('tooltipContent')} />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('contentRiskNote')}</p>
        </div>
      </div>

      {flagDefs.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-5 border border-red-100 dark:border-red-800">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={14} className="shrink-0" strokeWidth={2.5} />
            {t('flags')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {flagDefs.map((f) => (
              <span key={f.key} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${f.colorClass}`}>
                {f.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {review?.propagandaLevel != null && review.propagandaLevel > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1 flex items-center gap-1.5">
            {t('ideologicalContent')}
            <Tooltip text={t('tooltipIdeological')} />
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
              review.propagandaLevel === 1 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400' :
              review.propagandaLevel === 2 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400' :
              'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
            }`}>
              {review.propagandaLevel === 1 ? t('propagandaMild') : review.propagandaLevel === 2 ? t('propagandaNotable') : t('propagandaHeavy')}
            </span>
          </h3>
          {review.propagandaNotes && (
            <p className="text-xs text-yellow-800 dark:text-yellow-300 leading-relaxed">{review.propagandaNotes}</p>
          )}
        </div>
      )}

      {review?.risksNarrative && (
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">{t('whatToWatch')}</h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{review.risksNarrative}</p>
        </div>
      )}

      <DarkPatternPills patterns={darkPatterns} />

      {darkPatterns.some((p) => p.patternId === 'DP05') && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-3 text-sm text-purple-900 dark:text-purple-200">
          {t('dp05Message')}
        </div>
      )}
    </div>
  )
}

function FullScoresTab({ scores, review, t, metaLine }: { scores: SerializedScores; review: SerializedReview | null; t: T; metaLine?: ReactNode }) {
  const [expanded, setExpanded] = useState(false)

  if (!review) return <p className="text-sm text-slate-400 dark:text-slate-500">{t('noReviewData')}</p>

  return (
    <div className="space-y-6">
      {metaLine && (
        <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
          {metaLine}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-emerald-800 dark:text-emerald-300">
          <p className="text-xs font-semibold mb-0.5">{t('bdsLabel')}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-snug">{t('bdsFormula')}</p>
          <p className="text-lg font-black mt-1">{Math.round((scores.bds ?? 0) * 100)}<span className="text-xs font-semibold">/100</span></p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-red-800 dark:text-red-300">
          <p className="text-xs font-semibold mb-0.5">{t('risLabel')}</p>
          <p className="text-xs text-red-600 dark:text-red-400 leading-snug">{t('risFormula')}</p>
          <p className="text-lg font-black mt-1">{Math.round((scores.ris ?? 0) * 100)}<span className="text-xs font-semibold">/100</span></p>
        </div>
      </div>

      {review.bechdelResult != null && (
        <div className={`flex items-start gap-3 rounded-2xl p-4 ${
          review.bechdelResult === 'pass' ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800' : 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
        }`}>
          <span className="text-base leading-none mt-0.5">♀</span>
          <div>
            <p className={`text-xs font-semibold flex items-center gap-1 ${review.bechdelResult === 'pass' ? 'text-violet-800 dark:text-violet-300' : 'text-purple-600 dark:text-purple-400'}`}>
              {t('bechdelTitle')}
              <Tooltip text={t('bechdelTooltip')} />
              <span className={`ml-1 font-normal ${review.bechdelResult === 'pass' ? 'text-violet-700 dark:text-violet-400' : 'text-purple-500 dark:text-purple-500'}`}>
                — {review.bechdelResult === 'pass' ? t('bechdelPass') : review.bechdelResult === 'na' ? t('bechdelNa') : t('bechdelFail')}
              </span>
            </p>
            {review.bechdelNotes && (
              <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5 leading-relaxed">{review.bechdelNotes}</p>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors py-1 border border-dashed border-indigo-200 dark:border-indigo-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500"
      >
        {expanded ? t('hideItemScores') : t('expandItemScores')}
      </button>

      {expanded && (
      <>
      {/* ── BENEFIT SCORES ── */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('benefitScoresHeader')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8">
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">{t('b1Cognitive')}</p>
            <BenefitDetailRow label={t('fieldProblemSolving')}    score={review.problemSolving}    max={5} />
            <BenefitDetailRow label={t('fieldSpatialAwareness')}  score={review.spatialAwareness}  max={5} />
            <BenefitDetailRow label={t('fieldStrategicThinking')} score={review.strategicThinking} max={5} />
            <BenefitDetailRow label={t('fieldCriticalThinking')}  score={review.criticalThinking}  max={5} />
            <BenefitDetailRow label={t('fieldMemoryAttention')}   score={review.memoryAttention}   max={5} />
            <BenefitDetailRow label={t('fieldCreativity')}        score={review.creativity}        max={5} />
            <BenefitDetailRow label={t('fieldReadingLanguage')}   score={review.readingLanguage}   max={5} />
            <BenefitDetailRow label={t('fieldMathSystems')}       score={review.mathSystems}       max={5} />
            <BenefitDetailRow label={t('fieldLearningTransfer')}  score={review.learningTransfer}  max={5} />
            <BenefitDetailRow label={t('fieldAdaptiveChallenge')} score={review.adaptiveChallenge} max={5} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">{t('b2Social')}</p>
            <BenefitDetailRow label={t('fieldTeamwork')}             score={review.teamwork}            max={5} />
            <BenefitDetailRow label={t('fieldCommunication')}        score={review.communication}       max={5} />
            <BenefitDetailRow label={t('fieldEmpathy')}              score={review.empathy}             max={5} />
            <BenefitDetailRow label={t('fieldEmotionalRegulation')}  score={review.emotionalRegulation} max={5} />
            <BenefitDetailRow label={t('fieldEthicalReasoning')}     score={review.ethicalReasoning}    max={5} />
            <BenefitDetailRow label={t('fieldPositiveSocial')}       score={review.positiveSocial}      max={5} />
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-3 mb-1">{t('b3Motor')}</p>
            <BenefitDetailRow label={t('fieldHandEye')}          score={review.handEyeCoord}     max={5} />
            <BenefitDetailRow label={t('fieldFineMotor')}        score={review.fineMotor}         max={5} />
            <BenefitDetailRow label={t('fieldReactionTime')}     score={review.reactionTime}      max={5} />
            <BenefitDetailRow label={t('fieldPhysicalActivity')} score={review.physicalActivity}  max={5} />
          </div>
        </div>
        <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-300">
          <span className="font-semibold">BDS</span> = {t('bdsFormula')}{' = '}
          <span className="font-semibold">{Math.round((scores.bds ?? 0) * 100)}/100</span>
        </div>
      </div>

      {/* ── RISK SCORES — gul/orange/röd ── */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('riskScoresHeader')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8">
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">{t('r1Dopamine')}</p>
            <RiskDetailRow label={t('fieldVariableRewards')}      score={review.variableRewards}      max={3} />
            <RiskDetailRow label={t('fieldStreakMechanics')}      score={review.streakMechanics}      max={3} />
            <RiskDetailRow label={t('fieldLossAversion')}         score={review.lossAversion}         max={3} />
            <RiskDetailRow label={t('fieldFomoEvents')}           score={review.fomoEvents}           max={3} />
            <RiskDetailRow label={t('fieldStoppingBarriers')}     score={review.stoppingBarriers}     max={3} />
            <RiskDetailRow label={t('fieldNotifications')}        score={review.notifications}        max={3} />
            <RiskDetailRow label={t('fieldNearMiss')}             score={review.nearMiss}             max={3} />
            <RiskDetailRow label={t('fieldInfinitePlay')}         score={review.infinitePlay}         max={3} />
            <RiskDetailRow label={t('fieldEscalatingCommitment')} score={review.escalatingCommitment} max={3} />
            <RiskDetailRow label={t('fieldRewardFrequency')}      score={review.variableRewardFreq}   max={3} />
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-3 mb-1">{t('r2Monetization')}</p>
            <RiskDetailRow label={t('fieldSpendingCeiling')}      score={review.spendingCeiling}      max={3} />
            <RiskDetailRow label={t('fieldPayToWin')}             score={review.payToWin}             max={3} />
            <RiskDetailRow label={t('fieldCurrencyObfuscation')}  score={review.currencyObfuscation}  max={3} />
            <RiskDetailRow label={t('fieldSpendingPrompts')}      score={review.spendingPrompts}      max={3} />
            <RiskDetailRow label={t('fieldChildTargeting')}       score={review.childTargeting}       max={3} />
            <RiskDetailRow label={t('fieldAdPressure')}           score={review.adPressure}           max={3} />
            <RiskDetailRow label={t('fieldSubscriptionPressure')} score={review.subscriptionPressure} max={3} />
            <RiskDetailRow label={t('fieldSocialSpending')}       score={review.socialSpending}       max={3} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">{t('r3Social')}</p>
            <RiskDetailRow label={t('fieldSocialObligation')}    score={review.socialObligation}    max={3} />
            <RiskDetailRow label={t('fieldCompetitiveToxicity')} score={review.competitiveToxicity} max={3} />
            <RiskDetailRow label={t('fieldStrangerRisk')}        score={review.strangerRisk}        max={3} />
            <RiskDetailRow label={t('fieldSocialComparison')}    score={review.socialComparison}    max={3} />
            <RiskDetailRow label={t('fieldIdentitySelfWorth')}   score={review.identitySelfWorth}   max={3} />
            <RiskDetailRow label={t('fieldPrivacyRisk')}         score={review.privacyRisk}         max={3} />
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-3 mb-1">{t('r4Content')} {t('displayOnly')}</p>
            <RiskDetailRow label={t('fieldViolenceLevel')}       score={review.violenceLevel}       max={3} />
            <RiskDetailRow label={t('fieldSexualContent')}       score={review.sexualContent}       max={3} />
            <RiskDetailRow label={t('fieldLanguage')}            score={review.language}            max={3} />
            <RiskDetailRow label={t('fieldSubstanceRef')}        score={review.substanceRef}        max={3} />
            <RiskDetailRow label={t('fieldFearHorror')}          score={review.fearHorror}          max={3} />
          </div>
        </div>
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-xs text-red-800 dark:text-red-300">
          <span className="font-semibold">RIS</span> = {t('risFormula')}{' = '}
          <span className="font-semibold">{Math.round((scores.ris ?? 0) * 100)}/100</span>
        </div>
      </div>

      {review && (review.r5CrossPlatform != null || review.r5LoadTime != null) && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
            {t('r5Accessibility')} <span className="normal-case font-normal">{t('displayOnly')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8">
            <div>
              <BenefitDetailRow label={t('fieldCrossPlatform')}   score={review.r5CrossPlatform}   max={3} />
              <BenefitDetailRow label={t('fieldLoadTime')}         score={review.r5LoadTime}         max={3} />
              <BenefitDetailRow label={t('fieldMobileOptimised')}  score={review.r5MobileOptimized}  max={3} />
              <BenefitDetailRow label={t('fieldLoginBarrier')}     score={review.r5LoginBarrier}     max={3} />
            </div>
          </div>
        </div>
      )}

      {review && (review.r6InfiniteGameplay != null || review.r6NoStoppingPoints != null) && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
            {t('r6Endless')} <span className="normal-case font-normal">{t('displayOnly')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8">
            <div>
              <RiskDetailRow label={t('fieldInfiniteGameplay')}    score={review.r6InfiniteGameplay}   max={3} />
              <RiskDetailRow label={t('fieldNoStoppingPoints')}    score={review.r6NoStoppingPoints}   max={3} />
              <RiskDetailRow label={t('fieldNoGameOver')}          score={review.r6NoGameOver}         max={3} />
              <RiskDetailRow label={t('fieldNoChapterStructure')}  score={review.r6NoChapterStructure} max={3} />
            </div>
          </div>
        </div>
      )}

      {review && (review.repGenderBalance != null || review.repEthnicDiversity != null) && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
            {t('repHeader')} <span className="normal-case font-normal">{t('higherIsBetter')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8">
            <div>
              <BenefitDetailRow label={t('fieldGenderBalance')}   score={review.repGenderBalance}   max={3} />
              <BenefitDetailRow label={t('fieldEthnicDiversity')} score={review.repEthnicDiversity} max={3} />
            </div>
          </div>
        </div>
      )}

      {review && review.propagandaLevel != null && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
            {t('propHeader')} <span className="normal-case font-normal">{t('displayOnly')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8">
            <div>
              <RiskDetailRow label={t('fieldPropagandaLevel')} score={review.propagandaLevel} max={3} />
              {review.propagandaNotes && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">{review.propagandaNotes}</p>
              )}
            </div>
          </div>
        </div>
      )}
      </>
      )}
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
  const risk    = hasReview ? riskLevel(scores.ris)   : null
  const bdsVerd = hasReview ? bdsVerdict(scores.bds)  : null

  const tabClass = (tab: Tab) =>
    `px-4 py-2.5 text-sm font-semibold tracking-tight transition-colors rounded-xl ${
      activeTab === tab
        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
    }`

  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-3xl p-5 space-y-4">

      {/* ── 1. HERO IMAGE ──────────────────────────────────────────────────────── */}
      <div className="rounded-3xl overflow-hidden relative">
        {game.backgroundImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.backgroundImage} alt="" className="w-full h-52 object-cover" />
        ) : (
          <div className={`h-52 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-7xl font-black text-white/20 select-none">{abbr}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

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

      {/* ── 2. LUMISCORE HERO ────────────────────────────────────────────────────── */}
      {hasReview && scores.curascore != null ? (
        <LumiScoreHero
          curascore={scores.curascore}
          recommendedMinAge={scores.recommendedMinAge}
          esrbRating={game.esrbRating}
          pegiRating={game.pegiRating}
          executiveSummary={scores.executiveSummary}
          action={<ShareButton data={{ game, scores, review, darkPatterns, compliance }} />}
        >
          {scores.timeRecommendationMinutes != null && (
            <div className="flex items-center justify-center gap-2">
              <Clock size={20} strokeWidth={2.5} className="text-emerald-500 shrink-0" />
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
                {scores.timeRecommendationMinutes}
              </span>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                {t('minDayRecommended')}
              </span>
            </div>
          )}
          {scores.debateRounds != null && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 text-xs font-semibold text-violet-700 dark:text-violet-300">
              <span>⚖️</span>
              {t('adversarialDebate', { rounds: scores.debateRounds ?? 0 })}
            </div>
          )}
        </LumiScoreHero>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl p-6 text-center">
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{t('ratingPending')}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('ratingPendingSub')}</p>
        </div>
      )}

      {/* ── 2b. VITALS STRIP — flags / cost / stranger chat ──────────────────────── */}
      {hasReview && (() => {
        const highFlags = darkPatterns.filter(p => p.severity === 'high')
        const hasCost   = review?.estimatedMonthlyCostLow != null
        const hasChat   = game.hasStrangerChat
        if (!highFlags.length && !hasCost && !hasChat) return null
        return (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl px-5 py-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">{t('headsUp')}</p>
            {highFlags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {highFlags.map(p => (
                  <span key={p.patternId} className="text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 px-2.5 py-1 rounded-full">
                    {t(`dp${p.patternId.slice(2)}Label` as Parameters<typeof t>[0])}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-semibold text-amber-900 dark:text-amber-300">
              {hasCost && (
                <span>
                  💸 {t('monthlyCost')}:{' '}
                  {review!.estimatedMonthlyCostLow === 0 && review!.estimatedMonthlyCostHigh === 0
                    ? t('free')
                    : review!.estimatedMonthlyCostHigh != null
                    ? `$${review!.estimatedMonthlyCostLow}–$${review!.estimatedMonthlyCostHigh}/mo`
                    : `$${review!.estimatedMonthlyCostLow}/mo`}
                </span>
              )}
              {hasChat && (
                <span>💬 {t('strangerChatEnabled')}</span>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── 3. TWO PILLARS ─────────────────────────────────────────────────────── */}
      {hasReview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Growth Value */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-3xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-200 dark:bg-green-800 rounded-xl flex items-center justify-center">
                <Sparkles size={16} className="text-green-700 dark:text-green-300" strokeWidth={2.5} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-green-700 dark:text-green-400">{t('growth')}</p>
            </div>
            <p className="text-3xl font-black tracking-tighter text-green-900 dark:text-green-200">
              {Math.round((scores.bds ?? 0) * 100)}
              <span className="text-base font-bold text-green-600 dark:text-green-400">/100</span>
            </p>
            {bdsVerd && <p className={`text-sm font-bold -mt-1 ${bdsVerd.color}`}>{t(bdsVerd.labelKey)}</p>}
            <p className="text-xs font-semibold text-green-700 dark:text-green-400">{t('growthValue')}</p>
          </div>

          {/* Addictive Hooks */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-3xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-200 dark:bg-orange-800 rounded-xl flex items-center justify-center">
                <Zap size={16} className="text-orange-700 dark:text-orange-300" strokeWidth={2.5} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-orange-700 dark:text-orange-400">{t('risk')}</p>
            </div>
            {risk && (
              <>
                <p className="text-3xl font-black tracking-tighter text-orange-900 dark:text-orange-200">
                  {Math.round((scores.ris ?? 0) * 100)}
                  <span className="text-base font-bold text-orange-600 dark:text-orange-400">/100</span>
                </p>
                <p className={`text-sm font-bold -mt-1 ${risk.color}`}>{t(risk.labelKey)}</p>
              </>
            )}
            <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">{t('engagementPatterns')}</p>
          </div>
        </div>
      )}

      {/* ── 4. PARENT TIP ──────────────────────────────────────────────────────── */}
      {review?.parentTip && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-200 dark:bg-blue-800 rounded-xl flex items-center justify-center">
              <Lightbulb size={16} className="text-blue-700 dark:text-blue-300" strokeWidth={2.5} />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">{t('parentProTip')}</p>
          </div>
          <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed">{review.parentTip}</p>
        </div>
      )}

      {/* ── METHODOLOGY LINK ─────────────────────────────────────────────────────── */}
      <div className="text-center">
        <Link href={`/${locale}/methodology`} className="text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">
          {t('howScoresCalculated')} →
        </Link>
      </div>

      {/* ── BUNDLED ONLINE WARNING ─────────────────────────────────────────────── */}
      {game.bundledOnlineNote && (
        <div className="rounded-2xl border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/60 px-5 py-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0" strokeWidth={2.5} />
            <p className="text-xs font-black uppercase tracking-widest text-red-700 dark:text-red-400">
              Bundled online mode — additional risk
            </p>
          </div>
          <p className="text-sm text-red-900 dark:text-red-200 leading-relaxed">
            <strong>The LumiScore above reflects the single-player campaign only.</strong>{' '}
            {game.bundledOnlineNote}
          </p>
        </div>
      )}

      {/* ── VIRTUAL CURRENCY BANNER ─────────────────────────────────────────── */}
      {darkPatterns.some((p) => p.patternId === 'DP04') && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-3xl px-5 py-4 text-sm text-amber-900 dark:text-amber-300">
          <span className="font-bold">💱 {t('virtualCurrency')}</span>
          {' — '}{t('virtualCurrencySub')}
          {review?.virtualCurrencyName && (
            <span className="block text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              {review.virtualCurrencyName}
              {review.virtualCurrencyRate && ` — ${review.virtualCurrencyRate}`}
            </span>
          )}
        </div>
      )}

      {/* ── 6. DETAIL TABS ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700">
        <div className="p-2 bg-gray-100 dark:bg-slate-700 m-3 rounded-2xl flex gap-1" role="tablist">
          {(['benefits', 'risks', 'scores'] as Tab[]).map((tab) => (
            <button key={tab} className={`flex-1 ${tabClass(tab)}`} onClick={() => setActiveTab(tab)} role="tab" aria-selected={activeTab === tab}>
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
              <p className="text-slate-400 dark:text-slate-500 text-sm">{t('scoringPending')}</p>
            </div>
          ) : activeTab === 'benefits' ? (
            <BenefitsTab scores={scores} review={review} t={t} />
          ) : activeTab === 'risks' ? (
            <RisksTab scores={scores} game={game} review={review} darkPatterns={darkPatterns} t={t} />
          ) : (
            <FullScoresTab
              scores={scores}
              review={review}
              t={t}
              metaLine={scores?.calculatedAt ? (
                <ScoreMetaLine
                  calculatedAt={scores.calculatedAt}
                  methodologyVersion={scores.methodologyVersion}
                  scoringMethod={scores.scoringMethod}
                  updatedAt={game.updatedAt}
                  locale={locale}
                />
              ) : undefined}
            />
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-slate-700 px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
          <span>
            <span className="font-semibold text-slate-600 dark:text-slate-300">{t('base')}: </span>
            {game.basePrice != null ? `$${game.basePrice.toFixed(2)}` : t('baseUnknown')}
          </span>
          {game.avgPlaytimeHours != null && game.avgPlaytimeHours > 0 && (
            <span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">{t('playtime')}: </span>~{game.avgPlaytimeHours}h
            </span>
          )}
          <span className="ml-auto">
            {scores?.calculatedAt
              ? `${t('reviewed')} ${new Date(scores.calculatedAt).toLocaleDateString(locale, { month: 'short', year: 'numeric' })}`
              : game.updatedAt
              ? `${t('updated')} ${new Date(game.updatedAt).toLocaleDateString(locale, { month: 'short', year: 'numeric' })}`
              : null}
          </span>
        </div>
      </div>

      {/* ── 7. DEBATE TRANSCRIPT ───────────────────────────────────────────────── */}
      {scores?.debateTranscript && (
        <details className="group bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-2xl overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none">
            <div className="flex items-center gap-2">
              <span className="text-violet-600 dark:text-violet-400">⚖️</span>
              <span className="text-sm font-semibold text-violet-800 dark:text-violet-300">{t('debateTitle')}</span>
            </div>
            <span className="text-xs text-violet-500 dark:text-violet-400 group-open:hidden">{t('debateShow')}</span>
            <span className="text-xs text-violet-500 dark:text-violet-400 hidden group-open:inline">{t('debateHide')}</span>
          </summary>
          <div className="px-5 pb-5 pt-1">
            <p className="text-xs text-violet-600 dark:text-violet-400 mb-3 leading-relaxed">
              {t('debateDescription', { rounds: scores.debateRounds ?? 0 })}
            </p>
            <pre className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-violet-100 dark:border-violet-800 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
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
        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-sm font-semibold hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
      >
        <GitCompareArrows size={15} strokeWidth={2.5} />
        {t('compareThis')}
      </Link>

    </div>
  )
}
