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

type Props = { params: Promise<{ locale: string; mapSlug: string }> }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number | null, max = 1) { return `${Math.round(((v ?? 0) / max) * 100)}%` }

function getVerdict(score: number | null) {
  const s = score ?? 0
  if (s >= 70) return { labelKey: 'verdictGreat',   color: 'text-ivy',    bg: '',  ring: 'rgb(var(--ivy))' }
  if (s >= 50) return { labelKey: 'verdictGood',    color: 'text-ivy',    bg: '',  ring: 'rgb(var(--ivy))' }
  if (s >= 35) return { labelKey: 'verdictCaution', color: 'text-warm',   bg: '',  ring: 'rgb(var(--warm))' }
  return              { labelKey: 'verdictAvoid',   color: 'text-accent', bg: '',  ring: 'rgb(var(--accent))' }
}

function benefitBarColor(v: number, max = 3) {
  const f = v / max
  if (f >= 0.67) return 'bg-ivy'
  if (f >= 0.34) return 'bg-ivy/60'
  return 'bg-rule'
}

function riskBarColor(v: number, max = 3) {
  const f = v / max
  if (f >= 0.67) return 'bg-accent'
  if (f >= 0.34) return 'bg-warm'
  return 'bg-warm/50'
}

function riskLevel(v: number, max = 3) {
  const f = v / max
  if (f < 0.34) return { labelKey: 'riskLow',      cls: 'border border-rule text-muted' }
  if (f < 0.67) return { labelKey: 'riskModerate', cls: 'border border-warm text-warm' }
  return               { labelKey: 'riskHigh',     cls: 'border border-accent text-accent' }
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
          className="text-rule/50"
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${totalArc} ${gap}`} />
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={ring} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-4">
        <span className="font-serif text-5xl tracking-tighter leading-none" style={{ color: ring }}>{score}</span>
        <span className="text-xs font-bold text-muted mt-1">/ 100</span>
      </div>
    </div>
  )
}

// ─── BenefitBar ───────────────────────────────────────────────────────────────

function BenefitBar({ label, value, max = 3 }: { label: string; value: number | null; max?: number }) {
  const v = value ?? 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-ink/80 shrink-0">{label}</span>
      <div className="flex-1 bg-rule/30 h-2.5 overflow-hidden">
        <div className={`h-full transition-all ${benefitBarColor(v, max)}`} style={{ width: pct(v, max) }} />
      </div>
      <span className="w-10 text-right text-xs font-medium text-ink/80 shrink-0">{v}/{max}</span>
    </div>
  )
}

// ─── RiskMeter ────────────────────────────────────────────────────────────────

function RiskMeter({ label, levelLabel, value, max = 3 }: { label: string; levelLabel: string; value: number | null; max?: number }) {
  const v = value ?? 0
  const level = riskLevel(v, max)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink/80">{label}</span>
        <span className={`text-kicker uppercase font-semibold px-2.5 py-0.5 shrink-0 ${level.cls}`} style={{ fontVariantCaps: 'all-small-caps' }}>{levelLabel}</span>
      </div>
      <div className="bg-rule/30 h-3 overflow-hidden">
        <div className={`h-full transition-all ${riskBarColor(v, max)}`} style={{ width: pct(v, max) }} />
      </div>
    </div>
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

const LOCALES = ['en', 'es', 'fr', 'sv', 'de'] as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mapSlug, locale } = await params
  const [exp] = await db
    .select({
      id: platformExperiences.id,
      title: platformExperiences.title,
      description: platformExperiences.description,
      thumbnailUrl: platformExperiences.thumbnailUrl,
    })
    .from(platformExperiences)
    .where(eq(platformExperiences.slug, mapSlug))
    .limit(1)
    .catch(() => [])

  if (!exp) {
    const t = await getTranslations({ locale, namespace: 'fortnite' })
    return { title: t('mapNotFound') }
  }

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

  // Localized verdict-led title/desc. See roblox/[experienceSlug]/page.tsx
  // for the matching pattern.
  const tMeta = await getTranslations({ locale, namespace: 'fortnite' })

  let title: string
  let desc: string

  if (showVerdict) {
    const verdictKey =
        score!.curascore! >= 70 ? 'metaVerdictGreat'
      : score!.curascore! >= 50 ? 'metaVerdictGood'
      : score!.curascore! >= 35 ? 'metaVerdictCaution'
      :                            'metaVerdictAvoid'
    const verdict = tMeta(verdictKey)

    const parts = [
      `LumiScore ${score!.curascore}/100`,
      score!.recommendedMinAge != null ? tMeta('metaAgeSuffix', { age: score!.recommendedMinAge }) : null,
      score!.timeRecommendationLabel ?? null,
    ].filter(Boolean).join(' · ')

    title = tMeta('metaTitleVerdict', { title: exp.title, verdict, score: score!.curascore! })
    desc  = tMeta('metaDescVerdict',  { parts, title: exp.title })
  } else {
    title = `${exp.title} (Fortnite Creative) — Safe for kids? | LumiKin`
    desc = exp.description
      ? exp.description.slice(0, 155) + (exp.description.length > 155 ? '…' : '')
      : `LumiKin safety rating for ${exp.title} on Fortnite Creative — benefits, risks, and screen time guidance for parents.`
  }
  const canonical = `/${locale}/game/fortnite-creative/${mapSlug}`

  return {
    title,
    description: desc,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(LOCALES.map(l => [l, `/${l}/game/fortnite-creative/${mapSlug}`])),
        'x-default': `/en/game/fortnite-creative/${mapSlug}`,
      },
    },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      images: exp.thumbnailUrl
        ? [{ url: exp.thumbnailUrl, width: 512, height: 512, alt: `${exp.title} — Fortnite Creative` }]
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

export default async function FortniteMapPage({ params }: Props) {
  const [{ mapSlug }, t, locale] = await Promise.all([params, getTranslations('fortnite'), getLocale()])
  const [exp] = await db
    .select()
    .from(platformExperiences)
    .where(eq(platformExperiences.slug, mapSlug))
    .limit(1)
    .catch(() => [])

  if (!exp || !exp.isPublic) notFound()

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

  // Low-confidence rows hide the score on the detail page too, matching the
  // greyscale treatment on cards. We still render the page (title, thumb,
  // tagline) so parents see what the island is — just without a wonky number.
  const isPending = (score?.inputConfidence ?? 0) < CONFIDENCE_THRESHOLD
  let displayScore = score && !isPending ? score : null
  const verdict = displayScore?.curascore != null ? getVerdict(displayScore.curascore) : null
  const riskLabelFor = (v: number | null) => t(riskLevel(v ?? 0).labelKey)

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
  const canonicalUrl = `${SITE_URL}/en/game/fortnite-creative/${exp.slug}`

  const videoGameLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: exp.title,
    description: exp.description ?? exp.tagline ?? undefined,
    publisher: exp.creatorName ? { '@type': 'Organization', name: exp.creatorName } : undefined,
    gamePlatform: 'Fortnite',
    genre: exp.genre ?? undefined,
    contentRating: exp.ageRating ?? undefined,
    image: exp.thumbnailUrl ?? undefined,
    url: canonicalUrl,
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',              item: `${SITE_URL}/${locale}` },
      { '@type': 'ListItem', position: 2, name: 'Browse',            item: `${SITE_URL}/${locale}/browse` },
      { '@type': 'ListItem', position: 3, name: 'Fortnite Creative', item: `${SITE_URL}/${locale}/game/fortnite-creative` },
      { '@type': 'ListItem', position: 4, name: exp.title,           item: canonicalUrl },
    ],
  }

  const reviewBodyRaw = displayScore?.summary
    ?? (displayScore?.curascore != null
      ? `${exp.title} received a LumiScore of ${displayScore.curascore}/100 on Fortnite Creative.${displayScore.timeRecommendationLabel ? ` Recommended play time: ${displayScore.timeRecommendationLabel}.` : ''}`
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
      gamePlatform: 'Fortnite',
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

  // Per-map FAQ block (visible Q&A + FAQPage JSON-LD) is rendered by
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
    <div className="min-h-screen bg-paper text-ink">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Breadcrumb */}
        <nav className="text-kicker uppercase text-muted flex items-center gap-1.5" style={{ fontVariantCaps: 'all-small-caps' }}>
          <Link href={`/${locale}/game/fortnite-creative`} className="hover:text-accent transition-colors">
            {t('breadcrumbHub')}
          </Link>
          <span className="text-rule">/</span>
          <span className="text-ink truncate">{exp.title}</span>
        </nav>

        {/* ── Hero card ──────────────────────────────────────────────────────── */}
        <div className="border border-rule overflow-hidden">
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
                  <p className={`text-center text-sm font-black -mt-3 ${verdict.color}`}>{t(verdict.labelKey)}</p>
                </div>
              )}

              <div className="flex-1 min-w-0 pt-1">
                <h1 className="font-serif text-2xl text-ink leading-tight">{exp.title}</h1>
                {exp.creatorName && (
                  <p className="text-sm text-muted mt-0.5">{t('mapBy', { creator: exp.creatorName })}</p>
                )}

                {/* Island code */}
                {exp.placeId && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted">{t('islandCode')}:</span>
                    <code className="text-xs font-mono bg-ink/5 text-ink px-2 py-0.5">
                      {exp.placeId}
                    </code>
                  </div>
                )}

                {/* Genre */}
                {exp.genre && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-kicker uppercase text-muted border border-rule px-2 py-0.5" style={{ fontVariantCaps: 'all-small-caps' }}>
                      {exp.genre}
                    </span>
                  </div>
                )}

                {/* Time recommendation */}
                {displayScore?.timeRecommendationLabel && (
                  <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 border text-sm font-semibold ${
                    displayScore.timeRecommendationColor === 'green'  ? 'border-ivy text-ivy' :
                    displayScore.timeRecommendationColor === 'amber'  ? 'border-warm text-warm' :
                                                                        'border-accent text-accent'
                  }`}>
                    <span>{t('recommendedPrefix', { label: displayScore.timeRecommendationLabel })}</span>
                    {displayScore.recommendedMinAge != null && (
                      <span className="text-xs font-normal opacity-70">· {t('ageSuffix', { age: displayScore.recommendedMinAge })}</span>
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
          <div className="border-l-2 border-accent pl-4 py-1">
            <p className="font-serif text-base text-ink leading-relaxed italic">"{displayScore.summary}"</p>
          </div>
        )}

        {/* ── Benefits ───────────────────────────────────────────────────────── */}
        {displayScore && (
          <div className="border border-rule px-5 py-5 space-y-4">
            <h2 className="text-kicker uppercase font-semibold text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
              {t('whatChildDevelops')}
            </h2>

            <div className="space-y-3">
              <BenefitBar label={t('creativity')} value={displayScore.creativityScore} />
              <BenefitBar label={t('socialPlay')} value={displayScore.socialScore} />
              <BenefitBar label={t('learning')}   value={displayScore.learningScore} />
            </div>

            {displayScore.benefitsNarrative && (
              <div className="border-l-2 border-ivy pl-4 py-1 mt-2">
                <p className="text-kicker uppercase font-semibold text-ivy mb-1" style={{ fontVariantCaps: 'all-small-caps' }}>{t('whatChildDevelops')}</p>
                <p className="text-sm text-ink/85 leading-relaxed">{displayScore.benefitsNarrative}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Risks ──────────────────────────────────────────────────────────── */}
        {displayScore && (
          <div className="border border-rule px-5 py-5 space-y-4">
            <h2 className="text-kicker uppercase font-semibold text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
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
              <div className="border-l-2 border-warm pl-4 py-1 mt-2">
                <p className="text-kicker uppercase font-semibold text-warm mb-1" style={{ fontVariantCaps: 'all-small-caps' }}>{t('watchOutFor')}</p>
                <p className="text-sm text-ink/85 leading-relaxed">{displayScore.risksNarrative}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Scoring method note (Fix 8) ────────────────────────────────────── */}
        {displayScore && (
          <p className="text-[11px] text-muted leading-relaxed px-1">
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
            platformContext="Fortnite Creative"
            locale={locale}
          />
        )}

        {/* ── Parent tip ─────────────────────────────────────────────────────── */}
        {displayScore?.parentTip && (
          <div className="border-l-2 border-accent pl-4 py-1">
            <p className="text-kicker uppercase font-semibold text-accent mb-1" style={{ fontVariantCaps: 'all-small-caps' }}>{t('parentTip')}</p>
            <p className="font-serif text-sm text-ink/85 leading-relaxed italic">{displayScore.parentTip}</p>
          </div>
        )}

        {/* ── No score / pending ─────────────────────────────────────────────── */}
        {!displayScore && (
          <div className="border border-rule px-5 py-8 text-center text-muted">
            <p className="font-serif text-ink">
              {isPending ? 'Not enough info to rate' : t('ratingInProgress')}
            </p>
            <p className="text-xs mt-1">
              {isPending
                ? "This island doesn't yet have enough public info for us to rate it confidently. We'll update as more data arrives."
                : t('ratingInProgressDesc')}
            </p>
          </div>
        )}

        {/* ── Fortnite platform parent guide ─────────────────────────────────── */}
        <details className="group/panel">
          <summary className="flex items-center justify-between gap-2 cursor-pointer list-none select-none py-2 text-kicker uppercase font-semibold text-muted hover:text-ink transition-colors" style={{ fontVariantCaps: 'all-small-caps' }}>
            <span className="flex items-center gap-1.5">
              <span className="text-accent">ℹ</span>
              {t('parentGuideTitle')}
            </span>
            <span className="transition-transform group-open/panel:rotate-180 text-rule">▾</span>
          </summary>
          <div className="mt-2 border-l-2 border-rule pl-4 py-1 text-xs text-ink/70 space-y-2.5 leading-relaxed">
            <p className="font-semibold text-ink text-[11px] uppercase tracking-wide">{t('parentGuideBottomLine')}</p>
            <p>{t.rich('parentGuidePara1', { strong: (chunks) => <strong className="text-ink">{chunks}</strong> })}</p>
            <p>{t.rich('parentGuidePara2', { strong: (chunks) => <strong className="text-ink">{chunks}</strong> })}</p>
            <p>{t.rich('parentGuidePara3', { strong: (chunks) => <strong className="text-ink">{chunks}</strong> })}</p>
            <p>{t.rich('parentGuidePara4', { strong: (chunks) => <strong className="text-ink">{chunks}</strong> })}</p>
            <p className="pt-0.5 border-t border-rule/60 text-muted">
              {t.rich('parentGuideAction', { strong: (chunks) => <strong className="text-ink">{chunks}</strong> })}
            </p>
          </div>
        </details>

        <Link
          href={`/${locale}/game/fortnite-creative`}
          className="inline-flex items-center gap-1.5 text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {t('backToFortnite')}
        </Link>

      </main>
    </div>
    </>
  )
}
