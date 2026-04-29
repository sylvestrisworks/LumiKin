import Link from 'next/link'
import { CATEGORY_DIMENSIONS } from '@/lib/dimensions'
import type { Dimension } from '@/lib/dimensions'
import type { SerializedScores } from '@/types/game'
import { Tooltip } from './Tooltip'

export const CONCERN_THRESHOLD = 30
export const STRONG_THRESHOLD  = 70

const GROUPS: { label: string; keys: string[] }[] = [
  {
    label: 'Developmental benefits',
    keys: ['cognitiveScore', 'socialEmotionalScore', 'motorScore'],
  },
  {
    label: 'Design risk factors',
    keys: ['dopamineRisk', 'monetizationRisk', 'socialRisk'],
  },
  {
    label: 'Additional dimensions',
    keys: ['contentRisk', 'accessibilityRisk', 'endlessDesignRisk', 'representationScore'],
  },
]

// Excludes propagandaLevel — raw 0–3 integer, different scale from 0–100 normalized scores
const DIM_MAP = Object.fromEntries(
  CATEGORY_DIMENSIONS.filter(d => d.key !== 'propagandaLevel').map(d => [d.key, d])
)

function isPositivePolarity(dim: Dimension): boolean {
  return dim.type === 'benefit' || dim.key === 'representationScore'
}

function valueColorClass(value: number, positive: boolean): string {
  if (positive) {
    if (value > STRONG_THRESHOLD)  return 'text-emerald-600 dark:text-emerald-400'
    if (value < CONCERN_THRESHOLD) return 'text-red-500 dark:text-red-400'
  } else {
    if (value > STRONG_THRESHOLD)  return 'text-red-500 dark:text-red-400'
    if (value < CONCERN_THRESHOLD) return 'text-emerald-600 dark:text-emerald-400'
  }
  return 'text-slate-600 dark:text-slate-300'
}

function getScore(scores: SerializedScores, key: string): number | null {
  const val = (scores as Record<string, unknown>)[key]
  return typeof val === 'number' ? val : null
}


type Props = {
  scores: SerializedScores
  locale: string
}

export function SubDimensionBreakdown({ scores, locale }: Props) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 px-5 py-5 space-y-5">
      <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
        Score breakdown
      </h2>

      {GROUPS.map(({ label, keys }) => {
        const dims = keys.map(k => DIM_MAP[k]).filter(Boolean) as Dimension[]
        if (dims.length === 0) return null

        return (
          <div key={label}>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
              {label}
            </p>
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {dims.map(dim => {
                const raw      = getScore(scores, dim.key)
                const value100 = raw != null ? Math.round(raw * 100) : null
                const positive = isPositivePolarity(dim)
                const colorClass = value100 != null
                  ? valueColorClass(value100, positive)
                  : 'text-slate-400 dark:text-slate-500'

                return (
                  <div key={dim.key} className="flex items-center gap-2 py-2">
                    <Link
                      href={`/${locale}/methodology${dim.methodology_anchor}`}
                      className="flex-1 flex items-center text-sm text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors min-w-0"
                    >
                      {dim.display_name}
                      <Tooltip text={dim.short_description} />
                    </Link>
                    <span className={`text-sm font-semibold tabular-nums shrink-0 w-7 text-right ${colorClass}`}>
                      {value100 != null ? value100 : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="text-xs text-slate-400 dark:text-slate-500 leading-snug">
        Benefits: higher is better. Risks: lower is better. Values highlighted when &lt;30 or &gt;70.
      </p>
    </div>
  )
}
