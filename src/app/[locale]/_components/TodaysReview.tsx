import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import {
  BigScore,
  ScoreTable,
  type ScoreRow,
} from '@/components/editorial'
import { fetchFeatured, type FeaturedGameData } from '../_data/featured'

function benefitRows(g: FeaturedGameData, labels: { cognitive: string; social: string; motor: string }): ScoreRow[] {
  return [
    { code: 'B1', label: labels.cognitive, value: g.cognitiveScore       ?? 0 },
    { code: 'B2', label: labels.social,    value: g.socialEmotionalScore ?? 0 },
    { code: 'B3', label: labels.motor,     value: g.motorScore           ?? 0 },
  ]
}

function riskRows(g: FeaturedGameData, labels: { dopamine: string; monetization: string; social: string }): ScoreRow[] {
  return [
    { code: 'R1', label: labels.dopamine,     value: g.dopamineRisk     ?? 0 },
    { code: 'R2', label: labels.monetization, value: g.monetizationRisk ?? 0 },
    { code: 'R3', label: labels.social,       value: g.socialRisk       ?? 0 },
  ]
}

// Lift the opening one-to-two sentences of the executive summary as a magazine
// pull-quote — the cue that a human read the game and formed a judgment.
function pullQuote(text: string | null, max = 200): string | null {
  if (!text) return null
  const trimmed = text.trim()
  let cut = trimmed
  let count = 0
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '.' && trimmed[i + 1] === ' ') {
      count++
      if (count === 2 || i + 1 >= max) { cut = trimmed.slice(0, i + 1); break }
    }
  }
  if (cut.length > max) cut = cut.slice(0, max - 1).trimEnd() + '…'
  return cut
}

function formatReviewDate(d: Date | null, locale: string): string | null {
  if (!d) return null
  return new Date(d)
    .toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
}

export default async function TodaysReview({ locale }: { locale: string }) {
  const [game, te, th] = await Promise.all([
    fetchFeatured(locale),
    getTranslations('editorial'),
    getTranslations('home'),
  ])
  if (!game) return null

  const tip = game.parentTipBenefits ?? game.parentTip
  const quote = pullQuote(game.executiveSummary)
  const reviewDate = formatReviewDate(game.reviewedAt, te('dateline.locale'))

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12 md:py-14">
        {/* Eyebrow — section header, small-caps, hairline-bounded above */}
        <div className="border-t border-ink pt-4 mb-10">
          <p
            className="text-kicker uppercase font-semibold text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {te('sections.todaysReview')}
          </p>
        </div>

        <Link
          href={`/${locale}/game/${game.slug}`}
          className="group block"
          aria-label={`${te('sections.todaysReview')} — ${game.title}`}
        >
          {/* Cover row: photo (md+ 7/12) + title block (md+ 5/12) */}
          <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-start">
            <div className="md:col-span-7 relative">
              <div className="aspect-[16/10] w-full bg-ink/10 overflow-hidden">
                {game.backgroundImage ? (
                  <Image
                    src={game.backgroundImage}
                    alt={`${game.title} — today's LumiKin review`}
                    width={1200}
                    height={750}
                    className="w-full h-full object-cover"
                    style={{ filter: 'saturate(1.05) contrast(1.03)' }}
                    priority
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{ background: 'linear-gradient(135deg, #3F5A2E, #7C8F4E)' }}
                    aria-hidden
                  />
                )}
              </div>
            </div>

            <div className="md:col-span-5 pt-1">
              {game.developer && (
                <p
                  className="text-kicker uppercase font-semibold text-accent mb-3"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  Review · {game.developer}
                </p>
              )}

              <h2
                className="font-serif text-display-sm tracking-tight leading-[1.02] mb-4 group-hover:text-accent transition-colors"
                style={{ fontOpticalSizing: 'auto' }}
              >
                {game.title}
              </h2>

              {/* Byline + dateline — the human cue that a person reviewed this,
                  and when. Hairline rule separates them from the title block. */}
              <div className="border-t border-ink/30 pt-3 mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-sans italic text-sm text-muted">
                  {te('meta.byline')}
                </span>
                {reviewDate && (
                  <>
                    <span className="text-muted/60" aria-hidden>·</span>
                    <time
                      className="text-kicker uppercase text-muted tabular-nums"
                      style={{ fontVariantCaps: 'all-small-caps' }}
                    >
                      {reviewDate}
                    </time>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Pull-quote — the sharpest line of the verdict, set large. One of the
              classic editorial cues that a human read and judged the thing. */}
          {quote && (
            <blockquote className="mt-10 md:mt-14 border-t border-ink pt-8 max-w-5xl">
              <p
                className="font-serif italic text-2xl md:text-4xl leading-[1.18] tracking-tight text-ink"
                style={{ fontOpticalSizing: 'auto' }}
              >
                {quote}
              </p>
            </blockquote>
          )}

          {/* Verdict strip — Growth · Risk · Daily limit */}
          <div className="mt-12 md:mt-16 border-t-2 border-ink border-b border-b-ink py-6 md:py-8 grid grid-cols-3 gap-x-4 md:gap-x-8 items-end">
            <BigScore label={te('verdict.growth')} value={game.bds ?? 0} tone="ivy" />
            <div className="border-l border-ink/30 pl-4 md:pl-8">
              <BigScore label={te('verdict.risk')} value={game.ris ?? 0} tone="accent" />
            </div>
            <div className="border-l border-ink/30 pl-4 md:pl-8">
              <p
                className="text-kicker uppercase text-muted mb-1"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {te('verdict.dailyLimit')}
              </p>
              <p className="font-serif text-[2.75rem] sm:text-5xl md:text-6xl tracking-tight tabular-nums leading-none mt-1">
                {game.timeRecommendationMinutes ?? '—'}
                {game.timeRecommendationMinutes != null && (
                  <span className="text-base sm:text-2xl text-muted ml-1">{te('verdict.minutesShort')}</span>
                )}
              </p>
            </div>
          </div>

          {/* Score breakdown — benefits + risks, side-by-side. Cover excerpt of
              the full per-dimension tables on the review page. */}
          <div className="mt-12 grid md:grid-cols-2 gap-10 md:gap-16">
            <ScoreTable
              title={th('featuredBenefits')}
              rows={benefitRows(game, {
                cognitive: th('featuredMeterCognitive'),
                social:    th('featuredMeterSocial'),
                motor:     th('featuredMeterMotor'),
              })}
              tone="ink"
            />
            <ScoreTable
              title={th('featuredRisks')}
              rows={riskRows(game, {
                dopamine:     th('featuredMeterDopamine'),
                monetization: th('featuredMeterMonetization'),
                social:       th('featuredMeterSocialRisk'),
              })}
              tone="accent"
            />
          </div>

          {/* Parent tip — handwritten margin annotation, one of the three sanctioned
              personality moments per docs/redesign/EDITORIAL_PLAN.md. */}
          {tip && (
            <aside className="mt-12 border-l-2 border-accent pl-6 max-w-3xl">
              <p
                className="text-kicker uppercase font-semibold text-ink mb-3"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {th('featuredParentTip')}
              </p>
              <p className="font-hand text-xl leading-snug text-ink/90">
                {tip}
              </p>
            </aside>
          )}

          {/* Read-the-review CTA — small-caps, hairline above, underlines on hover */}
          <div className="mt-12 border-t border-ink pt-4 flex items-baseline justify-end">
            <span
              className="text-kicker uppercase font-semibold text-ink group-hover:text-accent transition-colors"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {te('sections.readReview')}
            </span>
          </div>
        </Link>
      </div>
    </section>
  )
}
