'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import GameCard from '@/components/GameCard'
import { calculateGameScores } from '@/lib/scoring/engine'
import type { ReviewInput } from '@/lib/scoring/types'
import type { SerializedGame, SerializedScores, SerializedReview, GameCardProps } from '@/types/game'

// ─── Types ────────────────────────────────────────────────────────────────────

type PracticalFields = {
  estimatedMonthlyCostLow:  number | null
  estimatedMonthlyCostHigh: number | null
  minSessionMinutes:        number | null
  hasNaturalStoppingPoints: boolean
  penalizesBreaks:          boolean
  stoppingPointsDescription:string
  benefitsNarrative:        string
  risksNarrative:           string
  parentTip:                string
}

type FormState = ReviewInput & PracticalFields

// ─── Slider component ─────────────────────────────────────────────────────────

const BENEFIT_LABELS = ['None', 'Minimal', 'Some', 'Moderate', 'Strong', 'Exceptional']
const RISK_LABELS    = ['None', 'Mild', 'Moderate', 'Severe']

function ScoreSlider({
  label,
  value,
  max,
  description,
  onChange,
}: {
  label: string
  value: number
  max: 3 | 5
  description?: string
  onChange: (v: number) => void
}) {
  const levelLabel = max === 5 ? BENEFIT_LABELS[value] : RISK_LABELS[value]
  const trackPct   = (value / max) * 100

  const fillColor =
    max === 5
      ? value === 0 ? '#94a3b8' : value <= 2 ? '#60a5fa' : value <= 4 ? '#34d399' : '#10b981'
      : value === 0 ? '#94a3b8' : value === 1 ? '#fbbf24' : value === 2 ? '#f97316' : '#ef4444'

  const labelColor =
    max === 5
      ? value === 0 ? 'text-slate-400' : value <= 2 ? 'text-blue-600' : 'text-emerald-700'
      : value === 0 ? 'text-slate-400' : value === 1 ? 'text-amber-600' : value === 2 ? 'text-orange-600' : 'text-red-600'

  return (
    <div className="group">
      <div className="flex items-center gap-3">
        <div className="w-44 shrink-0">
          <p className="text-sm text-slate-700 leading-tight">{label}</p>
          {description && (
            <p className="text-xs text-slate-400 leading-tight mt-0.5 hidden group-hover:block">{description}</p>
          )}
        </div>
        <div className="flex-1 relative flex items-center">
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{ width: `${trackPct}%`, backgroundColor: fillColor }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={value}
            onChange={e => onChange(parseInt(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
            style={{ margin: 0 }}
          />
        </div>
        <div className="w-28 shrink-0 text-right">
          <span className="text-xs font-bold text-slate-500">{value}/{max}</span>
          {' '}
          <span className={`text-xs font-semibold ${labelColor}`}>{levelLabel}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Section accordion ────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div>
          <span className="font-semibold text-slate-800">{title}</span>
          {subtitle && <span className="text-xs text-slate-500 ml-2">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-2">
          {badge}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && <div className="px-4 py-4 space-y-3 bg-white">{children}</div>}
    </div>
  )
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ value, higherIsBetter = true }: { value: number; higherIsBetter?: boolean }) {
  const pct = Math.round(value * 100)
  const color = higherIsBetter
    ? pct >= 60 ? 'bg-emerald-100 text-emerald-800' : pct >= 30 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
    : pct <= 30 ? 'bg-emerald-100 text-emerald-800' : pct <= 60 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{pct}</span>
}

// ─── Number input ─────────────────────────────────────────────────────────────

function NumInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  placeholder,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  prefix?: string
  suffix?: string
  min?: number
  placeholder?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="w-52 text-sm text-slate-700 shrink-0">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-slate-500">{prefix}</span>}
        <input
          type="number"
          min={min}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
          className="w-24 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSerializedScores(computed: ReturnType<typeof calculateGameScores>): SerializedScores {
  return {
    bds:                       computed.bds,
    ris:                       computed.ris,
    cognitiveScore:            computed.cognitiveScore,
    socialEmotionalScore:      computed.socialEmotionalScore,
    motorScore:                computed.motorScore,
    dopamineRisk:              computed.dopamineRisk,
    monetizationRisk:          computed.monetizationRisk,
    socialRisk:                computed.socialRisk,
    contentRisk:               computed.contentRisk,
    timeRecommendationMinutes: computed.timeRecommendation.minutes,
    timeRecommendationLabel:   computed.timeRecommendation.label,
    timeRecommendationReasoning: computed.timeRecommendation.reasoning,
    timeRecommendationColor:   computed.timeRecommendation.color,
    topBenefits:               computed.topBenefits,
    accessibilityRisk:         null,
    endlessDesignRisk:         null,
    executiveSummary:          null,
    calculatedAt:              null,
  }
}

function makeSerializedReview(form: FormState): SerializedReview {
  return {
    problemSolving: form.problemSolving ?? null,
    spatialAwareness: form.spatialAwareness ?? null,
    strategicThinking: form.strategicThinking ?? null,
    criticalThinking: form.criticalThinking ?? null,
    memoryAttention: form.memoryAttention ?? null,
    creativity: form.creativity ?? null,
    readingLanguage: form.readingLanguage ?? null,
    mathSystems: form.mathSystems ?? null,
    learningTransfer: form.learningTransfer ?? null,
    adaptiveChallenge: form.adaptiveChallenge ?? null,
    teamwork: form.teamwork ?? null,
    communication: form.communication ?? null,
    empathy: form.empathy ?? null,
    emotionalRegulation: form.emotionalRegulation ?? null,
    ethicalReasoning: form.ethicalReasoning ?? null,
    positiveSocial: form.positiveSocial ?? null,
    handEyeCoord: form.handEyeCoord ?? null,
    fineMotor: form.fineMotor ?? null,
    reactionTime: form.reactionTime ?? null,
    physicalActivity: form.physicalActivity ?? null,
    variableRewards: form.variableRewards ?? null,
    streakMechanics: form.streakMechanics ?? null,
    lossAversion: form.lossAversion ?? null,
    fomoEvents: form.fomoEvents ?? null,
    stoppingBarriers: form.stoppingBarriers ?? null,
    notifications: form.notifications ?? null,
    nearMiss: form.nearMiss ?? null,
    infinitePlay: form.infinitePlay ?? null,
    escalatingCommitment: form.escalatingCommitment ?? null,
    variableRewardFreq: form.variableRewardFreq ?? null,
    spendingCeiling: form.spendingCeiling ?? null,
    payToWin: form.payToWin ?? null,
    currencyObfuscation: form.currencyObfuscation ?? null,
    spendingPrompts: form.spendingPrompts ?? null,
    childTargeting: form.childTargeting ?? null,
    adPressure: form.adPressure ?? null,
    subscriptionPressure: form.subscriptionPressure ?? null,
    socialSpending: form.socialSpending ?? null,
    socialObligation: form.socialObligation ?? null,
    competitiveToxicity: form.competitiveToxicity ?? null,
    strangerRisk: form.strangerRisk ?? null,
    socialComparison: form.socialComparison ?? null,
    identitySelfWorth: form.identitySelfWorth ?? null,
    privacyRisk: form.privacyRisk ?? null,
    violenceLevel: form.violenceLevel ?? null,
    sexualContent: form.sexualContent ?? null,
    language: form.language ?? null,
    substanceRef: form.substanceRef ?? null,
    fearHorror: form.fearHorror ?? null,
    estimatedMonthlyCostLow:  form.estimatedMonthlyCostLow,
    estimatedMonthlyCostHigh: form.estimatedMonthlyCostHigh,
    minSessionMinutes:        form.minSessionMinutes,
    hasNaturalStoppingPoints: form.hasNaturalStoppingPoints,
    penalizesBreaks:          form.penalizesBreaks,
    stoppingPointsDescription: form.stoppingPointsDescription || null,
    benefitsNarrative:   form.benefitsNarrative || null,
    risksNarrative:      form.risksNarrative || null,
    parentTip:           form.parentTip || null,
    r5CrossPlatform:      null,
    r5LoadTime:           null,
    r5MobileOptimized:    null,
    r5LoginBarrier:       null,
    r6InfiniteGameplay:   null,
    r6NoStoppingPoints:   null,
    r6NoGameOver:         null,
    r6NoChapterStructure: null,
    usesVirtualCurrency: null,
    virtualCurrencyName: null,
    virtualCurrencyRate: null,
  }
}

const DEFAULT_FORM: FormState = {
  // B1
  problemSolving: 0, spatialAwareness: 0, strategicThinking: 0, criticalThinking: 0,
  memoryAttention: 0, creativity: 0, readingLanguage: 0, mathSystems: 0,
  learningTransfer: 0, adaptiveChallenge: 0,
  // B2
  teamwork: 0, communication: 0, empathy: 0, emotionalRegulation: 0,
  ethicalReasoning: 0, positiveSocial: 0,
  // B3
  handEyeCoord: 0, fineMotor: 0, reactionTime: 0, physicalActivity: 0,
  // R1
  variableRewards: 0, streakMechanics: 0, lossAversion: 0, fomoEvents: 0,
  stoppingBarriers: 0, notifications: 0, nearMiss: 0, infinitePlay: 0,
  escalatingCommitment: 0, variableRewardFreq: 0,
  // R2
  spendingCeiling: 0, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
  childTargeting: 0, adPressure: 0, subscriptionPressure: 0, socialSpending: 0,
  // R3
  socialObligation: 0, competitiveToxicity: 0, strangerRisk: 0,
  socialComparison: 0, identitySelfWorth: 0, privacyRisk: 0,
  // R4
  violenceLevel: 0, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
  // Practical
  estimatedMonthlyCostLow: null, estimatedMonthlyCostHigh: null,
  minSessionMinutes: null, hasNaturalStoppingPoints: true, penalizesBreaks: false,
  stoppingPointsDescription: '', benefitsNarrative: '', risksNarrative: '', parentTip: '',
}

// ─── Main ReviewForm ──────────────────────────────────────────────────────────

type Props = {
  game: SerializedGame
  existingReview?: SerializedReview | null
}

export default function ReviewForm({ game, existingReview }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => {
    if (!existingReview) return { ...DEFAULT_FORM, esrbRating: game.esrbRating }
    return {
      ...DEFAULT_FORM,
      ...existingReview,
      hasNaturalStoppingPoints: existingReview.hasNaturalStoppingPoints ?? true,
      penalizesBreaks: existingReview.penalizesBreaks ?? false,
      stoppingPointsDescription: existingReview.stoppingPointsDescription ?? '',
      benefitsNarrative: existingReview.benefitsNarrative ?? '',
      risksNarrative: existingReview.risksNarrative ?? '',
      parentTip: existingReview.parentTip ?? '',
      esrbRating: game.esrbRating,
    }
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Update a single score field
  const setScore = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
  }, [])

  // Live computed scores — pure calculation, runs synchronously
  const computed = useMemo(() => calculateGameScores({ ...form, esrbRating: game.esrbRating }), [form, game.esrbRating])

  const liveScores: SerializedScores = useMemo(() => makeSerializedScores(computed), [computed])
  const liveReview: SerializedReview = useMemo(() => makeSerializedReview(form), [form])

  const gameCardProps: GameCardProps = useMemo(() => ({
    game,
    scores: liveScores,
    review: liveReview,
    darkPatterns: [],
    compliance: [],
  }), [game, liveScores, liveReview])

  // Submit
  async function handleSubmit(status: 'approved' | 'draft') {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, gameSlug: game.slug, status }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setSaved(true)
      if (status === 'approved') {
        router.push(`/game/${game.slug}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const bPct = Math.round(computed.bds * 100)
  const rPct = Math.round(computed.ris * 100)

  // ── Render ──────────────────────────────────────────────────────────────��─

  return (
    <div className="flex gap-0 lg:gap-6 min-h-screen">

      {/* ─── LEFT: Form ──────────────────────────────���───────────────────────── */}
      <div className="flex-1 min-w-0 pb-24">

        {/* Sticky score summary bar */}
        <div className="sticky top-14 z-30 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">BDS</span>
            <ScoreBadge value={computed.bds} higherIsBetter />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">RIS</span>
            <ScoreBadge value={computed.ris} higherIsBetter={false} />
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
              computed.timeRecommendation.color === 'green' ? 'bg-emerald-600' :
              computed.timeRecommendation.color === 'amber' ? 'bg-amber-500' : 'bg-red-600'
            }`}>
              {computed.timeRecommendation.minutes}m/day
            </div>
          </div>
          {/* Mobile preview toggle */}
          <button
            type="button"
            onClick={() => setPreviewOpen(o => !o)}
            className="ml-auto lg:hidden text-xs text-indigo-600 font-medium border border-indigo-200 px-3 py-1 rounded-lg"
          >
            {previewOpen ? 'Hide preview' : 'Preview card'}
          </button>
        </div>

        {/* Mobile preview panel */}
        {previewOpen && (
          <div className="lg:hidden px-4 py-4 bg-slate-100 border-b border-slate-200">
            <GameCard {...gameCardProps} />
          </div>
        )}

        <div className="px-4 py-6 space-y-4 max-w-2xl">

          {/* ── B1: Cognitive ─────────────────────────────────────────────── */}
          <Section
            title="B1 · Cognitive Skills"
            subtitle="10 items · max 50"
            badge={<ScoreBadge value={computed.cognitiveScore} higherIsBetter />}
          >
            <p className="text-xs text-slate-500 mb-3">
              Rate 0–5: 0 = not present, 5 = exceptional, a primary focus of gameplay
            </p>
            {([
              ['problemSolving',    'Problem Solving',    'Puzzles, logic, overcoming obstacles'],
              ['spatialAwareness',  'Spatial Awareness',  'Navigation, map reading, 3D orientation'],
              ['strategicThinking', 'Strategic Thinking', 'Planning ahead, resource management'],
              ['criticalThinking',  'Critical Thinking',  'Analysing situations, evaluating options'],
              ['memoryAttention',   'Memory & Attention', 'Remembering patterns, sustained focus'],
              ['creativity',        'Creativity',         'Building, designing, self-expression'],
              ['readingLanguage',   'Reading & Language', 'Text comprehension, vocabulary'],
              ['mathSystems',       'Math & Systems',     'Counting, probability, system thinking'],
              ['learningTransfer',  'Learning Transfer',  'Concepts that apply outside the game'],
              ['adaptiveChallenge', 'Adaptive Challenge', 'Difficulty scales with skill level'],
            ] as [keyof FormState, string, string][]).map(([key, label, desc]) => (
              <ScoreSlider
                key={key}
                label={label}
                value={(form[key] as number) ?? 0}
                max={5}
                description={desc}
                onChange={v => setScore(key, v)}
              />
            ))}
          </Section>

          {/* ── B2: Social-Emotional ──────────────────────────────────────── */}
          <Section
            title="B2 · Social-Emotional"
            subtitle="6 items · max 30"
            badge={<ScoreBadge value={computed.socialEmotionalScore} higherIsBetter />}
            defaultOpen={false}
          >
            {([
              ['teamwork',            'Teamwork',              'Requires co-operation with others'],
              ['communication',       'Communication',         'Talking, planning, expressing intent'],
              ['empathy',             'Empathy',               'Understanding characters\' emotions'],
              ['emotionalRegulation', 'Emotional Regulation',  'Managing frustration, patience'],
              ['ethicalReasoning',    'Ethical Reasoning',     'Moral choices, consequences'],
              ['positiveSocial',      'Positive Social',       'Kindness, helping, community'],
            ] as [keyof FormState, string, string][]).map(([key, label, desc]) => (
              <ScoreSlider
                key={key}
                label={label}
                value={(form[key] as number) ?? 0}
                max={5}
                description={desc}
                onChange={v => setScore(key, v)}
              />
            ))}
          </Section>

          {/* ── B3: Motor ─────────────────────────────────────────────────── */}
          <Section
            title="B3 · Motor Skills"
            subtitle="4 items · max 20"
            badge={<ScoreBadge value={computed.motorScore} higherIsBetter />}
            defaultOpen={false}
          >
            {([
              ['handEyeCoord',  'Hand-Eye Coordination', 'Precise timing, aiming, cursor control'],
              ['fineMotor',     'Fine Motor',            'Precise button combos, dexterity'],
              ['reactionTime',  'Reaction Time',         'Fast response to visual/audio cues'],
              ['physicalActivity','Physical Activity',   'Body movement required to play'],
            ] as [keyof FormState, string, string][]).map(([key, label, desc]) => (
              <ScoreSlider
                key={key}
                label={label}
                value={(form[key] as number) ?? 0}
                max={5}
                description={desc}
                onChange={v => setScore(key, v)}
              />
            ))}
          </Section>

          {/* ── R1: Dopamine ──────────────────────────────────────────────── */}
          <Section
            title="R1 · Dopamine Manipulation"
            subtitle="10 items · max 30"
            badge={<ScoreBadge value={computed.dopamineRisk} higherIsBetter={false} />}
            defaultOpen={false}
          >
            <p className="text-xs text-slate-500 mb-3">
              Rate 0–3: 0 = absent, 1 = mild, 2 = moderate, 3 = severe engagement mechanics
            </p>
            {([
              ['variableRewards',     'Variable Rewards',       'Random loot drops, unpredictable outcomes'],
              ['streakMechanics',     'Streak Mechanics',       'Daily streaks, login bonuses, breaking streaks'],
              ['lossAversion',        'Loss Aversion',          'Fear of losing progress, ranked anxiety'],
              ['fomoEvents',          'FOMO Events',            'Limited-time events, disappearing content'],
              ['stoppingBarriers',    'Stopping Barriers',      'Hard to find a safe save point / stopping place'],
              ['notifications',       'Notifications',          'Push notifications, pings to return to game'],
              ['nearMiss',            'Near Miss',              'Almost-won moments that keep players playing'],
              ['infinitePlay',        'Infinite Play',          'No natural endpoint — endless content'],
              ['escalatingCommitment','Escalating Commitment',  'Sunk-cost mechanics, long investment required'],
              ['variableRewardFreq',  'Reward Frequency',       'Frequency and unpredictability of rewards'],
            ] as [keyof FormState, string, string][]).map(([key, label, desc]) => (
              <ScoreSlider
                key={key}
                label={label}
                value={(form[key] as number) ?? 0}
                max={3}
                description={desc}
                onChange={v => setScore(key, v)}
              />
            ))}
          </Section>

          {/* ── R2: Monetization ──────────────────────────────────────────── */}
          <Section
            title="R2 · Monetization Pressure"
            subtitle="8 items · max 24"
            badge={<ScoreBadge value={computed.monetizationRisk} higherIsBetter={false} />}
            defaultOpen={false}
          >
            {([
              ['spendingCeiling',     'Spending Ceiling',       'Is there a realistic spending cap?'],
              ['payToWin',            'Pay-to-Win',             'Money gives gameplay advantage'],
              ['currencyObfuscation', 'Currency Obfuscation',   'Fake currencies masking real cost'],
              ['spendingPrompts',     'Spending Prompts',       'Frequency of upsell / purchase nudges'],
              ['childTargeting',      'Child Targeting',        'Cosmetics, characters designed for children'],
              ['adPressure',          'Ad Pressure',            'Ads that interrupt or reward watching'],
              ['subscriptionPressure','Subscription Pressure',  'Content locked behind subscription'],
              ['socialSpending',      'Social Spending',        'Pressure to spend to keep up with friends'],
            ] as [keyof FormState, string, string][]).map(([key, label, desc]) => (
              <ScoreSlider
                key={key}
                label={label}
                value={(form[key] as number) ?? 0}
                max={3}
                description={desc}
                onChange={v => setScore(key, v)}
              />
            ))}
          </Section>

          {/* ── R3: Social Risk ───────────────────────────────────────────── */}
          <Section
            title="R3 · Social Risk"
            subtitle="6 items · max 18"
            badge={<ScoreBadge value={computed.socialRisk} higherIsBetter={false} />}
            defaultOpen={false}
          >
            {([
              ['socialObligation',   'Social Obligation',    'Must play to not let team/guild down'],
              ['competitiveToxicity','Competitive Toxicity', 'Harassment, trash talk, toxic community'],
              ['strangerRisk',       'Stranger Risk',        'Unmoderated contact with unknown adults'],
              ['socialComparison',   'Social Comparison',    'Leaderboards, visible status, peer pressure'],
              ['identitySelfWorth',  'Identity / Self-Worth','Avatar or rank tied to self-worth'],
              ['privacyRisk',        'Privacy Risk',         'Data collection, location sharing, real names'],
            ] as [keyof FormState, string, string][]).map(([key, label, desc]) => (
              <ScoreSlider
                key={key}
                label={label}
                value={(form[key] as number) ?? 0}
                max={3}
                description={desc}
                onChange={v => setScore(key, v)}
              />
            ))}
          </Section>

          {/* ── R4: Content ───────────────────────────────────────────────── */}
          <Section
            title="R4 · Content Risk"
            subtitle="5 items · display only, not in RIS"
            badge={<ScoreBadge value={computed.contentRisk} higherIsBetter={false} />}
            defaultOpen={false}
          >
            <p className="text-xs text-slate-500 mb-3">
              Content risk is shown to parents separately. It does not affect time recommendations.
            </p>
            {([
              ['violenceLevel', 'Violence Level',       'Gore, graphic combat, disturbing imagery'],
              ['sexualContent', 'Sexual Content',       'Suggestive or explicit themes'],
              ['language',      'Language',             'Profanity, hate speech'],
              ['substanceRef',  'Substance References', 'Drugs, alcohol, smoking'],
              ['fearHorror',    'Fear / Horror',        'Scary imagery, jump scares, disturbing themes'],
            ] as [keyof FormState, string, string][]).map(([key, label, desc]) => (
              <ScoreSlider
                key={key}
                label={label}
                value={(form[key] as number) ?? 0}
                max={3}
                description={desc}
                onChange={v => setScore(key, v)}
              />
            ))}
          </Section>

          {/* ── Practical Info ────────────────────────────────────────────── */}
          <Section title="Practical Info" defaultOpen={false}>
            <div className="space-y-4">
              <NumInput
                label="Estimated monthly cost (low)"
                value={form.estimatedMonthlyCostLow}
                onChange={v => setScore('estimatedMonthlyCostLow', v)}
                prefix="$" placeholder="0"
              />
              <NumInput
                label="Estimated monthly cost (high)"
                value={form.estimatedMonthlyCostHigh}
                onChange={v => setScore('estimatedMonthlyCostHigh', v)}
                prefix="$" placeholder="0"
              />
              <NumInput
                label="Min. session length"
                value={form.minSessionMinutes}
                onChange={v => setScore('minSessionMinutes', v)}
                suffix="min" placeholder="—"
              />

              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasNaturalStoppingPoints}
                    onChange={e => setScore('hasNaturalStoppingPoints', e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span className="text-sm text-slate-700">Has natural stopping points</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.penalizesBreaks}
                    onChange={e => setScore('penalizesBreaks', e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span className="text-sm text-slate-700">Penalises breaks</span>
                </label>
              </div>
            </div>
          </Section>

          {/* ── Narratives ────────────────────────────────────────────────── */}
          <Section title="Reviewer Narratives" defaultOpen>
            <div className="space-y-4">
              {[
                ['benefitsNarrative', 'What your child develops', 'Explain the top benefits in plain language for parents. 2–4 sentences.'],
                ['risksNarrative',    'What to watch for',        'Explain the key risks clearly. Acknowledge context. 2–4 sentences.'],
                ['parentTip',         'Parent tip',               'One actionable suggestion (e.g., "Play together the first session", "Set a timer before starting").'],
              ].map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <textarea
                    value={(form[key as keyof FormState] as string) ?? ''}
                    onChange={e => setScore(key as keyof FormState, e.target.value as never)}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-y
                      focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
                  />
                </div>
              ))}
            </div>
          </Section>

          {/* ── Submit bar ────────────────────────────────────────────────── */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit('approved')}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl
                transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {saving ? 'Saving…' : '✓ Publish review'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit('draft')}
              className="px-5 py-3 border border-slate-300 hover:border-slate-400 text-slate-700 font-medium
                rounded-xl transition-colors disabled:opacity-60 text-sm"
            >
              Save draft
            </button>
          </div>

          {saved && (
            <p className="text-sm text-emerald-700 text-center">
              ✓ Saved — <a href={`/game/${game.slug}`} className="underline">view on game page</a>
            </p>
          )}
        </div>
      </div>

      {/* ─── RIGHT: Live Preview (desktop) ───────────────────────────────────── */}
      <div className="hidden lg:block w-96 shrink-0">
        <div className="sticky top-20 overflow-y-auto max-h-[calc(100vh-5rem)] pb-8 space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Live preview</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                computed.timeRecommendation.color === 'green' ? 'bg-emerald-500' :
                computed.timeRecommendation.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
              }`} />
              <span className="text-xs text-slate-400">Updates as you score</span>
            </div>
          </div>

          <GameCard {...gameCardProps} />

          {/* Score summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Score summary</p>
            {[
              { label: 'Cognitive (B1)',  value: computed.cognitiveScore,       good: true  },
              { label: 'Social (B2)',     value: computed.socialEmotionalScore,  good: true  },
              { label: 'Motor (B3)',      value: computed.motorScore,            good: true  },
              { label: 'BDS',            value: computed.bds,                   good: true  },
              { label: 'Dopamine (R1)',   value: computed.dopamineRisk,          good: false },
              { label: 'Monetization (R2)', value: computed.monetizationRisk,   good: false },
              { label: 'Social Risk (R3)', value: computed.socialRisk,          good: false },
              { label: 'Content (R4)',    value: computed.contentRisk,           good: false },
              { label: 'RIS',            value: computed.ris,                   good: false },
            ].map(({ label, value, good }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-slate-600 w-36 shrink-0">{label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${
                      good
                        ? value >= 0.6 ? 'bg-emerald-500' : value >= 0.3 ? 'bg-blue-400' : 'bg-slate-300'
                        : value >= 0.6 ? 'bg-red-500' : value >= 0.3 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.round(value * 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-bold w-8 text-right shrink-0 ${
                  good
                    ? value >= 0.6 ? 'text-emerald-700' : value >= 0.3 ? 'text-blue-600' : 'text-slate-400'
                    : value >= 0.6 ? 'text-red-700' : value >= 0.3 ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {Math.round(value * 100)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
