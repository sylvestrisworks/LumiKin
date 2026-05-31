'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import {
  BigScore,
  EditorialIcon,
  type EditorialIconName,
  Rosette,
  type RosetteVariant,
  ScoreTable,
  type ScoreRow,
} from '@/components/editorial'
import type { ComplianceBadge, DarkPattern, GameCardProps, SerializedScores } from '@/types/game'
import { calcAge } from '@/lib/age'

type UserProfile = {
  id: number
  name: string
  birthYear: number
  birthDate: string | null
}

type Props = GameCardProps & {
  userProfiles?: UserProfile[]
}

// BDS ≥ 0.60 earns a recommends rosette; everything else (including missing
// scores) shows caution. RIS > 0.70 always overrides to caution per the
// rubric tier rules in docs/RUBRIC.md.
function rosetteVariantFor(bds: number | null, ris: number | null): RosetteVariant {
  if (ris != null && ris > 0.70) return 'caution'
  if (bds != null && bds >= 0.60) return 'recommends'
  return 'caution'
}

function formatPlatforms(platforms: string[]): string {
  return platforms.join(' · ')
}

// Composite-level rows. Detailed B1.1-style breakdowns go in the "Full scores"
// tab later in Round C — the editorial detail panel shows the simplified view.
// TODO(round-c i18n sweep): move these labels into `editorial.dimensions.*`.
function benefitRows(s: SerializedScores | null): ScoreRow[] {
  return [
    { code: 'B1', label: 'Cognitive',        value: s?.cognitiveScore       ?? 0 },
    { code: 'B2', label: 'Social-emotional', value: s?.socialEmotionalScore ?? 0 },
    { code: 'B3', label: 'Motor',            value: s?.motorScore           ?? 0 },
  ]
}

function riskRows(s: SerializedScores | null): ScoreRow[] {
  return [
    { code: 'R1', label: 'Dopamine pressure',  value: s?.dopamineRisk     ?? 0 },
    { code: 'R2', label: 'Monetization',       value: s?.monetizationRisk ?? 0 },
    { code: 'R3', label: 'Social risk',        value: s?.socialRisk       ?? 0 },
  ]
}

// Dark-pattern ID → editorial-icon mapping. The 6-icon set is intentionally
// coarse; ambiguous IDs fall back to `timePressure` (the most generic).
const DP_ICON: Record<string, EditorialIconName> = {
  DP01: 'timePressure',    DP02: 'timePressure',    DP03: 'timePressure',
  DP04: 'marketplace',     DP05: 'lootBox',         DP06: 'subscription',
  DP07: 'marketplace',     DP08: 'chat',            DP09: 'timePressure',
  DP10: 'chat',            DP11: 'dataCollection',  DP12: 'chat',
}

function dpToneClass(severity: DarkPattern['severity']): string {
  switch (severity) {
    case 'high':   return 'text-accent'
    case 'medium': return 'text-warm'
    case 'low':    return 'text-muted'
  }
}

// Reusable heads-up row. Mobile stacks label + body below the icon; desktop
// uses a 3-column grid (icon · label · body).
function HeadsUpRow({
  icon, tone, label, body,
}: {
  icon: EditorialIconName
  tone: string
  label: string
  body: string
}) {
  return (
    <li className="border-b border-ink/20 py-4 grid grid-cols-[1.5rem_1fr] md:grid-cols-[2rem_11rem_1fr] gap-x-4 gap-y-2 items-start">
      <span className={`${tone} mt-0.5`}>
        <EditorialIcon name={icon} />
      </span>
      <span
        className="text-sm text-ink uppercase tracking-wider"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {label}
      </span>
      <span className="col-span-2 md:col-span-1 font-serif text-base text-ink leading-snug">
        {body}
      </span>
    </li>
  )
}

export default function GameCardEditorial({
  game,
  scores,
  review: review,
  darkPatterns,
  compliance,
  userProfiles = [],
}: Props) {
  const t  = useTranslations('editorial')
  const td = useTranslations('darkPatterns')

  const bds = scores?.bds ?? null
  const ris = scores?.ris ?? null
  const variant = rosetteVariantFor(bds, ris)
  const dailyLimit = scores?.timeRecommendationMinutes ?? null
  const recommendedAge = scores?.recommendedMinAge ?? null
  const ageGuidanceLabel = recommendedAge != null ? `${recommendedAge}+` : (game.esrbRating ?? '—')

  return (
    <article className="bg-paper text-ink">
      {/* Hero row: photo (md+ 2/3) + rosette stamp + title (md+ 1/3) */}
      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-2 relative">
          <div className="aspect-[16/10] w-full bg-ink/10 overflow-hidden">
            {game.backgroundImage ? (
              <Image
                src={game.backgroundImage}
                alt={game.title}
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
          {/* Rosette · md+: pinned to photo corner */}
          <div className="hidden md:block absolute -top-4 -right-4 md:-right-10">
            <Rosette variant={variant} size={140} rotate={-7} />
          </div>
        </div>

        <div className="md:col-span-1 pt-2">
          {/* Mobile-only rosette stamp */}
          <div className="md:hidden mb-4 -mt-2">
            <Rosette variant={variant} size={88} rotate={-3} />
          </div>
          <p
            className="text-kicker uppercase font-semibold text-accent mb-3"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Review · {game.genres[0] ?? 'Game'} · {formatPlatforms(game.platforms.slice(0, 3))}
          </p>
          <h1
            className="font-serif text-display-sm tracking-tight mb-4 leading-[1.02]"
            style={{ fontOpticalSizing: 'auto' }}
          >
            {game.title}
          </h1>
          {scores?.executiveSummary && (
            <p className="font-serif text-lg italic text-muted leading-snug mb-4">
              {scores.executiveSummary}
            </p>
          )}
          <div className="text-sm text-muted space-y-1">
            <p className="font-sans italic">{t('meta.byline')}</p>
            {game.updatedAt && (
              <p className="font-sans tabular-nums">
                {t('meta.reviewed')}: {new Date(game.updatedAt).toLocaleDateString(t('dateline.locale'), {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </p>
            )}
            {game.platforms.length > 0 && (
              <p
                className="font-sans uppercase tracking-wider text-xs"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {formatPlatforms(game.platforms)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bundled-online — hairline-bounded warning above the verdict strip.
          Surfaces game.bundledOnlineNote when the publisher has split the
          singleplayer base game from a live-service online layer. */}
      {game.bundledOnlineNote && (
        <section className="mt-12 border-t border-b border-ink py-4 max-w-5xl">
          <p
            className="text-kicker uppercase font-semibold text-accent mb-2"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Bundled online — know the live-service layer
          </p>
          <p className="font-serif italic text-base leading-snug text-ink/90">
            {game.bundledOnlineNote}
          </p>
        </section>
      )}

      {/* Verdict strip — Growth · Risk · Daily limit · Age guidance.
          Mobile: 2×2 with horizontal rule between rows. Desktop: 1×4 with vertical rules. */}
      <div className="mt-12 md:mt-16 border-t-2 border-ink border-b border-b-ink py-6 md:py-8 grid grid-cols-2 md:grid-cols-4 gap-x-6 md:gap-x-8 gap-y-6 md:gap-y-0 items-end">
        <BigScore label={t('verdict.growth')} value={bds ?? 0} tone="ivy" />
        <div className="border-l border-ink/30 pl-6 md:pl-8">
          <BigScore label={t('verdict.risk')} value={ris ?? 0} tone="accent" />
        </div>
        <div className="border-t md:border-t-0 md:border-l border-ink/30 pt-6 md:pt-0 md:pl-8">
          <p
            className="text-kicker uppercase text-muted mb-1"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('verdict.dailyLimit')}
          </p>
          <p className="font-serif text-5xl tracking-tight tabular-nums leading-none mt-1">
            {dailyLimit ?? '—'}
            {dailyLimit != null && (
              <span className="text-2xl text-muted ml-1">{t('verdict.minutesShort')}</span>
            )}
          </p>
        </div>
        <div className="border-t md:border-t-0 border-l border-ink/30 pt-6 md:pt-0 pl-6 md:pl-8">
          <p
            className="text-kicker uppercase text-muted mb-1"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('verdict.ageGuidance')}
          </p>
          <p className="font-serif text-5xl tracking-tight tabular-nums leading-none mt-1">
            {ageGuidanceLabel}
          </p>
        </div>
      </div>

      {/* Per-child line — only renders when the parent has profiles configured. */}
      {userProfiles.length > 0 && recommendedAge != null && (
        <p className="mt-6 font-serif italic text-lg text-ink/90">
          {userProfiles.map((kid, i) => {
            const age = calcAge(kid.birthDate, kid.birthYear)
            const ok = age >= recommendedAge
            return (
              <span key={kid.id}>
                {i > 0 && <span className="text-rule mx-3">·</span>}
                <span
                  className={
                    ok
                      ? 'text-ivy not-italic font-semibold mr-1'
                      : 'text-accent not-italic font-semibold mr-1'
                  }
                  aria-hidden
                >
                  {ok ? '✓' : '✗'}
                </span>
                <span>
                  {kid.name}{' '}
                  <span className="text-muted not-italic text-base">({age})</span>
                </span>
              </span>
            )
          })}
          <span className="text-muted not-italic text-sm ml-4">
            — recommended age {recommendedAge}+
          </span>
        </p>
      )}

      {/* Score breakdown + margin annotation.
          Mobile: scores stack, then annotation collapses inline with accent rule.
          Desktop: scores 2/3 + handwritten parent tip in dashed-rule sidebar 1/3. */}
      <div className="mt-16 grid md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-12">
          <div className="space-y-4">
            <ScoreTable title="Developmental benefits" rows={benefitRows(scores)} tone="ink" />
            {review?.benefitsNarrative && (
              <p className="font-serif italic text-base text-ink/90 leading-snug border-l-2 border-ivy pl-4">
                {review.benefitsNarrative}
              </p>
            )}
          </div>
          <div className="space-y-4">
            <ScoreTable title="Design risks" rows={riskRows(scores)} tone="accent" />
            {review?.risksNarrative && (
              <p className="font-serif italic text-base text-ink/90 leading-snug border-l-2 border-accent pl-4">
                {review.risksNarrative}
              </p>
            )}
          </div>
        </div>
        {review?.parentTip && (
          <aside className="md:col-span-1 pl-4 md:pl-6 border-l-2 md:border-l border-accent md:border-ink/40 [border-left-style:solid] md:[border-left-style:dashed]">
            <p
              className="text-kicker uppercase font-semibold text-ink mb-3"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              A note from the editors
            </p>
            <p
              className="font-hand text-2xl leading-snug text-ink/90"
              style={{ transform: 'rotate(-0.4deg)' }}
            >
              {review.parentTip}
            </p>
            <p
              className="mt-4 text-kicker uppercase text-muted"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              — {t('meta.byline')}
            </p>
          </aside>
        )}
      </div>

      {/* Heads-up — dark patterns + monthly cost + virtual currency, hairline rows.
          Compliance moved to the meta footer below. Section header suppressed
          when there's nothing to show (e.g. Minecraft: 0 dark patterns, no cost). */}
      {(darkPatterns.length > 0
        || (review?.estimatedMonthlyCostLow != null && review.estimatedMonthlyCostHigh != null)
        || review?.virtualCurrencyName) && (
        <section className="mt-16 max-w-5xl">
          <p
            className="text-kicker uppercase font-semibold text-accent mb-4"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('headsUp.title')}
          </p>
          <ul className="border-t border-ink">
            {review?.estimatedMonthlyCostLow != null && review.estimatedMonthlyCostHigh != null && (
              <HeadsUpRow
                icon="marketplace"
                tone="text-warm"
                label="Monthly spend"
                body={`Typical real-money spend by engaged players: $${review.estimatedMonthlyCostLow}–${review.estimatedMonthlyCostHigh}/mo.`}
              />
            )}
            {review?.virtualCurrencyName && (
              <HeadsUpRow
                icon="marketplace"
                tone="text-warm"
                label={`In-game currency · ${review.virtualCurrencyName}`}
                body={review.virtualCurrencyRate
                  ? `Conversion rate: ${review.virtualCurrencyRate}.`
                  : `${review.virtualCurrencyName} obscures the real-money price of items.`}
              />
            )}
            {darkPatterns.map((dp) => {
              const labelKey = `dp${dp.patternId.slice(2)}Label` as Parameters<typeof td>[0]
              const descKey  = `dp${dp.patternId.slice(2)}Desc`  as Parameters<typeof td>[0]
              const label    = td(labelKey)
              const body     = dp.description ?? td(descKey)
              return (
                <HeadsUpRow
                  key={dp.patternId}
                  icon={DP_ICON[dp.patternId] ?? 'timePressure'}
                  tone={dpToneClass(dp.severity)}
                  label={label}
                  body={body}
                />
              )
            })}
          </ul>
        </section>
      )}

      {/* Compliance — small-caps line just above the meta footer.
          Each regulation gets a status-tone color and, if there are notes
          worth surfacing, an italic disclosure line below. */}
      {compliance.length > 0 && (
        <div className="mt-12 border-t border-ink/30 pt-4 max-w-5xl">
          <p
            className="text-kicker uppercase text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Regulatory compliance ·{' '}
            {compliance.map((c, i) => (
              <span key={c.regulation}>
                {i > 0 && <span className="text-rule mx-2">·</span>}
                <span className={statusToneClass(c.status)}>{c.regulation}</span>
              </span>
            ))}
          </p>
          {compliance.some((c) => c.notes) && (
            <ul className="mt-2 space-y-1">
              {compliance.filter((c) => c.notes).map((c) => (
                <li
                  key={c.regulation}
                  className="font-serif italic text-sm text-muted leading-snug"
                >
                  <span className={`not-italic font-semibold ${statusToneClass(c.status)} mr-1`}>
                    {c.regulation}:
                  </span>
                  {c.notes}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Meta footer — base price, avg playtime, reviewed date, methodology link. */}
      <div className="mt-16 border-t border-ink pt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 text-sm font-sans">
        {game.basePrice != null && (
          <span>
            <span
              className="text-kicker uppercase text-muted mr-2"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {t('meta.basePrice')}
            </span>
            <span className="tabular-nums text-ink">${game.basePrice}</span>
          </span>
        )}
        {game.avgPlaytimeHours != null && (
          <span>
            <span
              className="text-kicker uppercase text-muted mr-2"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {t('meta.avgPlaytime')}
            </span>
            <span className="tabular-nums text-ink">~{game.avgPlaytimeHours} h</span>
          </span>
        )}
        {scores?.calculatedAt && (
          <span>
            <span
              className="text-kicker uppercase text-muted mr-2"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {t('meta.reviewed')}
            </span>
            <span className="tabular-nums text-ink">
              {new Date(scores.calculatedAt).toLocaleDateString(t('dateline.locale'), {
                month: 'short', year: 'numeric',
              })}
            </span>
          </span>
        )}
        <span className="ml-auto italic text-muted">
          <a
            href="/methodology"
            className="underline decoration-rule hover:text-accent hover:decoration-accent"
          >
            {t('meta.methodology')}
          </a>
        </span>
      </div>
    </article>
  )
}

function statusToneClass(status: ComplianceBadge['status']): string {
  switch (status) {
    case 'compliant':     return 'text-ivy'
    case 'non_compliant': return 'text-accent'
    case 'not_assessed':  return 'text-muted'
  }
}
