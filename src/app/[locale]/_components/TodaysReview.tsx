import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import {
  BigScore,
  ScoreTable,
  type ScoreRow,
} from '@/components/editorial'
import { METHODOLOGY_PDF_PATH } from '@/lib/methodology'
import { safeImageUrl } from '@/lib/images'
import { fetchFeatured, type FeaturedGameData } from '../_data/featured'

// Per-dimension copy bundle: `label` is the row name, `note` the always-visible
// one-line gloss (featuredMeter*Title), `def` the fuller explanation shown on
// hover/focus (glossary). Numbers always carry their meaning, with depth a
// cursor away.
type DimCopy = { label: string; note: string; def: string }

function benefitRows(
  g: FeaturedGameData,
  c: { cognitive: DimCopy; social: DimCopy; motor: DimCopy },
): ScoreRow[] {
  return [
    { code: 'B1', label: c.cognitive.label, value: g.cognitiveScore       ?? 0, note: c.cognitive.note, def: c.cognitive.def },
    { code: 'B2', label: c.social.label,    value: g.socialEmotionalScore ?? 0, note: c.social.note,    def: c.social.def },
    { code: 'B3', label: c.motor.label,     value: g.motorScore           ?? 0, note: c.motor.note,     def: c.motor.def },
  ]
}

function riskRows(
  g: FeaturedGameData,
  c: { dopamine: DimCopy; monetization: DimCopy; social: DimCopy },
): ScoreRow[] {
  return [
    { code: 'R1', label: c.dopamine.label,     value: g.dopamineRisk     ?? 0, note: c.dopamine.note,     def: c.dopamine.def },
    { code: 'R2', label: c.monetization.label, value: g.monetizationRisk ?? 0, note: c.monetization.note, def: c.monetization.def },
    { code: 'R3', label: c.social.label,       value: g.socialRisk       ?? 0, note: c.social.note,       def: c.social.def },
  ]
}

// "By the numbers" anatomy figures — the abstract primer, now folded in beside
// the concrete scores so the scale and the example sit together. Values are
// rubric constants (docs/RUBRIC.md): 60 sub-dimensions, two composites, the
// 0–100 scale, the 15–120-minute session range.
const ANATOMY: Array<{ value: string; labelKey: 'dimensionsLabel' | 'scoresLabel' | 'scaleLabel' | 'timeLabel' }> = [
  { value: '60',     labelKey: 'dimensionsLabel' },
  { value: '2',      labelKey: 'scoresLabel' },
  { value: '0–100',  labelKey: 'scaleLabel' },
  { value: '15–120', labelKey: 'timeLabel' },
]

// Small-caps eyebrow used to label each of the three acts of the walkthrough,
// preceded by a serif step numeral in the margin.
function ActLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <span
        className="font-serif text-2xl leading-none text-accent tabular-nums"
        style={{ fontOpticalSizing: 'auto', fontWeight: 500 }}
        aria-hidden
      >
        {n}
      </span>
      <span
        className="text-kicker uppercase font-semibold text-muted"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {children}
      </span>
    </div>
  )
}

export default async function TodaysReview({ locale }: { locale: string }) {
  const [game, te, th, tg] = await Promise.all([
    fetchFeatured(locale),
    getTranslations('editorial'),
    getTranslations('home'),
    getTranslations('glossary'),
  ])
  if (!game) return null

  const tip = game.parentTipBenefits ?? game.parentTip
  const reasoning = game.timeRecommendationReasoning
  const minutes = game.timeRecommendationMinutes

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8 md:py-10">
        {/* Eyebrow — section header, small-caps, hairline-bounded above */}
        <div className="border-t border-ink pt-4 mb-6">
          <p
            className="text-kicker uppercase font-semibold text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {te('byTheNumbers.kicker')}
          </p>
        </div>

        {/* Headline + standfirst — frames the whole section as a teaching
            walkthrough, not a featured game. */}
        <h2
          className="font-serif text-display-sm md:text-display tracking-tight leading-[1.05] mb-6 max-w-4xl"
          style={{ fontOpticalSizing: 'auto' }}
        >
          {th('featuredEyebrow')}
        </h2>
        <p className="font-serif italic text-xl md:text-2xl text-muted leading-snug max-w-3xl mb-12">
          {th('featuredIntro')}
        </p>

        {/* ── Act 1 · The game (the specimen) ──────────────────────────────── */}
        <div className="border-t border-ink/30 pt-8">
          <ActLabel n={1}>{th('featuredStep1')}</ActLabel>
          <Link
            href={`/${locale}/game/${game.slug}`}
            className="group grid sm:grid-cols-12 gap-6 sm:gap-8 items-center"
            aria-label={`${th('featuredStep1')} — ${game.title}`}
          >
            <div className="sm:col-span-4 md:col-span-3">
              <div className="aspect-[16/10] w-full bg-ink/10 overflow-hidden">
                {safeImageUrl(game.backgroundImage) ? (
                  <Image
                    src={safeImageUrl(game.backgroundImage)!}
                    alt={game.title}
                    width={640}
                    height={400}
                    className="w-full h-full object-cover"
                    style={{ filter: 'saturate(1.05) contrast(1.03)' }}
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
            <div className="sm:col-span-8 md:col-span-9">
              {game.developer && (
                <p
                  className="text-kicker uppercase font-semibold text-accent mb-2"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  {game.developer}
                  {game.esrbRating && <span className="text-muted"> · {game.esrbRating}</span>}
                </p>
              )}
              <h3
                className="font-serif text-display-sm tracking-tight leading-[1.05] group-hover:text-accent transition-colors"
                style={{ fontOpticalSizing: 'auto' }}
              >
                {game.title}
              </h3>
            </div>
          </Link>
        </div>

        {/* ── Act 2 · What we found (the teaching heart) ───────────────────── */}
        <div className="border-t border-ink/30 pt-8 mt-12">
          <ActLabel n={2}>{th('featuredStep2')}</ActLabel>

          {/* Verdict strip — the two composites + the session length they imply. */}
          <div className="border-t-2 border-ink border-b border-b-ink py-6 md:py-8 grid grid-cols-3 gap-x-4 md:gap-x-8 items-end">
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

          {/* Score breakdown — benefits + risks, each dimension annotated with
              what it measures. The piece that was missing before. */}
          <div className="mt-12 grid md:grid-cols-2 gap-10 md:gap-16">
            <ScoreTable
              title={th('featuredBenefits')}
              rows={benefitRows(game, {
                cognitive: { label: th('featuredMeterCognitive'), note: th('featuredMeterCognitiveTitle'), def: tg('dimCognitive') },
                social:    { label: th('featuredMeterSocial'),    note: th('featuredMeterSocialTitle'),    def: tg('dimSocial') },
                motor:     { label: th('featuredMeterMotor'),     note: th('featuredMeterMotorTitle'),     def: tg('dimMotor') },
              })}
              tone="ink"
            />
            <ScoreTable
              title={th('featuredRisks')}
              rows={riskRows(game, {
                dopamine:     { label: th('featuredMeterDopamine'),     note: th('featuredMeterDopamineTitle'),     def: tg('dimDopamine') },
                monetization: { label: th('featuredMeterMonetization'), note: th('featuredMeterMonetizationTitle'), def: tg('dimMonetization') },
                social:       { label: th('featuredMeterSocialRisk'),   note: th('featuredMeterSocialRiskTitle'),   def: tg('dimSocialRisk') },
              })}
              tone="accent"
            />
          </div>

          {/* Anatomy figures — the abstract scale, sitting beside the concrete
              scores so the primer and the example are reunited. */}
          <dl className="mt-12 grid grid-cols-2 md:grid-cols-4 border-t-2 border-b border-ink md:divide-x divide-ink/30">
            {ANATOMY.map(({ value, labelKey }) => (
              <div key={labelKey} className="py-6 md:px-6 md:first:pl-0 md:last:pr-0">
                <dd
                  className="font-serif tabular-nums leading-none tracking-tight text-ink mb-3"
                  style={{ fontSize: '3.25rem', fontOpticalSizing: 'auto', fontWeight: 500 }}
                >
                  {value}
                </dd>
                <dt
                  className="text-kicker uppercase text-muted"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  {te(`byTheNumbers.${labelKey}`)}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        {/* ── Act 3 · What we suggest ──────────────────────────────────────── */}
        <div className="border-t border-ink/30 pt-8 mt-12">
          <ActLabel n={3}>{th('featuredStep3')}</ActLabel>

          {/* Suggestion lead — restates the recommendation as plain advice, so
              Act 3 lands a takeaway rather than just footnoting Act 2's number. */}
          {minutes != null && (
            <p className="font-serif text-2xl md:text-4xl leading-[1.15] tracking-tight text-ink max-w-3xl">
              {th.rich('suggestLead', {
                minutes,
                b: (c) => <span className="text-accent">{c}</span>,
              })}
            </p>
          )}

          {/* Age guidance — the content-rating cue, kept separate from the
              developmental time recommendation (per RUBRIC: R4 ≠ time tier). */}
          {game.esrbRating && (
            <p className="mt-5 flex items-baseline gap-2 flex-wrap">
              <span
                className="text-kicker uppercase text-muted"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {te('verdict.ageGuidance')}
              </span>
              <span className="text-muted/60" aria-hidden>·</span>
              <span className="font-serif text-xl text-ink">{game.esrbRating}</span>
            </p>
          )}

          {reasoning && (
            <p className="mt-8 font-serif text-lg md:text-xl leading-relaxed text-ink/90 max-w-3xl">
              <span
                className="text-kicker uppercase font-semibold text-ink mr-2"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {th('featuredWhy')}
              </span>
              {reasoning}
            </p>
          )}

          {/* Parent tip — how to act on the score. One of the three sanctioned
              personality moments per docs/redesign/EDITORIAL_PLAN.md. */}
          {tip && (
            <aside className="mt-10 border-l-2 border-accent pl-6 max-w-3xl">
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
        </div>

        {/* Closer — sourcing line + methodology routes. The score isn't a black
            box; it traces to a public, version-controlled rubric. */}
        <div className="mt-12 border-t border-ink pt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <p className="font-serif italic text-lg text-muted mr-auto">
            {te('byTheNumbers.source')}
          </p>
          <Link
            href={`/${locale}/game/${game.slug}`}
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {th('featuredCta')}
          </Link>
          <Link
            href={`/${locale}/methodology`}
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {th('methodologyReadFull')}
          </Link>
          <a
            href={METHODOLOGY_PDF_PATH}
            download
            className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {th('methodologyDownloadPdf')}
          </a>
        </div>
      </div>
    </section>
  )
}
