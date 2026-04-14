export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { curascoreBg, curascoreGradient, curascoreText } from '@/lib/ui'
import Link from 'next/link'

type Props = { params: { experienceSlug: string } }

function RiskRow({ label, value, max = 3, isRisk = true }: { label: string; value: number | null; max?: number; isRisk?: boolean }) {
  const v = value ?? 0
  const pct = Math.round((v / max) * 100)
  let barColor: string
  if (isRisk) {
    barColor = v === 0 ? 'bg-emerald-400' : v === 1 ? 'bg-amber-400' : v === 2 ? 'bg-orange-500' : 'bg-red-600'
  } else {
    barColor = v === 0 ? 'bg-slate-300 dark:bg-slate-600' : v === 1 ? 'bg-teal-400' : v === 2 ? 'bg-emerald-400' : 'bg-emerald-500'
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 text-slate-600 dark:text-slate-300 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs text-slate-400 font-mono">{v}/{max}</span>
    </div>
  )
}

function timeColor(color: string | null) {
  switch (color) {
    case 'green': return 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
    case 'amber': return 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
    case 'red':   return 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
    default:      return 'bg-slate-50 border-slate-200 text-slate-600'
  }
}

function formatCount(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [exp] = await db
    .select({ title: platformExperiences.title, description: platformExperiences.description, thumbnailUrl: platformExperiences.thumbnailUrl })
    .from(platformExperiences)
    .where(eq(platformExperiences.slug, params.experienceSlug))
    .limit(1)

  if (!exp) return { title: 'Experience not found — PlaySmart' }

  return {
    title: `${exp.title} (Roblox) — PlaySmart`,
    description: exp.description?.slice(0, 160) ?? `PlaySmart safety rating for ${exp.title} on Roblox.`,
    openGraph: exp.thumbnailUrl ? { images: [exp.thumbnailUrl] } : undefined,
  }
}

export default async function ExperiencePage({ params }: Props) {
  const [exp] = await db
    .select()
    .from(platformExperiences)
    .where(eq(platformExperiences.slug, params.experienceSlug))
    .limit(1)

  if (!exp) notFound()

  const [score] = await db
    .select()
    .from(experienceScores)
    .where(eq(experienceScores.experienceId, exp.id))
    .limit(1)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Breadcrumb */}
        <nav className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          <Link href="/game/roblox" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Roblox</Link>
          <span>/</span>
          <span className="text-slate-600 dark:text-slate-300 truncate">{exp.title}</span>
        </nav>

        {/* Hero card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {exp.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={exp.thumbnailUrl} alt="" className="w-full h-40 object-cover" />
          )}
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{exp.title}</h1>
                {exp.creatorName && (
                  <p className="text-sm text-slate-400 mt-0.5">by {exp.creatorName}</p>
                )}
              </div>
              {score?.curascore != null && (
                <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${curascoreGradient(score.curascore)}`}>
                  <span className="text-2xl font-black text-white">{score.curascore}</span>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-400 dark:text-slate-500">
              {exp.activePlayers != null && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  {formatCount(exp.activePlayers)} playing now
                </span>
              )}
              {exp.visitCount != null && <span>{formatCount(exp.visitCount)} total visits</span>}
              {exp.genre && <span>{exp.genre}</span>}
              {exp.maxPlayers != null && <span>Up to {exp.maxPlayers} per server</span>}
            </div>

            {/* Time recommendation */}
            {score?.timeRecommendationLabel && (
              <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold ${timeColor(score.timeRecommendationColor)}`}>
                <span>Recommended: {score.timeRecommendationLabel}</span>
                {score.recommendedMinAge != null && (
                  <span className="text-xs font-normal opacity-70">· Age {score.recommendedMinAge}+</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {score?.summary && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">"{score.summary}"</p>
          </div>
        )}

        {/* Benefits */}
        {score && (score.benefitsNarrative || score.creativityScore != null) && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 space-y-3">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">What your child develops</h2>
            {score.benefitsNarrative && (
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{score.benefitsNarrative}</p>
            )}
            <div className="space-y-2 pt-1">
              <RiskRow label="Creativity"    value={score.creativityScore} isRisk={false} />
              <RiskRow label="Social play"   value={score.socialScore}     isRisk={false} />
              <RiskRow label="Learning"      value={score.learningScore}   isRisk={false} />
            </div>
          </div>
        )}

        {/* Risks */}
        {score && (score.risksNarrative || score.dopamineTrapScore != null) && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 space-y-3">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">What to watch out for</h2>
            {score.risksNarrative && (
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{score.risksNarrative}</p>
            )}
            <div className="space-y-2 pt-1">
              <RiskRow label="Dopamine traps"   value={score.dopamineTrapScore} />
              <RiskRow label="Toxicity"         value={score.toxicityScore} />
              <RiskRow label="UGC content risk" value={score.ugcContentRisk} />
              <RiskRow label="Stranger risk"    value={score.strangerRisk} />
              <RiskRow label="Robux pressure"   value={score.monetizationScore} />
              <RiskRow label="Privacy risk"     value={score.privacyRisk} />
            </div>
          </div>
        )}

        {/* Parent tip */}
        {score?.parentTip && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-1">Parent tip</p>
            <p className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">{score.parentTip}</p>
          </div>
        )}

        {/* No score yet */}
        {!score && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-8 text-center text-slate-400">
            <p className="font-medium">Rating in progress</p>
            <p className="text-xs mt-1">Our AI is evaluating this experience. Check back soon.</p>
          </div>
        )}

        {/* Back link */}
        <Link
          href="/game/roblox"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          ← Back to Roblox hub
        </Link>
      </main>
    </div>
  )
}
