export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'

type Props = { params: Promise<{ mapSlug: string }> }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number | null, max = 1) { return `${Math.round(((v ?? 0) / max) * 100)}%` }

function getVerdict(score: number | null) {
  const s = score ?? 0
  if (s >= 70) return { label: 'GREAT',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30',  ring: '#10b981' }
  if (s >= 50) return { label: 'GOOD',    color: 'text-teal-600 dark:text-teal-400',       bg: 'bg-teal-50 dark:bg-teal-900/30',        ring: '#14b8a6' }
  if (s >= 35) return { label: 'CAUTION', color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/30',      ring: '#f59e0b' }
  return              { label: 'AVOID',   color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-900/30',          ring: '#ef4444' }
}

function benefitBarColor(v: number, max = 3) {
  const f = v / max
  if (f >= 0.67) return 'bg-emerald-400'
  if (f >= 0.34) return 'bg-blue-400'
  return 'bg-slate-300 dark:bg-slate-600'
}

function riskBarColor(v: number, max = 3) {
  const f = v / max
  if (f >= 0.67) return 'bg-red-600'
  if (f >= 0.34) return 'bg-orange-500'
  return 'bg-yellow-400'
}

function riskLevel(v: number, max = 3) {
  const f = v / max
  if (f < 0.34) return { label: 'Low',      cls: 'bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200' }
  if (f < 0.67) return { label: 'Moderate', cls: 'bg-orange-100 dark:bg-orange-900/50 border border-orange-300 dark:border-orange-600 text-orange-800 dark:text-orange-200' }
  return               { label: 'High',     cls: 'bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-600 text-red-800 dark:text-red-200' }
}

// ─── Horseshoe ring ───────────────────────────────────────────────────────────

function HorseshoeRing({ score, ring }: { score: number; ring: string }) {
  const size = 160, cx = 80, cy = 80, r = 62, stroke = 12
  const circ = 2 * Math.PI * r
  const totalArc = (270 / 360) * circ
  const gap = circ - totalArc
  const filled = (score / 100) * totalArc
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(135deg)' }} aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor"
          className="text-slate-200 dark:text-slate-700"
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${totalArc} ${gap}`} />
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={ring} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-4">
        <span className="text-5xl font-black tracking-tighter leading-none" style={{ color: ring }}>{score}</span>
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1">/ 100</span>
      </div>
    </div>
  )
}

// ─── BenefitBar ───────────────────────────────────────────────────────────────

function BenefitBar({ label, value, max = 3 }: { label: string; value: number | null; max?: number }) {
  const v = value ?? 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-slate-600 dark:text-slate-300 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${benefitBarColor(v, max)}`} style={{ width: pct(v, max) }} />
      </div>
      <span className="w-10 text-right text-xs font-medium text-slate-700 dark:text-slate-300 shrink-0">{v}/{max}</span>
    </div>
  )
}

// ─── RiskMeter ────────────────────────────────────────────────────────────────

function RiskMeter({ label, value, max = 3 }: { label: string; value: number | null; max?: number }) {
  const v = value ?? 0
  const level = riskLevel(v, max)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${level.cls}`}>{level.label}</span>
      </div>
      <div className="bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${riskBarColor(v, max)}`} style={{ width: pct(v, max) }} />
      </div>
    </div>
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mapSlug } = await params
  const [exp] = await db
    .select({ title: platformExperiences.title, description: platformExperiences.description, thumbnailUrl: platformExperiences.thumbnailUrl })
    .from(platformExperiences)
    .where(eq(platformExperiences.slug, mapSlug))
    .limit(1)

  if (!exp) return { title: 'Map not found — LumiKin' }

  return {
    title: `${exp.title} (Fortnite Creative) — LumiKin`,
    description: exp.description?.slice(0, 160) ?? `LumiKin safety rating for ${exp.title} on Fortnite Creative.`,
    openGraph: exp.thumbnailUrl ? { images: [exp.thumbnailUrl] } : undefined,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FortniteMapPage({ params }: Props) {
  const [{ mapSlug }, t, locale] = await Promise.all([params, getTranslations('fortnite'), getLocale()])
  const [exp] = await db
    .select()
    .from(platformExperiences)
    .where(eq(platformExperiences.slug, mapSlug))
    .limit(1)

  if (!exp) notFound()

  const [score] = await db
    .select()
    .from(experienceScores)
    .where(eq(experienceScores.experienceId, exp.id))
    .limit(1)

  const verdict = score?.curascore != null ? getVerdict(score.curascore) : null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Breadcrumb */}
        <nav className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          <Link href={`/${locale}/game/fortnite-creative`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Fortnite Creative
          </Link>
          <span>/</span>
          <span className="text-slate-600 dark:text-slate-300 truncate">{exp.title}</span>
        </nav>

        {/* ── Hero card ──────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {exp.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={exp.thumbnailUrl} alt="" className="w-full h-40 object-cover" />
          )}
          <div className="px-5 py-5">
            <div className="flex items-start gap-5">
              {/* Score ring */}
              {score?.curascore != null && verdict && (
                <div className="shrink-0 -mt-1">
                  <HorseshoeRing score={score.curascore} ring={verdict.ring} />
                  <p className={`text-center text-sm font-black -mt-3 ${verdict.color}`}>{verdict.label}</p>
                </div>
              )}

              <div className="flex-1 min-w-0 pt-1">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{exp.title}</h1>
                {exp.creatorName && (
                  <p className="text-sm text-slate-400 mt-0.5">{t('mapBy', { creator: exp.creatorName })}</p>
                )}

                {/* Island code */}
                {exp.placeId && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500">{t('islandCode')}:</span>
                    <code className="text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                      {exp.placeId}
                    </code>
                  </div>
                )}

                {/* Genre */}
                {exp.genre && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 px-2 py-0.5 rounded-full">
                      {exp.genre}
                    </span>
                  </div>
                )}

                {/* Time recommendation */}
                {score?.timeRecommendationLabel && (
                  <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold ${
                    score.timeRecommendationColor === 'green'  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' :
                    score.timeRecommendationColor === 'amber'  ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' :
                                                                 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                  }`}>
                    <span>Recommended: {score.timeRecommendationLabel}</span>
                    {score.recommendedMinAge != null && (
                      <span className="text-xs font-normal opacity-70">· Age {score.recommendedMinAge}+</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Summary ────────────────────────────────────────────────────────── */}
        {score?.summary && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">"{score.summary}"</p>
          </div>
        )}

        {/* ── Benefits ───────────────────────────────────────────────────────── */}
        {score && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {t('whatChildDevelops')}
            </h2>

            <div className="space-y-3">
              <BenefitBar label={t('creativity')} value={score.creativityScore} />
              <BenefitBar label={t('socialPlay')} value={score.socialScore} />
              <BenefitBar label={t('learning')}   value={score.learningScore} />
            </div>

            {score.benefitsNarrative && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 mt-2">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1">{t('whatChildDevelops')}</p>
                <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">{score.benefitsNarrative}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Risks ──────────────────────────────────────────────────────────── */}
        {score && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {t('watchOutFor')}
            </h2>

            <div className="space-y-4">
              <RiskMeter label={t('dopamineTraps')} value={score.dopamineTrapScore} />
              <RiskMeter label={t('toxicity')}      value={score.toxicityScore} />
              <RiskMeter label={t('ugcRisk')}       value={score.ugcContentRisk} />
              <RiskMeter label={t('strangerRisk')}  value={score.strangerRisk} />
              <RiskMeter label={t('monetization')}  value={score.monetizationScore} />
              <RiskMeter label={t('privacyRisk')}   value={score.privacyRisk} />
            </div>

            {score.risksNarrative && (
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 mt-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">{t('watchOutFor')}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{score.risksNarrative}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Parent tip ─────────────────────────────────────────────────────── */}
        {score?.parentTip && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-5 py-4">
            <p className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 mb-1">{t('parentTip')}</p>
            <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed">{score.parentTip}</p>
          </div>
        )}

        {/* ── No score yet ───────────────────────────────────────────────────── */}
        {!score && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-8 text-center text-slate-400">
            <p className="font-medium">{t('ratingInProgress')}</p>
            <p className="text-xs mt-1">{t('ratingInProgressDesc')}</p>
          </div>
        )}

        <Link
          href={`/${locale}/game/fortnite-creative`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          {t('backToFortnite')}
        </Link>

      </main>
    </div>
  )
}
