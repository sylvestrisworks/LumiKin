'use client'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { SerializedScores, SerializedReview } from '@/types/game'

type Props = {
  scores: SerializedScores
  review: SerializedReview | null
}

// Short labels that fit inside a polar chart without wrapping
const AXIS_LABELS: Record<string, string> = {
  addictive:     'Addictive',
  monetization:  'Monetization',
  social:        'Social',
  accessibility: 'Accessibility*',
  endless:       'Endless*',
}

function r5Normalized(review: SerializedReview | null): number {
  if (!review) return 0
  const total =
    (review.r5CrossPlatform   ?? 0) +
    (review.r5LoadTime        ?? 0) +
    (review.r5MobileOptimized ?? 0) +
    (review.r5LoginBarrier    ?? 0)
  return total / 12
}

function r6Normalized(review: SerializedReview | null): number {
  if (!review) return 0
  const total =
    (review.r6InfiniteGameplay    ?? 0) +
    (review.r6NoStoppingPoints    ?? 0) +
    (review.r6NoGameOver          ?? 0) +
    (review.r6NoChapterStructure  ?? 0)
  return total / 12
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: { label: string; value: number; displayOnly?: boolean } }>
}) {
  if (!active || !payload?.length) return null
  const { label, value, displayOnly } = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs max-w-[160px]">
      <p className="font-semibold text-slate-700">{label}</p>
      <p className="text-slate-500">{Math.round(value * 100)}/100</p>
      {displayOnly && (
        <p className="text-slate-400 mt-0.5">Context only — not in time score</p>
      )}
    </div>
  )
}

export default function RiskRadarChart({ scores, review }: Props) {
  const accessibility = scores.accessibilityRisk ?? r5Normalized(review)
  const endless       = scores.endlessDesignRisk  ?? r6Normalized(review)

  const data = [
    { key: 'addictive',     label: 'Addictive',       value: scores.dopamineRisk     ?? 0, baseline: 0.08, displayOnly: false },
    { key: 'monetization',  label: 'Monetization',    value: scores.monetizationRisk ?? 0, baseline: 0.08, displayOnly: false },
    { key: 'social',        label: 'Social',           value: scores.socialRisk       ?? 0, baseline: 0.08, displayOnly: false },
    { key: 'accessibility', label: 'Accessibility',   value: accessibility,                baseline: 0.08, displayOnly: true  },
    { key: 'endless',       label: 'Endless Design',  value: endless,                      baseline: 0.08, displayOnly: true  },
  ]

  // Custom tick — asterisk axes get a muted colour to signal "display only"
  const renderTick = ({
    x, y, payload,
  }: {
    x: number
    y: number
    payload: { value: string }
  }) => {
    const isDisplayOnly = payload.value.endsWith('*')
    const label = isDisplayOnly ? payload.value.slice(0, -1) : payload.value
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fill={isDisplayOnly ? '#94a3b8' : '#475569'}
      >
        {label}{isDisplayOnly ? <tspan fill="#94a3b8">*</tspan> : null}
      </text>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">
        Risk Profile Shape
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <RadarChart data={data} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="key"
            tickFormatter={(key: string) => AXIS_LABELS[key] ?? key}
            tick={renderTick}
          />
          {/* Subtle reference baseline */}
          <Radar
            name="baseline"
            dataKey="baseline"
            stroke="#cbd5e1"
            fill="#f8fafc"
            fillOpacity={1}
            isAnimationActive={false}
          />
          {/* Actual risk */}
          <Radar
            name="risk"
            dataKey="value"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.28}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-400 -mt-1">
        * Accessibility &amp; Endless Design are context only — they don&apos;t affect the time recommendation.
      </p>
    </div>
  )
}
