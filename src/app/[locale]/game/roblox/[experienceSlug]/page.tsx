export const revalidate = 3600

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'

type Props = { params: Promise<{ experienceSlug: string }> }

// ─── Helpers (mirrors GameCard palette) ──────────────────────────────────────

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

function formatCount(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ─── Horseshoe ring (pure SVG — server-safe) ──────────────────────────────────

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

// ─── CategoryBar — benefit (mirrors GameCard) ─────────────────────────────────

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

// ─── RiskMeter — risk (mirrors GameCard) ──────────────────────────────────────

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
  const { experienceSlug } = await params
  const [exp] = await db
    .select({ title: platformExperiences.title, description: platformExperiences.description, thumbnailUrl: platformExperiences.thumbnailUrl })
    .from(platformExperiences)
    .where(eq(platformExperiences.slug, experienceSlug))
    .limit(1)

  if (!exp) return { title: 'Experience not found — LumiKin' }

  const title = `${exp.title} on Roblox — Safe for kids? | LumiKin`
  const desc = exp.description
    ? exp.description.slice(0, 155) + (exp.description.length > 155 ? '…' : '')
    : `LumiKin safety rating for ${exp.title} on Roblox — benefits, risks, and screen time guidance for parents.`
  const canonical = `/game/roblox/${experienceSlug}`

  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      images: exp.thumbnailUrl
        ? [{ url: exp.thumbnailUrl, width: 512, height: 512, alt: `${exp.title} on Roblox` }]
        : undefined,
      type: 'website',
    },
    twitter: {
      card: exp.thumbnailUrl ? 'summary_large_image' : 'summary',
      title,
      description: desc,
      images: exp.thumbnailUrl ? [exp.thumbnailUrl] : undefined,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ExperiencePage({ params }: Props) {
  const [{ experienceSlug }, t, locale] = await Promise.all([params, getTranslations('roblox'), getLocale()])
  const [exp] = await db
    .select()
    .from(platformExperiences)
    .where(eq(platformExperiences.slug, experienceSlug))
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
          <Link href={`/${locale}/game/roblox`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Roblox</Link>
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
                  <p className="text-sm text-slate-400 mt-0.5">by {exp.creatorName}</p>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-400 dark:text-slate-500">
                  {exp.activePlayers != null && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      {formatCount(exp.activePlayers)} playing now
                    </span>
                  )}
                  {exp.visitCount != null && <span>{formatCount(exp.visitCount)} visits</span>}
                  {exp.genre && <span>{exp.genre}</span>}
                  {exp.maxPlayers != null && <span>Up to {exp.maxPlayers}/server</span>}
                </div>

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
              <BenefitBar label={t('creativity')}  value={score.creativityScore} />
              <BenefitBar label={t('socialPlay')}  value={score.socialScore} />
              <BenefitBar label={t('learning')}    value={score.learningScore} />
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

        {/* ── Roblox platform parent guide ───────────────────────────────────── */}
        <details className="group/panel">
          <summary className="flex items-center justify-between gap-2 cursor-pointer list-none select-none py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <span className="flex items-center gap-1.5">
              <span className="text-red-400">ℹ</span>
              Roblox parent guide
            </span>
            <span className="transition-transform group-open/panel:rotate-180 text-slate-300 dark:text-slate-600">▾</span>
          </summary>
          <div className="mt-2 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/30 px-4 py-3 text-xs text-slate-600 dark:text-slate-400 space-y-2.5 leading-relaxed">
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wide">Bottom line first</p>
            <p><strong className="text-slate-700 dark:text-slate-200">By default, Roblox allows unfiltered chat and friend requests from strangers.</strong> Enable Account Restrictions immediately — it takes 2 minutes and makes the platform significantly safer for children under 13.</p>
            <p><strong className="text-slate-700 dark:text-slate-200">Roblox is a platform of 40 million+ user-made games</strong>, not a single game. Quality, safety, and age-appropriateness vary dramatically between experiences. The LumiKin ratings above reflect individual experiences — the platform itself does not guarantee safety.</p>
            <p><strong className="text-slate-700 dark:text-slate-200">Robux is the in-game currency</strong> used across most popular experiences. Many games are designed around Robux spending — pay-to-win mechanics, exclusive cosmetics, and social comparison of avatar items are common. Set a clear spending policy before your child encounters the first purchase prompt.</p>
            <p><strong className="text-slate-700 dark:text-slate-200">The chat filter is imperfect.</strong> Children regularly find workarounds (number substitutions, deliberate misspellings). Monitor chat history periodically using the Parent PIN tools, and have an open conversation about what to do if someone says something uncomfortable.</p>
            <p className="pt-0.5 border-t border-red-100 dark:border-red-900/40 text-slate-500 dark:text-slate-400">
              <strong className="text-slate-600 dark:text-slate-300">Action:</strong> Roblox settings → Privacy → Account Restrictions (ON). This restricts chat, friend requests, and game access to a pre-screened age-appropriate set. Set a Parent PIN to prevent your child from disabling it.
            </p>
          </div>
        </details>

        <Link
          href={`/${locale}/game/roblox`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          {t('backToRoblox')}
        </Link>

      </main>
    </div>
  )
}
