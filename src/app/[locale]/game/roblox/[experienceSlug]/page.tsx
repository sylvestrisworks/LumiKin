export const revalidate = 3600

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores, experienceTranslations, games } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import UgcAttributionBlock from '@/components/UgcAttributionBlock'
import GameFAQ from '@/components/GameFAQ'
import { RUBRIC_DIMENSION_COUNT } from '@/lib/methodology'
import { CONFIDENCE_THRESHOLD } from '@/lib/scoring/experience-risk'

type Props = { params: Promise<{ locale: string; experienceSlug: string }> }

// ─── Helpers (mirrors GameCard palette) ──────────────────────────────────────

function pct(v: number | null, max = 1) { return `${Math.round(((v ?? 0) / max) * 100)}%` }

function getVerdict(score: number | null) {
  const s = score ?? 0
  if (s >= 70) return { labelKey: 'verdictGreat',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30',  ring: '#10b981' }
  if (s >= 50) return { labelKey: 'verdictGood',    color: 'text-teal-600 dark:text-teal-400',       bg: 'bg-teal-50 dark:bg-teal-900/30',        ring: '#14b8a6' }
  if (s >= 35) return { labelKey: 'verdictCaution', color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/30',      ring: '#f59e0b' }
  return              { labelKey: 'verdictAvoid',   color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-900/30',          ring: '#ef4444' }
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
  if (f < 0.34) return { labelKey: 'riskLow',      cls: 'bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200' }
  if (f < 0.67) return { labelKey: 'riskModerate', cls: 'bg-orange-100 dark:bg-orange-900/50 border border-orange-300 dark:border-orange-600 text-orange-800 dark:text-orange-200' }
  return               { labelKey: 'riskHigh',     cls: 'bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-600 text-red-800 dark:text-red-200' }
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

function RiskMeter({ label, levelLabel, value, max = 3 }: { label: string; levelLabel: string; value: number | null; max?: number }) {
  const v = value ?? 0
  const level = riskLevel(v, max)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${level.cls}`}>{levelLabel}</span>
      </div>
      <div className="bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${riskBarColor(v, max)}`} style={{ width: pct(v, max) }} />
      </div>
    </div>
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

const LOCALES = ['en', 'es', 'fr', 'sv', 'de'] as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { experienceSlug, locale } = await params
  const [exp] = await db
    .select({
      id: platformExperiences.id,
      title: platformExperiences.title,
      description: platformExperiences.description,
      thumbnailUrl: platformExperiences.thumbnailUrl,
    })
    .from(platformExperiences)
    .where(eq(platformExperiences.slug, experienceSlug))
    .limit(1)
    .catch(() => [])

  if (!exp) {
    const tFallback = await getTranslations({ locale, namespace: 'roblox' })
    return { title: tFallback('experienceNotFound') }
  }

  // Score lookup gates verdict-led title/desc. Mirrors the page-component
  // confidence gate: low-confidence rows don't surface a number anywhere.
  const [score] = await db
    .select({
      curascore: experienceScores.curascore,
      recommendedMinAge: experienceScores.recommendedMinAge,
      timeRecommendationLabel: experienceScores.timeRecommendationLabel,
      inputConfidence: experienceScores.inputConfidence,
    })
    .from(experienceScores)
    .where(eq(experienceScores.experienceId, exp.id))
    .limit(1)
    .catch(() => [])

  const showVerdict = score?.curascore != null
    && (score.inputConfidence ?? 0) >= CONFIDENCE_THRESHOLD

  // Localized verdict-led title/desc. Falls back to the non-verdict pattern
  // when no score (or low-confidence). Verdict word + templates live in
  // messages/<locale>.json under roblox.metaVerdict*/metaTitleVerdict/etc.
  const t = await getTranslations({ locale, namespace: 'roblox' })

  let title: string
  let desc: string

  if (showVerdict) {
    const verdictKey =
        score!.curascore! >= 70 ? 'metaVerdictGreat'
      : score!.curascore! >= 50 ? 'metaVerdictGood'
      : score!.curascore! >= 35 ? 'metaVerdictCaution'
      :                            'metaVerdictAvoid'
    const verdict = t(verdictKey)

    const parts = [
      `LumiScore ${score!.curascore}/100`,
      score!.recommendedMinAge != null ? t('metaAgeSuffix', { age: score!.recommendedMinAge }) : null,
      score!.timeRecommendationLabel ?? null,
    ].filter(Boolean).join(' · ')

    title = t('metaTitleVerdict', { title: exp.title, verdict, score: score!.curascore! })
    desc  = t('metaDescVerdict',  { parts, title: exp.title })
  } else {
    title = t('metaTitleFallback', { title: exp.title })
    desc = exp.description
      ? exp.description.slice(0, 155) + (exp.description.length > 155 ? '…' : '')
      : t('metaDescFallback', { title: exp.title })
  }
  const canonical = `/${locale}/game/roblox/${experienceSlug}`

  return {
    title,
    description: desc,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(LOCALES.map(l => [l, `/${l}/game/roblox/${experienceSlug}`])),
        'x-default': `/en/game/roblox/${experienceSlug}`,
      },
    },
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
  const [{ experienceSlug }, t, tCommon, tGame, locale] = await Promise.all([
    params,
    getTranslations('roblox'),
    getTranslations('common'),
    getTranslations('game'),
    getLocale(),
  ])
  const riskLabelFor = (v: number | null) => t(riskLevel(v ?? 0).labelKey as 'riskLow' | 'riskModerate' | 'riskHigh')
  const [exp] = await db
    .select()
    .from(platformExperiences)
    .where(eq(platformExperiences.slug, experienceSlug))
    .limit(1)
    .catch(() => [])

  if (!exp) notFound()

  const [[score], [parentPlatform]] = await Promise.all([
    db.select()
      .from(experienceScores)
      .where(eq(experienceScores.experienceId, exp.id))
      .limit(1)
      .catch(() => []),
    db.select({
        slug:        games.slug,
        title:       games.title,
        esrbRating:  games.esrbRating,
        pegiRating:  games.pegiRating,
      })
      .from(games)
      .where(eq(games.id, exp.platformId))
      .limit(1)
      .catch(() => []),
  ])

  // See fortnite-creative/[mapSlug]/page.tsx — same isPending gating.
  const isPending = (score?.inputConfidence ?? 0) < CONFIDENCE_THRESHOLD
  let displayScore = score && !isPending ? score : null
  const verdict = displayScore?.curascore != null ? getVerdict(displayScore.curascore) : null

  // Overlay localized narrative fields when locale is not English.
  if (displayScore && locale !== 'en') {
    try {
      const [tx] = await db
        .select()
        .from(experienceTranslations)
        .where(and(
          eq(experienceTranslations.experienceId, exp.id),
          eq(experienceTranslations.locale, locale),
        ))
        .limit(1)
      if (tx) {
        displayScore = {
          ...displayScore,
          summary:           tx.summary           ?? displayScore.summary,
          benefitsNarrative: tx.benefitsNarrative ?? displayScore.benefitsNarrative,
          risksNarrative:    tx.risksNarrative    ?? displayScore.risksNarrative,
          parentTip:         tx.parentTip         ?? displayScore.parentTip,
        }
      }
    } catch {
      // experience_translations missing — skip
    }
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
  const canonicalUrl = `${SITE_URL}/en/game/roblox/${exp.slug}`

  const videoGameLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: exp.title,
    description: exp.description ?? undefined,
    publisher: exp.creatorName ? { '@type': 'Organization', name: exp.creatorName } : undefined,
    gamePlatform: 'Roblox',
    genre: exp.genre ?? undefined,
    image: exp.thumbnailUrl ?? undefined,
    url: canonicalUrl,
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: tGame('navHome'),   item: `${SITE_URL}/${locale}` },
      { '@type': 'ListItem', position: 2, name: tGame('navBrowse'), item: `${SITE_URL}/${locale}/browse` },
      { '@type': 'ListItem', position: 3, name: t('title'),         item: `${SITE_URL}/${locale}/game/roblox` },
      { '@type': 'ListItem', position: 4, name: exp.title,          item: canonicalUrl },
    ],
  }

  const reviewBodyRaw = displayScore?.summary
    ?? (displayScore?.curascore != null
      ? `${exp.title} received a LumiScore of ${displayScore.curascore}/100 on Roblox.${displayScore.timeRecommendationLabel ? ` Recommended play time: ${displayScore.timeRecommendationLabel}.` : ''}`
      : null)
  const reviewBody = reviewBodyRaw
    ? reviewBodyRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
    : null

  const reviewLd = displayScore?.curascore != null ? {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'VideoGame',
      name: exp.title,
      gamePlatform: 'Roblox',
      genre: exp.genre ?? undefined,
      publisher: exp.creatorName ? { '@type': 'Organization', name: exp.creatorName } : undefined,
    },
    author: {
      '@type': 'Organization',
      name: 'LumiKin',
      url: SITE_URL,
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: displayScore.curascore,
      bestRating: 100,
      worstRating: 0,
    },
    datePublished: displayScore.calculatedAt ? displayScore.calculatedAt.toISOString().slice(0, 10) : undefined,
    dateModified: (exp.updatedAt ?? displayScore.calculatedAt)?.toISOString().slice(0, 10),
    reviewBody: reviewBody ?? undefined,
    url: canonicalUrl,
  } : null

  // Per-experience FAQ block (visible Q&A + FAQPage JSON-LD) is rendered by
  // <GameFAQ /> below — locale-aware, uses experience_translations-overlaid
  // risksNarrative when present. Emits on every locale.

  const ldJson = (obj: unknown) =>
    JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(videoGameLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd) }} />
      {reviewLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(reviewLd) }} />
      )}
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Breadcrumb */}
        <nav className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          <Link href={`/${locale}/game/roblox`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t('title')}</Link>
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
              {displayScore?.curascore != null && verdict && (
                <div className="shrink-0 -mt-1">
                  <HorseshoeRing score={displayScore.curascore} ring={verdict.ring} />
                  <p className={`text-center text-sm font-black -mt-3 ${verdict.color}`}>{t(verdict.labelKey as 'verdictGreat' | 'verdictGood' | 'verdictCaution' | 'verdictAvoid')}</p>
                </div>
              )}

              <div className="flex-1 min-w-0 pt-1">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{exp.title}</h1>
                {exp.creatorName && (
                  <p className="text-sm text-slate-400 mt-0.5">{t('byCreator', { creator: exp.creatorName })}</p>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-400 dark:text-slate-500">
                  {exp.activePlayers != null && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      {t('playingNow', { count: formatCount(exp.activePlayers) })}
                    </span>
                  )}
                  {exp.visitCount != null && <span>{t('visits', { count: formatCount(exp.visitCount) })}</span>}
                  {exp.genre && <span>{exp.genre}</span>}
                  {exp.maxPlayers != null && <span>{t('upToPlayers', { count: exp.maxPlayers })}</span>}
                </div>

                {/* Time recommendation */}
                {displayScore?.timeRecommendationLabel && (
                  <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold ${
                    displayScore.timeRecommendationColor === 'green'  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' :
                    displayScore.timeRecommendationColor === 'amber'  ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' :
                                                                        'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                  }`}>
                    <span>{t('recommended', { label: displayScore.timeRecommendationLabel })}</span>
                    {displayScore.recommendedMinAge != null && (
                      <span className="text-xs font-normal opacity-70">· {t('age', { age: displayScore.recommendedMinAge })}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── UGC attribution ────────────────────────────────────────────────── */}
        {parentPlatform && (
          <UgcAttributionBlock
            locale={locale}
            platformName={parentPlatform.title}
            platformSlug={parentPlatform.slug}
            esrbRating={parentPlatform.esrbRating}
            pegiRating={parentPlatform.pegiRating}
            curascore={displayScore?.curascore ?? null}
          />
        )}

        {/* ── Summary ────────────────────────────────────────────────────────── */}
        {displayScore?.summary && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">"{displayScore.summary}"</p>
          </div>
        )}

        {/* ── Benefits ───────────────────────────────────────────────────────── */}
        {displayScore && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {t('whatChildDevelops')}
            </h2>

            <div className="space-y-3">
              <BenefitBar label={t('creativity')}  value={displayScore.creativityScore} />
              <BenefitBar label={t('socialPlay')}  value={displayScore.socialScore} />
              <BenefitBar label={t('learning')}    value={displayScore.learningScore} />
            </div>

            {displayScore.benefitsNarrative && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 mt-2">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1">{t('whatChildDevelops')}</p>
                <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">{displayScore.benefitsNarrative}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Risks ──────────────────────────────────────────────────────────── */}
        {displayScore && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {t('watchOutFor')}
            </h2>

            <div className="space-y-4">
              <RiskMeter label={t('dopamineTraps')} levelLabel={riskLabelFor(displayScore.dopamineTrapScore)} value={displayScore.dopamineTrapScore} />
              <RiskMeter label={t('toxicity')}      levelLabel={riskLabelFor(displayScore.toxicityScore)}     value={displayScore.toxicityScore} />
              <RiskMeter label={t('ugcRisk')}       levelLabel={riskLabelFor(displayScore.ugcContentRisk)}    value={displayScore.ugcContentRisk} />
              <RiskMeter label={t('strangerRisk')}  levelLabel={riskLabelFor(displayScore.strangerRisk)}      value={displayScore.strangerRisk} />
              <RiskMeter label={t('monetization')}  levelLabel={riskLabelFor(displayScore.monetizationScore)} value={displayScore.monetizationScore} />
              <RiskMeter label={t('privacyRisk')}   levelLabel={riskLabelFor(displayScore.privacyRisk)}       value={displayScore.privacyRisk} />
            </div>

            {displayScore.risksNarrative && (
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 mt-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">{t('watchOutFor')}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{displayScore.risksNarrative}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Scoring method note (Fix 8) ────────────────────────────────────── */}
        {displayScore && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed px-1">
            {t('scoringNote', { count: RUBRIC_DIMENSION_COUNT })}
          </p>
        )}

        {/* ── Parent-intent FAQ ──────────────────────────────────────────────── */}
        {displayScore?.curascore != null && (
          <GameFAQ
            title={exp.title}
            score={displayScore.curascore}
            recommendedMinAge={displayScore.recommendedMinAge ?? null}
            timeRecommendationLabel={displayScore.timeRecommendationLabel ?? null}
            risksNarrative={displayScore.risksNarrative ?? null}
            platformContext="Roblox"
            locale={locale}
          />
        )}

        {/* ── Parent tip ─────────────────────────────────────────────────────── */}
        {displayScore?.parentTip && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-5 py-4">
            <p className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 mb-1">{t('parentTip')}</p>
            <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed">{displayScore.parentTip}</p>
          </div>
        )}

        {/* ── No score / pending ─────────────────────────────────────────────── */}
        {!displayScore && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-8 text-center text-slate-500 dark:text-slate-400">
            <p className="font-medium">
              {isPending ? tCommon('notEnoughInfo') : t('ratingInProgress')}
            </p>
            <p className="text-xs mt-1">
              {isPending ? t('lowConfidenceLong') : t('ratingInProgressDesc')}
            </p>
          </div>
        )}

        {/* ── Roblox platform parent guide ───────────────────────────────────── */}
        <details className="group/panel">
          <summary className="flex items-center justify-between gap-2 cursor-pointer list-none select-none py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <span className="flex items-center gap-1.5">
              <span className="text-red-400">ℹ</span>
              {t('parentGuideTitle')}
            </span>
            <span className="transition-transform group-open/panel:rotate-180 text-slate-300 dark:text-slate-600">▾</span>
          </summary>
          <div className="mt-2 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/30 px-4 py-3 text-xs text-slate-600 dark:text-slate-400 space-y-2.5 leading-relaxed">
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wide">{t('parentGuideBottomLine')}</p>
            <p>{t.rich('parentGuidePara1', { strong: (chunks) => <strong className="text-slate-700 dark:text-slate-200">{chunks}</strong> })}</p>
            <p>{t.rich('parentGuidePara2', { strong: (chunks) => <strong className="text-slate-700 dark:text-slate-200">{chunks}</strong> })}</p>
            <p>{t.rich('parentGuidePara3', { strong: (chunks) => <strong className="text-slate-700 dark:text-slate-200">{chunks}</strong> })}</p>
            <p>{t.rich('parentGuidePara4', { strong: (chunks) => <strong className="text-slate-700 dark:text-slate-200">{chunks}</strong> })}</p>
            <p className="pt-0.5 border-t border-red-100 dark:border-red-900/40 text-slate-500 dark:text-slate-400">
              {t.rich('parentGuideAction', { strong: (chunks) => <strong className="text-slate-600 dark:text-slate-300">{chunks}</strong> })}
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
    </>
  )
}
