'use client'

import { useState } from 'react'
import { Lightbulb, Sparkles, Zap, Clock, CheckCircle2 } from 'lucide-react'
import type { DarkPattern, GameCardProps, SerializedReview, SerializedScores } from '@/types/game'
import { esrbToAge, ageBadgeColor } from '@/lib/ui'
import DarkPatternPills from './DarkPatternPills'
import ComplianceBadges from './ComplianceBadges'

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

function riskLevel(value: number | null): { label: string; color: string; bg: string } {
  const v = value ?? 0
  if (v < 0.3) return { label: 'LOW',      color: 'text-emerald-700', bg: 'bg-emerald-100' }
  if (v < 0.6) return { label: 'MODERATE', color: 'text-amber-700',   bg: 'bg-amber-100'   }
  return              { label: 'HIGH',     color: 'text-red-700',     bg: 'bg-red-100'     }
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

const BENEFIT_TOOLTIPS: Record<string, string> = {
  'Cognitive':          'Problem solving, spatial awareness, strategic thinking, creativity, memory, and learning transfer. Weighted 50% of the Benefit Score.',
  'Social & Emotional': 'Teamwork, communication, empathy, emotional regulation, and ethical reasoning. Weighted 30% of the Benefit Score.',
  'Motor Skills':       'Hand-eye coordination, fine motor control, reaction time, and physical activity. Weighted 20% of the Benefit Score.',
}

function CategoryBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-sm text-slate-600 shrink-0 flex items-center">
        {label}
        {BENEFIT_TOOLTIPS[label] && <Tooltip text={BENEFIT_TOOLTIPS[label]} />}
      </span>
      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${scoreBarColor(value)}`} style={{ width: pct(value) }} />
      </div>
      <span className="w-10 text-right text-sm font-medium text-slate-700 shrink-0">
        {Math.round((value ?? 0) * 100)}
      </span>
    </div>
  )
}

const RISK_TOOLTIPS: Record<string, string> = {
  'Dopamine Manipulation':  'Variable rewards, streaks, FOMO events, near-miss mechanics, and other design patterns that exploit reward psychology.',
  'Monetization Pressure':  'In-app purchases, pay-to-win mechanics, virtual currency obfuscation, spending prompts, and ad pressure.',
  'Social Risk':            'Social obligations, competitive toxicity, stranger interaction, social comparison, and privacy concerns.',
  'Content (not in risk score)': 'Violence, language, sexual content, and other age-related content factors. Shown separately — does not affect the time recommendation.',
}

function RiskMeter({ label, value, note }: { label: string; value: number | null; note?: string }) {
  const level = riskLevel(value)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700 flex items-center">
          {label}
          {RISK_TOOLTIPS[label] && <Tooltip text={RISK_TOOLTIPS[label]} />}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${level.bg} ${level.color}`}>
          {level.label}
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
    <div className="flex items-center gap-3 py-1">
      <span className="flex-1 text-xs text-slate-600">{label}</span>
      <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${scoreBarColor(fraction)}`} style={{ width: `${(fraction * 100).toFixed(0)}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-medium text-slate-500 shrink-0">{value}/{max}</span>
    </div>
  )
}

// ─── Tab content ──────────────────────────────────────────────────────────────

function BenefitsTab({ scores, review }: { scores: SerializedScores; review: SerializedReview | null }) {
  return (
    <div className="space-y-8">
      {scores.topBenefits && scores.topBenefits.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Top Skills Developed</h3>
          <div className="space-y-2">
            {scores.topBenefits.map((b) => (
              <div key={b.skill} className="flex items-center gap-3">
                <span className="w-44 text-sm font-medium text-slate-700">{b.skill}</span>
                <SkillDots score={b.score} max={b.maxScore} />
                <span className="text-xs text-slate-400 ml-1">{b.score}/{b.maxScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Development Areas</h3>
        <div className="space-y-3">
          <CategoryBar label="Cognitive"        value={scores.cognitiveScore} />
          <CategoryBar label="Social & Emotional" value={scores.socialEmotionalScore} />
          <CategoryBar label="Motor Skills"     value={scores.motorScore} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-500">Overall Benefit Score (BDS)</span>
          <span className="text-sm font-bold text-emerald-700">{Math.round((scores.bds ?? 0) * 100)}/100</span>
        </div>
      </div>
      {review?.benefitsNarrative && (
        <div className="bg-emerald-50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-emerald-800 mb-1">What your child develops</h3>
          <p className="text-sm text-emerald-900 leading-relaxed">{review.benefitsNarrative}</p>
        </div>
      )}
    </div>
  )
}

function RisksTab({ scores, game, review, darkPatterns }: {
  scores: SerializedScores; game: GameCardProps['game']
  review: SerializedReview | null; darkPatterns: DarkPattern[]
}) {
  const flags = [
    game.hasMicrotransactions && 'In-app purchases',
    game.hasLootBoxes         && 'Loot boxes / gacha',
    game.hasBattlePass        && 'Battle pass',
    game.hasSubscription      && 'Subscription required',
    game.hasStrangerChat      && 'Stranger chat',
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <RiskMeter label="Dopamine Manipulation"  value={scores.dopamineRisk}     note="Variable rewards, streaks, FOMO events, and other engagement mechanics" />
        <RiskMeter label="Monetization Pressure"  value={scores.monetizationRisk} note="In-app purchases, pay-to-win elements, and spending prompts" />
        <RiskMeter label="Social Risk"            value={scores.socialRisk}       note="Social obligation, competitive toxicity, stranger interaction" />
        <div>
          <RiskMeter label="Content (not in risk score)" value={scores.contentRisk} note="Violence, language, and other content factors — context depends on age" />
          <p className="text-xs text-slate-400 mt-1">Content risk is displayed separately and does not affect the time recommendation.</p>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Flags</h3>
          <div className="flex flex-wrap gap-2">
            {flags.map((f) => (
              <span key={f} className="text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Representation */}
      {(review?.repGenderBalance != null || review?.repEthnicDiversity != null) && (
        <div className="bg-purple-50 rounded-2xl p-5 space-y-2">
          <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-1.5">
            Representation
            <Tooltip text="How diverse the game's characters are in gender and ethnicity. Higher = more authentic representation. Display only — does not affect time recommendation." />
          </h3>
          <div className="space-y-1.5">
            {review.repGenderBalance != null && (
              <div className="flex items-center gap-3">
                <span className="w-36 text-xs text-purple-700 shrink-0">Gender balance</span>
                <div className="flex-1 bg-purple-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full bg-purple-400 transition-all" style={{ width: `${(review.repGenderBalance / 3) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-medium text-purple-700">{review.repGenderBalance}/3</span>
              </div>
            )}
            {review.repEthnicDiversity != null && (
              <div className="flex items-center gap-3">
                <span className="w-36 text-xs text-purple-700 shrink-0">Ethnic diversity</span>
                <div className="flex-1 bg-purple-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full bg-purple-400 transition-all" style={{ width: `${(review.repEthnicDiversity / 3) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-medium text-purple-700">{review.repEthnicDiversity}/3</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Propaganda flag */}
      {review?.propagandaLevel != null && review.propagandaLevel > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-yellow-800 mb-1 flex items-center gap-1.5">
            Ideological content
            <Tooltip text="Presence of propaganda, nationalist framing, or strong ideological content. 0=neutral, 3=heavy. Display only — does not affect time recommendation." />
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
              review.propagandaLevel === 1 ? 'bg-yellow-100 text-yellow-700' :
              review.propagandaLevel === 2 ? 'bg-orange-100 text-orange-700' :
              'bg-red-100 text-red-700'
            }`}>
              {['', 'MILD', 'NOTABLE', 'HEAVY'][review.propagandaLevel]}
            </span>
          </h3>
          {review.propagandaNotes && (
            <p className="text-xs text-yellow-800 leading-relaxed">{review.propagandaNotes}</p>
          )}
        </div>
      )}

      {review?.risksNarrative && (
        <div className="bg-slate-50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">What to watch for</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{review.risksNarrative}</p>
        </div>
      )}

      <DarkPatternPills patterns={darkPatterns} />

      {darkPatterns.some((p) => p.patternId === 'DP05') && (
        <div className="bg-purple-50 rounded-2xl p-3 text-sm text-purple-900">
          🧸 Characters in this game directly ask players to make purchases
        </div>
      )}

      {review?.parentTip && (
        <div className="bg-blue-50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-blue-800 mb-1">Parent tip</h3>
          <p className="text-sm text-blue-900 leading-relaxed">{review.parentTip}</p>
        </div>
      )}
    </div>
  )
}

function FullScoresTab({ scores, review }: { scores: SerializedScores; review: SerializedReview | null }) {
  const [expanded, setExpanded] = useState(false)

  if (!review) return <p className="text-sm text-slate-400">No detailed review data yet.</p>

  return (
    <div className="space-y-6">
      {/* Summary always visible */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-800">
          <p className="font-semibold mb-0.5">BDS — Benefit Score</p>
          <p className="text-emerald-600">Cognitive ×0.50 + Social ×0.30 + Motor ×0.20</p>
          <p className="text-lg font-black mt-1">{Math.round((scores.bds ?? 0) * 100)}<span className="text-xs font-semibold">/100</span></p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-xs text-red-800">
          <p className="font-semibold mb-0.5">RIS — Risk Score</p>
          <p className="text-red-600">Dopamine ×0.45 + Monetization ×0.30 + Social ×0.25</p>
          <p className="text-lg font-black mt-1">{Math.round((scores.ris ?? 0) * 100)}<span className="text-xs font-semibold">/100</span></p>
        </div>
      </div>

      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors py-1 border border-dashed border-indigo-200 rounded-lg hover:border-indigo-400"
      >
        {expanded ? '↑ Hide item scores' : '↓ Expand all item scores (30+ fields)'}
      </button>

      {expanded && (
      <>
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Benefit Scores (0–5)</h3>
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
            <DetailRow label="Teamwork"             score={review.teamwork}            max={5} />
            <DetailRow label="Communication"        score={review.communication}       max={5} />
            <DetailRow label="Empathy"              score={review.empathy}             max={5} />
            <DetailRow label="Emotional Regulation" score={review.emotionalRegulation} max={5} />
            <DetailRow label="Ethical Reasoning"    score={review.ethicalReasoning}    max={5} />
            <DetailRow label="Positive Social"      score={review.positiveSocial}      max={5} />
            <p className="text-xs font-semibold text-slate-400 mt-3 mb-1">B3 · Motor</p>
            <DetailRow label="Hand-Eye Coordination" score={review.handEyeCoord}      max={5} />
            <DetailRow label="Fine Motor"            score={review.fineMotor}         max={5} />
            <DetailRow label="Reaction Time"         score={review.reactionTime}      max={5} />
            <DetailRow label="Physical Activity"     score={review.physicalActivity}  max={5} />
          </div>
        </div>
        <div className="mt-4 bg-emerald-50 rounded-xl p-3 text-xs text-emerald-800">
          <span className="font-semibold">BDS</span> = Cognitive ×0.50 + Social ×0.30 + Motor ×0.20{' = '}
          <span className="font-semibold">{Math.round((scores.bds ?? 0) * 100)}/100</span>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Risk Scores (0–3)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">R1 · Dopamine Manipulation</p>
            <DetailRow label="Variable Rewards"      score={review.variableRewards}      max={3} />
            <DetailRow label="Streak Mechanics"      score={review.streakMechanics}      max={3} />
            <DetailRow label="Loss Aversion"         score={review.lossAversion}         max={3} />
            <DetailRow label="FOMO Events"           score={review.fomoEvents}           max={3} />
            <DetailRow label="Stopping Barriers"     score={review.stoppingBarriers}     max={3} />
            <DetailRow label="Notifications"         score={review.notifications}        max={3} />
            <DetailRow label="Near Miss"             score={review.nearMiss}             max={3} />
            <DetailRow label="Infinite Play"         score={review.infinitePlay}         max={3} />
            <DetailRow label="Escalating Commitment" score={review.escalatingCommitment} max={3} />
            <DetailRow label="Reward Frequency"      score={review.variableRewardFreq}   max={3} />
            <p className="text-xs font-semibold text-slate-400 mt-3 mb-1">R2 · Monetization Pressure</p>
            <DetailRow label="Spending Ceiling"      score={review.spendingCeiling}      max={3} />
            <DetailRow label="Pay-to-Win"            score={review.payToWin}             max={3} />
            <DetailRow label="Currency Obfuscation"  score={review.currencyObfuscation}  max={3} />
            <DetailRow label="Spending Prompts"      score={review.spendingPrompts}      max={3} />
            <DetailRow label="Child Targeting"       score={review.childTargeting}       max={3} />
            <DetailRow label="Ad Pressure"           score={review.adPressure}           max={3} />
            <DetailRow label="Subscription Pressure" score={review.subscriptionPressure} max={3} />
            <DetailRow label="Social Spending"       score={review.socialSpending}       max={3} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">R3 · Social Risk</p>
            <DetailRow label="Social Obligation"    score={review.socialObligation}    max={3} />
            <DetailRow label="Competitive Toxicity" score={review.competitiveToxicity} max={3} />
            <DetailRow label="Stranger Risk"        score={review.strangerRisk}        max={3} />
            <DetailRow label="Social Comparison"    score={review.socialComparison}    max={3} />
            <DetailRow label="Identity / Self-Worth" score={review.identitySelfWorth}  max={3} />
            <DetailRow label="Privacy Risk"         score={review.privacyRisk}         max={3} />
            <p className="text-xs font-semibold text-slate-400 mt-3 mb-1">R4 · Content (display only)</p>
            <DetailRow label="Violence Level"       score={review.violenceLevel}       max={3} />
            <DetailRow label="Sexual Content"       score={review.sexualContent}       max={3} />
            <DetailRow label="Language"             score={review.language}            max={3} />
            <DetailRow label="Substance References" score={review.substanceRef}        max={3} />
            <DetailRow label="Fear / Horror"        score={review.fearHorror}          max={3} />
          </div>
        </div>
        <div className="mt-4 bg-red-50 rounded-xl p-3 text-xs text-red-800">
          <span className="font-semibold">RIS</span> = Dopamine ×0.45 + Monetization ×0.30 + Social ×0.25{' = '}
          <span className="font-semibold">{Math.round((scores.ris ?? 0) * 100)}/100</span>
        </div>
      </div>

      {review && (review.r5CrossPlatform != null || review.r5LoadTime != null) && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            R5 · Accessibility Risk <span className="normal-case font-normal">(display only)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <div>
              <DetailRow label="Cross-platform availability" score={review.r5CrossPlatform}   max={3} />
              <DetailRow label="Load time / friction"        score={review.r5LoadTime}         max={3} />
              <DetailRow label="Mobile-optimised"            score={review.r5MobileOptimized}  max={3} />
              <DetailRow label="Login barrier"               score={review.r5LoginBarrier}     max={3} />
            </div>
          </div>
        </div>
      )}

      {review && (review.r6InfiniteGameplay != null || review.r6NoStoppingPoints != null) && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            R6 · Endless Design <span className="normal-case font-normal">(display only)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <div>
              <DetailRow label="Infinite gameplay"    score={review.r6InfiniteGameplay}   max={3} />
              <DetailRow label="No stopping points"   score={review.r6NoStoppingPoints}   max={3} />
              <DetailRow label="No fail / game-over"  score={review.r6NoGameOver}         max={3} />
              <DetailRow label="No chapter structure" score={review.r6NoChapterStructure} max={3} />
            </div>
          </div>
        </div>
      )}

      {review && (review.repGenderBalance != null || review.repEthnicDiversity != null) && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            REP · Representation <span className="normal-case font-normal">(display only — higher = better)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <div>
              <DetailRow label="Gender balance"    score={review.repGenderBalance}   max={3} />
              <DetailRow label="Ethnic diversity"  score={review.repEthnicDiversity} max={3} />
            </div>
          </div>
        </div>
      )}

      {review && review.propagandaLevel != null && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            PROP · Ideology <span className="normal-case font-normal">(display only)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <div>
              <DetailRow label="Propaganda level" score={review.propagandaLevel} max={3} />
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

      {/* ── 1. HEADER BOX ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        {/* Hero image */}
        {game.backgroundImage ? (
          <div className="relative h-44 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={game.backgroundImage} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            {game.esrbRating && (
              <span className={`absolute top-3 right-3 text-xs font-black px-2.5 py-1 rounded-full text-white ${ageBadgeColor(game.esrbRating)}`}>
                {esrbToAge(game.esrbRating)}
              </span>
            )}
          </div>
        ) : (
          <div className={`h-28 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
            <span className="text-5xl font-black text-white/20 select-none">{abbr}</span>
            {game.esrbRating && (
              <span className={`absolute top-3 right-3 text-xs font-black px-2.5 py-1 rounded-full text-white ${ageBadgeColor(game.esrbRating)}`}>
                {esrbToAge(game.esrbRating)}
              </span>
            )}
          </div>
        )}

        <div className="p-5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-tight">
              {game.title}
            </h1>
            {scores?.timeRecommendationMinutes != null && (
              <div className="shrink-0 flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-sm font-bold px-3 py-1.5 rounded-full">
                <Clock size={14} strokeWidth={2.5} />
                {scores.timeRecommendationMinutes >= 120 ? '120+' : scores.timeRecommendationMinutes} min/day
              </div>
            )}
          </div>

          {/* Developer */}
          {game.developer && (
            <p className="text-sm text-slate-400 font-medium mb-3">{game.developer}</p>
          )}

          {/* Genre tags */}
          <div className="flex flex-wrap gap-2">
            {game.genres.slice(0, 5).map((g) => (
              <span key={g} className="text-xs font-semibold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full tracking-tight">
                {g}
              </span>
            ))}
            {game.metacriticScore != null && (
              <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full ml-auto">
                MC {game.metacriticScore}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. MASTER SCORE BOX ────────────────────────────────────────────────── */}
      {hasReview && scores.curascore != null ? (
        <div className="bg-gradient-to-br from-slate-50 to-indigo-50 border border-indigo-100 rounded-3xl p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-2">Curascore</p>
          <div className={`inline-flex items-baseline gap-1 bg-gradient-to-br ${curascoreGradient(scores.curascore)} bg-clip-text text-transparent`}>
            <span className="text-8xl font-black tracking-tighter leading-none">
              {scores.curascore}
            </span>
            <span className="text-3xl font-black opacity-50">/100</span>
          </div>
          {scores.executiveSummary && (
            <p className="text-sm text-slate-500 mt-3 max-w-sm mx-auto leading-snug">
              {scores.executiveSummary}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 text-center">
          <p className="text-sm font-semibold text-slate-400">Rating pending review</p>
          <p className="text-xs text-slate-400 mt-1">This game hasn&apos;t been reviewed yet.</p>
        </div>
      )}

      {/* ── 3. TWO PILLARS ─────────────────────────────────────────────────────── */}
      {hasReview && (
        <div className="grid grid-cols-2 gap-3">

          {/* Growth Value */}
          <div className="bg-green-50 rounded-3xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-200 rounded-xl flex items-center justify-center">
                <Sparkles size={16} className="text-green-700" strokeWidth={2.5} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-green-700">Growth</p>
            </div>
            <p className="text-3xl font-black tracking-tighter text-green-900">
              {Math.round((scores.bds ?? 0) * 100)}
              <span className="text-base font-bold text-green-600">/100</span>
            </p>
            <p className="text-xs font-semibold text-green-700 -mt-1">Growth Value</p>
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
              <p className="text-xs font-black uppercase tracking-widest text-orange-700">Risk</p>
            </div>
            {risk && (
              <>
                <p className={`text-3xl font-black tracking-tighter ${risk.color}`}>
                  {risk.label}
                </p>
                <p className="text-xs font-semibold text-orange-700 -mt-1">Engagement Patterns</p>
              </>
            )}
            <p className="text-xs text-orange-800 leading-snug pt-1">
              {(scores.ris ?? 0) < 0.3
                ? 'Minimal pressure to spend or play excessively.'
                : (scores.ris ?? 0) < 0.6
                ? 'Some engagement mechanics worth discussing.'
                : 'Notable design patterns that encourage extended play.'}
            </p>
          </div>

        </div>
      )}

      {/* ── 4. PARENT TIP ──────────────────────────────────────────────────────── */}
      {review?.parentTip && (
        <div className="bg-blue-50 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-200 rounded-xl flex items-center justify-center">
              <Lightbulb size={16} className="text-blue-700" strokeWidth={2.5} />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-700">Parent Pro-Tip</p>
          </div>
          <p className="text-sm text-blue-900 leading-relaxed">{review.parentTip}</p>
        </div>
      )}

      {/* ── 5. VIRTUAL CURRENCY BANNER ─────────────────────────────────────────── */}
      {darkPatterns.some((p) => p.patternId === 'DP04') && (
        <div className="bg-amber-50 border border-amber-100 rounded-3xl px-5 py-4 text-sm text-amber-900">
          <span className="font-bold">💱 Uses virtual currency</span>
          {' — real costs may not be obvious to children'}
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
              {tab === 'benefits' ? 'Benefits' : tab === 'risks' ? 'Risks' : 'Full Scores'}
            </button>
          ))}
        </div>

        <div className="px-5 pb-5 min-h-48">
          {!hasReview ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">Detailed scoring is available once a review is submitted.</p>
            </div>
          ) : activeTab === 'benefits' ? (
            <BenefitsTab scores={scores} review={review} />
          ) : activeTab === 'risks' ? (
            <RisksTab scores={scores} game={game} review={review} darkPatterns={darkPatterns} />
          ) : (
            <FullScoresTab scores={scores} review={review} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
          <span>
            <span className="font-semibold text-slate-600">Base: </span>
            {game.basePrice != null ? `$${game.basePrice.toFixed(2)}` : 'Unknown'}
          </span>
          {review?.estimatedMonthlyCostLow != null && (
            <span>
              <span className="font-semibold text-slate-600">Monthly: </span>
              {review.estimatedMonthlyCostLow === 0 && review.estimatedMonthlyCostHigh === 0
                ? 'Free'
                : review.estimatedMonthlyCostHigh != null
                ? `$${review.estimatedMonthlyCostLow}–$${review.estimatedMonthlyCostHigh}/mo`
                : `$${review.estimatedMonthlyCostLow}/mo`}
            </span>
          )}
          {game.avgPlaytimeHours != null && game.avgPlaytimeHours > 0 && (
            <span>
              <span className="font-semibold text-slate-600">Playtime: </span>~{game.avgPlaytimeHours}h
            </span>
          )}
          {game.platforms.length > 0 && (
            <span className="hidden sm:inline">
              <span className="font-semibold text-slate-600">On: </span>
              {game.platforms.slice(0, 3).join(', ')}
              {game.platforms.length > 3 && ` +${game.platforms.length - 3}`}
            </span>
          )}
          <span className="ml-auto">
            {scores?.calculatedAt
              ? `Reviewed ${new Date(scores.calculatedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
              : game.updatedAt
              ? `Updated ${new Date(game.updatedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
              : null}
          </span>
        </div>
      </div>

      {/* ── 7. COMPLIANCE ──────────────────────────────────────────────────────── */}
      <ComplianceBadges compliance={compliance} />

    </div>
  )
}
