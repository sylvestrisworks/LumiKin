'use client'

import { useTranslations } from 'next-intl'
import { curascoreText } from '@/lib/ui'

const ESRB_MIN_AGE: Record<string, number> = { E: 6, 'E10+': 10, T: 13, M: 17, AO: 18 }

function resolveAge(
  recommendedMinAge: number | null,
  esrbRating: string | null,
  pegiRating: number | null,
): number | null {
  if (recommendedMinAge != null) return recommendedMinAge
  if (esrbRating)                return ESRB_MIN_AGE[esrbRating] ?? null
  return pegiRating              // PEGI rating IS the minimum age (3, 7, 12, 16, 18)
}

function useVerdictLine() {
  const t = useTranslations('lumiScoreHero')
  return (score: number, age: number | null): string => {
    if (score >= 70) {
      return age && age >= 13
        ? t('verdictGreatAge', { age })
        : t('verdictGreatAny')
    }
    if (score >= 50) {
      return age
        ? t('verdictGoodAge', { age })
        : t('verdictGoodAny')
    }
    if (score >= 35) return t('verdictCaution')
    return t('verdictAvoid')
  }
}

type Props = {
  curascore: number
  recommendedMinAge: number | null
  esrbRating: string | null
  pegiRating: number | null
  executiveSummary: string | null
  /** Overlaid in the top-right corner — pass the ShareButton here. */
  action?: React.ReactNode
  /** Rendered below the executive summary — pass time rec + debate badge here. */
  children?: React.ReactNode
}

export function LumiScoreHero({ curascore, recommendedMinAge, esrbRating, pegiRating, executiveSummary, action, children }: Props) {
  const t           = useTranslations('gameCard')
  const verdictLine = useVerdictLine()
  const scoreColor  = curascoreText(curascore)
  const age         = resolveAge(recommendedMinAge, esrbRating, pegiRating)
  const verdict     = verdictLine(curascore, age)

  return (
    <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 px-6 pt-6 pb-6 text-center">
      {action && <div className="absolute top-3 right-3">{action}</div>}

      <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
        LumiScore
      </p>

      <div
        className={`leading-none font-bold tabular-nums ${scoreColor}`}
        style={{ fontFamily: "Georgia, 'Iowan Old Style', serif", fontSize: 'clamp(64px, 14vw, 96px)' }}
      >
        {curascore}
      </div>

      <p
        className="text-sm text-slate-400 dark:text-slate-500 mt-2"
        style={{ fontVariant: 'small-caps', letterSpacing: '0.06em' }}
      >
        {t('outOf100')}
      </p>

      <p className={`mt-3 text-xl font-black tracking-tight ${scoreColor}`}>
        {verdict}
      </p>

      {executiveSummary && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-snug max-w-xs mx-auto">
          {executiveSummary}
        </p>
      )}

      {children && <div className="mt-4 flex flex-col items-center gap-2">{children}</div>}
    </div>
  )
}
