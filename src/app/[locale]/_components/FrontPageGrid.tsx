import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { ScoreBar } from '@/components/editorial/ScoreTable'
import { esrbToAge } from '@/lib/ui'
import { fetchFeatured } from '../_data/featured'
import { fetchTrending } from '../_data/trending'

// Above-the-fold newspaper front. A lead review fills the wide left column;
// an "In brief" rail stacks the next stories down the right, divided by a
// vertical hairline rule (the Guardian / Wirecutter front-page move). Replaces
// the stacked TodaysReview + TrackingRow sections at the top of the homepage.
// The full per-dimension score tables remain on the review page — a front page
// leads with verdict + voice, not data tables.

// First one-to-two sentences of the executive summary, capped — the lead deck.
function deck(text: string | null, max = 220): string | null {
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

function firstSentence(text: string | null, max = 130): string {
  if (!text) return ''
  const trimmed = text.trim()
  const dot = trimmed.indexOf('. ')
  const head = dot > 0 ? trimmed.slice(0, dot + 1) : trimmed
  return head.length > max ? head.slice(0, max - 1).trimEnd() + '…' : head
}

function formatDate(d: Date | null, locale: string): string | null {
  if (!d) return null
  return new Date(d)
    .toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
}

export default async function FrontPageGrid({ locale }: { locale: string }) {
  const [game, trending, te, th] = await Promise.all([
    fetchFeatured(locale),
    fetchTrending(locale, 6),
    getTranslations('editorial'),
    getTranslations('home'),
  ])
  if (!game) return null

  // Drop the lead game from the briefs so it never appears twice on the front.
  const briefs = trending.filter((r) => r.slug !== game.slug).slice(0, 4)

  const tip        = game.parentTipBenefits ?? game.parentTip
  const lead       = deck(game.executiveSummary)
  const dateLocale = te('dateline.locale')
  const reviewDate = formatDate(game.reviewedAt, dateLocale)

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-8 pt-8 pb-16 md:pb-20">
        {/* Front-page rule — heavy/hairline pair, echoing the masthead */}
        <div className="border-t-2 border-ink" />
        <div className="mt-px border-t border-ink/30 mb-8" />

        <div className="grid md:grid-cols-12 md:gap-0">
          {/* ── LEAD ──────────────────────────────────────────────────────── */}
          <div className="md:col-span-8 md:pr-12">
            <Link
              href={`/${locale}/game/${game.slug}`}
              className="group block"
              aria-label={`${te('sections.todaysReview')} — ${game.title}`}
            >
              <p
                className="text-kicker uppercase font-semibold text-accent mb-4"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {te('sections.todaysReview')}
                {game.developer && <span className="text-muted"> · {game.developer}</span>}
              </p>

              <h2
                className="font-serif text-display-sm md:text-display tracking-tight leading-[1.0] mb-6 group-hover:text-accent transition-colors"
                style={{ fontOpticalSizing: 'auto' }}
              >
                {game.title}
              </h2>

              <div className="relative">
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

              {/* Lead deck — drop cap on the opening letter, the classic
                  front-page cue. */}
              {lead && (
                <p
                  className="mt-8 font-serif text-xl md:text-2xl leading-[1.35] text-ink first-letter:float-left first-letter:font-serif first-letter:text-7xl first-letter:leading-[0.72] first-letter:mr-3 first-letter:mt-1 first-letter:font-medium first-letter:text-accent"
                  style={{ fontOpticalSizing: 'auto' }}
                >
                  {lead}
                </p>
              )}

              {/* Byline + dateline */}
              <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
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

              {/* Compact verdict strip — Growth · Risk · Daily limit, inline */}
              <div className="mt-8 border-t-2 border-ink border-b border-b-ink py-5 grid grid-cols-3 gap-x-6 items-end">
                <div>
                  <p
                    className="text-kicker uppercase text-muted mb-1"
                    style={{ fontVariantCaps: 'all-small-caps' }}
                  >
                    {te('verdict.growth')}
                  </p>
                  <p className="font-serif text-5xl tabular-nums leading-none tracking-tight text-ivy" style={{ fontWeight: 500 }}>
                    {Math.round((game.bds ?? 0) * 100)}
                  </p>
                </div>
                <div className="border-l border-ink/30 pl-6">
                  <p
                    className="text-kicker uppercase text-muted mb-1"
                    style={{ fontVariantCaps: 'all-small-caps' }}
                  >
                    {te('verdict.risk')}
                  </p>
                  <p className="font-serif text-5xl tabular-nums leading-none tracking-tight text-accent" style={{ fontWeight: 500 }}>
                    {Math.round((game.ris ?? 0) * 100)}
                  </p>
                </div>
                <div className="border-l border-ink/30 pl-6">
                  <p
                    className="text-kicker uppercase text-muted mb-1"
                    style={{ fontVariantCaps: 'all-small-caps' }}
                  >
                    {te('verdict.dailyLimit')}
                  </p>
                  <p className="font-serif text-5xl tabular-nums leading-none tracking-tight">
                    {game.timeRecommendationMinutes ?? '—'}
                    {game.timeRecommendationMinutes != null && (
                      <span className="text-xl text-muted ml-1">{te('verdict.minutesShort')}</span>
                    )}
                  </p>
                </div>
              </div>
            </Link>

            {/* Parent tip — handwritten margin annotation */}
            {tip && (
              <aside className="mt-8 border-l-2 border-accent pl-6 max-w-2xl">
                <p
                  className="text-kicker uppercase font-semibold text-ink mb-2"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  {th('featuredParentTip')}
                </p>
                <p className="font-hand text-xl leading-snug text-ink/90">{tip}</p>
              </aside>
            )}

            <Link
              href={`/${locale}/game/${game.slug}`}
              className="mt-8 inline-block text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {te('sections.readReview')}
            </Link>
          </div>

          {/* ── IN BRIEF RAIL ─────────────────────────────────────────────── */}
          <aside className="md:col-span-4 md:pl-12 md:border-l md:border-ink/30 mt-12 md:mt-0">
            <div className="border-t border-ink pt-3 mb-6">
              <p
                className="text-kicker uppercase font-semibold text-muted"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {te('sections.whatWereTracking')}
              </p>
            </div>

            <div className="flex flex-col">
              {briefs.map((row) => (
                <Link
                  key={row.slug}
                  href={`/${locale}/game/${row.slug}`}
                  className="group block border-b border-ink/30 py-5 first:pt-0 last:border-b-0"
                  aria-label={`${row.title} — ${te('sections.readReview')}`}
                >
                  <p
                    className="text-kicker uppercase font-semibold text-accent mb-1"
                    style={{ fontVariantCaps: 'all-small-caps' }}
                  >
                    {row.developer ?? te('meta.byline')}
                  </p>
                  <h3
                    className="font-serif text-2xl leading-[1.08] tracking-tight mb-2 group-hover:text-accent transition-colors"
                    style={{ fontOpticalSizing: 'auto' }}
                  >
                    {row.title}
                  </h3>
                  {firstSentence(row.executiveSummary) && (
                    <p className="font-serif italic text-muted text-base leading-snug mb-3">
                      {firstSentence(row.executiveSummary)}
                    </p>
                  )}

                  {/* Score sparkline + meta */}
                  <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-1 items-center text-xs font-sans">
                    <span className="text-kicker uppercase text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>B</span>
                    <ScoreBar value={row.bds ?? 0} tone="ink" thin />
                    <span className="tabular-nums text-ink">{Math.round((row.bds ?? 0) * 100)}</span>
                    <span className="text-kicker uppercase text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>R</span>
                    <ScoreBar value={row.ris ?? 0} tone="accent" thin />
                    <span className="tabular-nums text-ink">{Math.round((row.ris ?? 0) * 100)}</span>
                  </div>
                  <p
                    className="mt-2 text-kicker uppercase text-muted"
                    style={{ fontVariantCaps: 'all-small-caps' }}
                  >
                    {row.timeRecommendationMinutes ?? '—'} {te('verdict.minutesShort')} · ages {esrbToAge(row.esrbRating)}
                  </p>
                </Link>
              ))}
            </div>

            <Link
              href={`/${locale}/browse?sort=trending`}
              className="mt-6 inline-block text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {te('sections.allReviews')}
            </Link>
          </aside>
        </div>
      </div>
    </section>
  )
}
