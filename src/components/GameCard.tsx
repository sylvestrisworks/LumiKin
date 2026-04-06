'use client'

import { useState } from 'react'
import type { DarkPattern, GameCardProps, SerializedReview, SerializedScores } from '@/types/game'
import DarkPatternPills from './DarkPatternPills'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(title: string): string {
  return title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

// Deterministic color from title (for placeholder background)
const PLACEHOLDER_COLORS = [
  'bg-violet-600', 'bg-indigo-600', 'bg-blue-600', 'bg-cyan-600',
  'bg-teal-600',   'bg-emerald-600','bg-amber-600', 'bg-orange-600',
]
function placeholderColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash)
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length]
}

function pct(value: number | null | undefined): string {
  return `${Math.round((value ?? 0) * 100)}%`
}

function esrbColors(rating: string | null): string {
  switch (rating) {
    case 'E':    return 'bg-green-100 text-green-800 border-green-300'
    case 'E10+': return 'bg-lime-100 text-lime-800 border-lime-300'
    case 'T':    return 'bg-blue-100 text-blue-800 border-blue-300'
    case 'M':    return 'bg-red-100 text-red-800 border-red-300'
    case 'AO':   return 'bg-red-200 text-red-900 border-red-400'
    default:     return 'bg-slate-100 text-slate-600 border-slate-300'
  }
}

function timeBoxColors(color: 'green' | 'amber' | 'red' | null): string {
  switch (color) {
    case 'green': return 'bg-emerald-600 text-white'
    case 'amber': return 'bg-amber-500 text-white'
    case 'red':   return 'bg-red-600 text-white'
    default:      return 'bg-slate-400 text-white'
  }
}

function riskBarColor(value: number | null): string {
  const v = value ?? 0
  if (v < 0.3)  return 'bg-emerald-500'
  if (v < 0.6)  return 'bg-amber-500'
  return 'bg-red-500'
}

function riskLevel(value: number | null): string {
  const v = value ?? 0
  if (v < 0.3)  return 'Low'
  if (v < 0.6)  return 'Moderate'
  return 'High'
}

function scoreBarColor(value: number | null): string {
  const v = value ?? 0
  if (v >= 0.7) return 'bg-emerald-500'
  if (v >= 0.4) return 'bg-blue-500'
  return 'bg-slate-400'
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function SkillDots({ score, max = 5 }: { score: number | null; max?: number }) {
  const filled = Math.round(score ?? 0)
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`w-3 h-3 rounded-full ${i < filled ? 'bg-emerald-500' : 'bg-slate-200'}`}
        />
      ))}
    </span>
  )
}

function CategoryBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-sm text-slate-600 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBarColor(value)}`}
          style={{ width: pct(value) }}
        />
      </div>
      <span className="w-10 text-right text-sm font-medium text-slate-700 shrink-0">
        {Math.round((value ?? 0) * 100)}
      </span>
    </div>
  )
}

function RiskMeter({
  label,
  value,
  note,
}: {
  label: string
  value: number | null
  note?: string
}) {
  const level = riskLevel(value)
  const levelColor = {
    Low: 'text-emerald-700 bg-emerald-50',
    Moderate: 'text-amber-700 bg-amber-50',
    High: 'text-red-700 bg-red-50',
  }[level]

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${levelColor}`}>
          {level}
        </span>
      </div>
      <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${riskBarColor(value)}`}
          style={{ width: pct(value) }}
        />
      </div>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  )
}

function DetailRow({
  label,
  score,
  max,
}: {
  label: string
  score: number | null
  max: number
}) {
  const value = score ?? 0
  const fraction = value / max
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="flex-1 text-xs text-slate-600">{label}</span>
      <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${scoreBarColor(fraction)}`}
          style={{ width: `${(fraction * 100).toFixed(0)}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-medium text-slate-500 shrink-0">
        {value}/{max}
      </span>
    </div>
  )
}

// ─── Tab content components ───────────────────────────────────────────────────

function BenefitsTab({
  scores,
  review,
}: {
  scores: SerializedScores
  review: SerializedReview | null
}) {
  return (
    <div className="space-y-6">
      {/* Top skills */}
      {scores.topBenefits && scores.topBenefits.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Top Skills Developed
          </h3>
          <div className="space-y-2">
            {scores.topBenefits.map((b) => (
              <div key={b.skill} className="flex items-center gap-3">
                <span className="w-44 text-sm font-medium text-slate-700">{b.skill}</span>
                <SkillDots score={b.score} max={b.maxScore} />
                <span className="text-xs text-slate-400 ml-1">
                  {b.score}/{b.maxScore}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category bars */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Development Areas
        </h3>
        <div className="space-y-3">
          <CategoryBar label="Cognitive" value={scores.cognitiveScore} />
          <CategoryBar label="Social & Emotional" value={scores.socialEmotionalScore} />
          <CategoryBar label="Motor Skills" value={scores.motorScore} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-500">Overall Benefit Score (BDS)</span>
          <span className="text-sm font-bold text-emerald-700">
            {Math.round((scores.bds ?? 0) * 100)}/100
          </span>
        </div>
      </div>

      {/* Narrative */}
      {review?.benefitsNarrative && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-emerald-800 mb-1">
            What your child develops
          </h3>
          <p className="text-sm text-emerald-900 leading-relaxed">
            {review.benefitsNarrative}
          </p>
        </div>
      )}
    </div>
  )
}

function RisksTab({
  scores,
  game,
  review,
  darkPatterns,
}: {
  scores: SerializedScores
  game: GameCardProps['game']
  review: SerializedReview | null
  darkPatterns: DarkPattern[]
}) {
  const flags = [
    game.hasMicrotransactions && 'In-app purchases',
    game.hasLootBoxes && 'Loot boxes / gacha',
    game.hasBattlePass && 'Battle pass',
    game.hasSubscription && 'Subscription required',
    game.hasStrangerChat && 'Stranger chat',
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-6">
      {/* Risk meters */}
      <div className="space-y-4">
        <RiskMeter
          label="Dopamine Manipulation"
          value={scores.dopamineRisk}
          note="Variable rewards, streaks, FOMO events, and other engagement mechanics"
        />
        <RiskMeter
          label="Monetization Pressure"
          value={scores.monetizationRisk}
          note="In-app purchases, pay-to-win elements, and spending prompts"
        />
        <RiskMeter
          label="Social Risk"
          value={scores.socialRisk}
          note="Social obligation, competitive toxicity, stranger interaction"
        />
        <div>
          <RiskMeter
            label="Content (not in risk score)"
            value={scores.contentRisk}
            note="Violence, language, and other content factors — context depends on age"
          />
          <p className="text-xs text-slate-400 mt-1">
            Content risk is displayed separately and does not affect the time recommendation.
          </p>
        </div>
      </div>

      {/* Risk flags */}
      {flags.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Flags</h3>
          <div className="flex flex-wrap gap-2">
            {flags.map((f) => (
              <span
                key={f}
                className="text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded-full"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Risks narrative */}
      {review?.risksNarrative && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">What to watch for</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{review.risksNarrative}</p>
        </div>
      )}

      {/* Dark pattern pills */}
      <DarkPatternPills patterns={darkPatterns} />

      {/* DP05 special banner */}
      {darkPatterns.some((p) => p.patternId === 'DP05') && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-900">
          🧸 Characters in this game directly ask players to make purchases
        </div>
      )}

      {/* Parent tip */}
      {review?.parentTip && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-1">Parent tip</h3>
          <p className="text-sm text-blue-900 leading-relaxed">{review.parentTip}</p>
        </div>
      )}
    </div>
  )
}

function FullScoresTab({
  scores,
  review,
}: {
  scores: SerializedScores
  review: SerializedReview | null
}) {
  if (!review) return <p className="text-sm text-slate-400">No detailed review data yet.</p>

  return (
    <div className="space-y-6">
      {/* Benefits breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Benefit Scores (0–5)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">B1 · Cognitive</p>
            <DetailRow label="Problem Solving"    score={review.problemSolving}    max={5} />
            <DetailRow label="Spatial Awareness"  score={review.spatialAwareness}  max={5} />
            <DetailRow label="Strategic Thinking" score={review.strategicThinking} max={5} />
            <DetailRow label="Critical Thinking"  score={review.criticalThinking}  max={5} />
            <DetailRow label="Memory & Attention" score={review.memoryAttention}   max={5} />
            <DetailRow label="Creativity"         score={review.creativity}        max={5} />
            <DetailRow label="Reading & Language" score={review.readingLanguage}   max={5} />
            <DetailRow label="Math & Systems"     score={review.mathSystems}       max={5} />
            <DetailRow label="Learning Transfer"  score={review.learningTransfer}  max={5} />
            <DetailRow label="Adaptive Challenge" score={review.adaptiveChallenge} max={5} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">B2 · Social-Emotional</p>
            <DetailRow label="Teamwork"              score={review.teamwork}           max={5} />
            <DetailRow label="Communication"         score={review.communication}      max={5} />
            <DetailRow label="Empathy"               score={review.empathy}            max={5} />
            <DetailRow label="Emotional Regulation"  score={review.emotionalRegulation}max={5} />
            <DetailRow label="Ethical Reasoning"     score={review.ethicalReasoning}   max={5} />
            <DetailRow label="Positive Social"       score={review.positiveSocial}     max={5} />
            <p className="text-xs font-semibold text-slate-400 mt-3 mb-1">B3 · Motor</p>
            <DetailRow label="Hand-Eye Coordination" score={review.handEyeCoord}       max={5} />
            <DetailRow label="Fine Motor"            score={review.fineMotor}          max={5} />
            <DetailRow label="Reaction Time"         score={review.reactionTime}       max={5} />
            <DetailRow label="Physical Activity"     score={review.physicalActivity}   max={5} />
          </div>
        </div>

        {/* BDS formula */}
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800">
          <span className="font-semibold">BDS</span> = Cognitive ×0.50 + Social ×0.30 + Motor ×0.20
          {' = '}
          <span className="font-semibold">
            {Math.round((scores.bds ?? 0) * 100)}/100
          </span>
        </div>
      </div>

      {/* Risk breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Risk Scores (0–3)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">R1 · Dopamine Manipulation</p>
            <DetailRow label="Variable Rewards"       score={review.variableRewards}      max={3} />
            <DetailRow label="Streak Mechanics"       score={review.streakMechanics}      max={3} />
            <DetailRow label="Loss Aversion"          score={review.lossAversion}         max={3} />
            <DetailRow label="FOMO Events"            score={review.fomoEvents}           max={3} />
            <DetailRow label="Stopping Barriers"      score={review.stoppingBarriers}     max={3} />
            <DetailRow label="Notifications"          score={review.notifications}        max={3} />
            <DetailRow label="Near Miss"              score={review.nearMiss}             max={3} />
            <DetailRow label="Infinite Play"          score={review.infinitePlay}         max={3} />
            <DetailRow label="Escalating Commitment"  score={review.escalatingCommitment} max={3} />
            <DetailRow label="Reward Frequency"       score={review.variableRewardFreq}   max={3} />
            <p className="text-xs font-semibold text-slate-400 mt-3 mb-1">R2 · Monetization Pressure</p>
            <DetailRow label="Spending Ceiling"       score={review.spendingCeiling}      max={3} />
            <DetailRow label="Pay-to-Win"             score={review.payToWin}             max={3} />
            <DetailRow label="Currency Obfuscation"   score={review.currencyObfuscation}  max={3} />
            <DetailRow label="Spending Prompts"       score={review.spendingPrompts}      max={3} />
            <DetailRow label="Child Targeting"        score={review.childTargeting}       max={3} />
            <DetailRow label="Ad Pressure"            score={review.adPressure}           max={3} />
            <DetailRow label="Subscription Pressure"  score={review.subscriptionPressure} max={3} />
            <DetailRow label="Social Spending"        score={review.socialSpending}       max={3} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">R3 · Social Risk</p>
            <DetailRow label="Social Obligation"      score={review.socialObligation}     max={3} />
            <DetailRow label="Competitive Toxicity"   score={review.competitiveToxicity}  max={3} />
            <DetailRow label="Stranger Risk"          score={review.strangerRisk}         max={3} />
            <DetailRow label="Social Comparison"      score={review.socialComparison}     max={3} />
            <DetailRow label="Identity / Self-Worth"  score={review.identitySelfWorth}    max={3} />
            <DetailRow label="Privacy Risk"           score={review.privacyRisk}          max={3} />
            <p className="text-xs font-semibold text-slate-400 mt-3 mb-1">R4 · Content (display only)</p>
            <DetailRow label="Violence Level"         score={review.violenceLevel}        max={3} />
            <DetailRow label="Sexual Content"         score={review.sexualContent}        max={3} />
            <DetailRow label="Language"               score={review.language}             max={3} />
            <DetailRow label="Substance References"   score={review.substanceRef}         max={3} />
            <DetailRow label="Fear / Horror"          score={review.fearHorror}           max={3} />
          </div>
        </div>

        {/* RIS formula */}
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
          <span className="font-semibold">RIS</span> = Dopamine ×0.45 + Monetization ×0.30 + Social ×0.25
          {' = '}
          <span className="font-semibold">
            {Math.round((scores.ris ?? 0) * 100)}/100
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main GameCard ─────────────────────────────────────────────────────────────

type Tab = 'benefits' | 'risks' | 'scores'

export default function GameCard({ game, scores, review, darkPatterns }: GameCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('benefits')

  const color = placeholderColor(game.title)
  const abbr = initials(game.title)
  const hasReview = scores !== null

  const tabClass = (tab: Tab) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-indigo-600 text-indigo-700'
        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
    }`

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="relative">
        {/* Background image or gradient */}
        {game.backgroundImage ? (
          <div className="relative h-40 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={game.backgroundImage}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        ) : (
          <div className={`h-28 ${color} flex items-center justify-center`}>
            <span className="text-5xl font-black text-white/20 select-none">{abbr}</span>
          </div>
        )}

        {/* ESRB badge — absolute top-right */}
        {game.esrbRating && (
          <span
            className={`absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded border ${esrbColors(game.esrbRating)}`}
          >
            {game.esrbRating}
          </span>
        )}
      </div>

      {/* ── Title / meta ─────────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 space-y-2">
        <h1 className="text-xl font-bold text-slate-900 leading-tight">{game.title}</h1>
        {game.developer && (
          <p className="text-sm text-slate-500">{game.developer}</p>
        )}
        <div className="flex flex-wrap gap-1.5 items-center">
          {game.genres.slice(0, 4).map((g) => (
            <span
              key={g}
              className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full"
            >
              {g}
            </span>
          ))}
          {game.metacriticScore != null && (
            <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full ml-auto">
              Metacritic {game.metacriticScore}
            </span>
          )}
        </div>
      </div>

      {/* ── Executive summary ────────────────────────────────────────────────── */}
      {scores?.executiveSummary && (
        <p className="px-5 pb-3 text-sm text-slate-500 leading-snug">
          {scores.executiveSummary}
        </p>
      )}

      {/* ── Time recommendation ───────────────────────────────────────────────── */}
      {hasReview && scores.timeRecommendationMinutes != null ? (
        <div className={`mx-5 mb-4 rounded-xl px-5 py-4 ${timeBoxColors(scores.timeRecommendationColor)}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black">
                  {scores.timeRecommendationMinutes >= 120
                    ? '120+'
                    : scores.timeRecommendationMinutes}
                </span>
                {scores.timeRecommendationMinutes < 120 && (
                  <span className="text-lg font-semibold opacity-80">min/day</span>
                )}
              </div>
              <p className="text-sm font-semibold opacity-90 mt-0.5">
                {scores.timeRecommendationLabel}
              </p>
            </div>
            {scores.timeRecommendationReasoning && (
              <p className="text-xs opacity-80 max-w-xs text-right leading-snug">
                {scores.timeRecommendationReasoning}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mx-5 mb-4 rounded-xl px-5 py-3 bg-slate-100 border border-slate-200">
          <p className="text-sm text-slate-500 font-medium">Rating pending review</p>
          <p className="text-xs text-slate-400 mt-0.5">
            This game hasn&apos;t been reviewed yet. Check back soon.
          </p>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200">
        <nav className="flex px-5">
          <button className={tabClass('benefits')} onClick={() => setActiveTab('benefits')}>
            Benefits
          </button>
          <button className={tabClass('risks')} onClick={() => setActiveTab('risks')}>
            Risks
          </button>
          <button className={tabClass('scores')} onClick={() => setActiveTab('scores')}>
            Full Scores
          </button>
        </nav>
      </div>

      <div className="px-5 py-5 min-h-48">
        {!hasReview ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">
              Detailed scoring is available once a review is submitted for this game.
            </p>
          </div>
        ) : activeTab === 'benefits' ? (
          <BenefitsTab scores={scores} review={review} />
        ) : activeTab === 'risks' ? (
          <RisksTab scores={scores} game={game} review={review} darkPatterns={darkPatterns} />
        ) : (
          <FullScoresTab scores={scores} review={review} />
        )}
      </div>

      {/* ── DP04 virtual currency banner ─────────────────────────────────────── */}
      {darkPatterns.some((p) => p.patternId === 'DP04') && (
        <div className="mx-5 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-900">
          <span className="font-medium">💱 This game uses virtual currency</span>
          {' — real costs may not be obvious to children'}
          {review?.virtualCurrencyName && (
            <span className="block text-xs text-amber-700 mt-0.5">
              {review.virtualCurrencyName}
              {review.virtualCurrencyRate && ` — ${review.virtualCurrencyRate}`}
            </span>
          )}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div className="border-t border-slate-100 px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
        {/* Cost */}
        <span>
          <span className="font-medium text-slate-700">Base price: </span>
          {game.basePrice != null ? `$${game.basePrice.toFixed(2)}` : 'Unknown'}
        </span>

        {/* Monthly cost from review */}
        {review?.estimatedMonthlyCostLow != null && (
          <span>
            <span className="font-medium text-slate-700">Monthly: </span>
            {review.estimatedMonthlyCostLow === 0 && review.estimatedMonthlyCostHigh === 0
              ? 'Free'
              : review.estimatedMonthlyCostHigh != null
              ? `$${review.estimatedMonthlyCostLow}–$${review.estimatedMonthlyCostHigh}/mo`
              : `$${review.estimatedMonthlyCostLow}/mo`}
          </span>
        )}

        {/* Playtime */}
        {game.avgPlaytimeHours != null && game.avgPlaytimeHours > 0 && (
          <span>
            <span className="font-medium text-slate-700">Playtime: </span>~{game.avgPlaytimeHours}h
          </span>
        )}

        {/* Platforms */}
        {game.platforms.length > 0 && (
          <span className="hidden sm:inline">
            <span className="font-medium text-slate-700">On: </span>
            {game.platforms.slice(0, 3).join(', ')}
            {game.platforms.length > 3 && ` +${game.platforms.length - 3}`}
          </span>
        )}

        {/* Last updated */}
        <span className="ml-auto">
          {scores?.calculatedAt
            ? `Reviewed ${new Date(scores.calculatedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
            : game.updatedAt
            ? `Updated ${new Date(game.updatedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
            : null}
        </span>
      </div>
    </div>
  )
}
