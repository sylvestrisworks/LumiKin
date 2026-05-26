import Link from 'next/link'
import { eq, and, isNotNull, inArray, sql } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import { db } from '@/lib/db'
import { games, gameScores, reviews, gameTranslations } from '@/lib/db/schema'
import { curascoreBg, curascoreText, esrbToAge, ageBadgeColor } from '@/lib/ui'

const SHORTLIST = [
  'stardew-valley',
  'minecraft',
  'the-legend-of-zelda-breath-of-the-wild',
  'mario-kart-8-deluxe',
  'roblox',
  'celeste',
  'animal-crossing-new-horizons',
]

function pickSlug(): string {
  const d = new Date()
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((d.getTime() - start) / 86_400_000)
  return SHORTLIST[dayOfYear % SHORTLIST.length]
}

type Row = {
  id: number
  slug: string
  title: string
  developer: string | null
  esrbRating: string | null
  backgroundImage: string | null

  curascore: number | null
  bds: number | null
  ris: number | null
  cognitiveScore: number | null
  socialEmotionalScore: number | null
  motorScore: number | null
  dopamineRisk: number | null
  monetizationRisk: number | null
  socialRisk: number | null

  timeRecommendationMinutes: number | null
  timeRecommendationReasoning: string | null
  executiveSummary: string | null
  topBenefits: unknown
  parentTip: string | null
  parentTipBenefits: string | null
}

async function fetchFeatured(locale: string): Promise<Row | null> {
  const preferred = pickSlug()

  const seen = new Set<string>()
  const ranked: string[] = []
  for (const s of [preferred, ...SHORTLIST]) {
    if (!seen.has(s)) { seen.add(s); ranked.push(s) }
  }

  const ordered = sql`CASE ${games.slug}
    ${sql.join(
      ranked.map((s, i) => sql`WHEN ${s} THEN ${i}`),
      sql` `,
    )}
    ELSE 999 END`

  const selection = {
    id:                          games.id,
    slug:                        games.slug,
    title:                       games.title,
    developer:                   games.developer,
    esrbRating:                  games.esrbRating,
    backgroundImage:             games.backgroundImage,

    curascore:                   gameScores.curascore,
    bds:                         gameScores.bds,
    ris:                         gameScores.ris,
    cognitiveScore:              gameScores.cognitiveScore,
    socialEmotionalScore:        gameScores.socialEmotionalScore,
    motorScore:                  gameScores.motorScore,
    dopamineRisk:                gameScores.dopamineRisk,
    monetizationRisk:            gameScores.monetizationRisk,
    socialRisk:                  gameScores.socialRisk,

    timeRecommendationMinutes:   gameScores.timeRecommendationMinutes,
    timeRecommendationReasoning: gameScores.timeRecommendationReasoning,
    executiveSummary:            gameScores.executiveSummary,
    topBenefits:                 gameScores.topBenefits,

    parentTip:                   reviews.parentTip,
    parentTipBenefits:           reviews.parentTipBenefits,
  }

  const baseWhere = and(
    inArray(games.slug, SHORTLIST),
    isNotNull(gameScores.curascore),
    isNotNull(gameScores.executiveSummary),
  )

  // Prefer a shortlist game that already has a translation row for this locale,
  // so the featured box renders fully localized rather than half-English.
  const runQuery = (whereClause: typeof baseWhere) =>
    db
      .select(selection)
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .innerJoin(reviews,    eq(reviews.id, gameScores.reviewId))
      .where(whereClause)
      .orderBy(ordered)
      .limit(1)

  let rows: Awaited<ReturnType<typeof runQuery>> = []

  if (locale !== 'en') {
    try {
      const translatedWhere = and(
        baseWhere,
        sql`EXISTS (
          SELECT 1 FROM game_translations gt
          WHERE gt.game_id = ${games.id}
            AND gt.locale = ${locale}
            AND gt.executive_summary IS NOT NULL
        )`,
      )
      rows = await runQuery(translatedWhere)
    } catch {
      // game_translations not yet migrated — fall through to base query
    }
  }
  if (rows.length === 0) {
    rows = await runQuery(baseWhere)
  }

  const row = (rows[0] as Row) ?? null
  if (!row) return null

  // Overlay translated narrative fields when locale is not English
  if (locale !== 'en') {
    try {
      const [tx] = await db
        .select({
          executiveSummary:            gameTranslations.executiveSummary,
          parentTip:                   gameTranslations.parentTip,
          parentTipBenefits:           gameTranslations.parentTipBenefits,
          timeRecommendationReasoning: gameTranslations.timeRecommendationReasoning,
        })
        .from(gameTranslations)
        .where(and(eq(gameTranslations.gameId, row.id), eq(gameTranslations.locale, locale)))
        .limit(1)
      if (tx) {
        if (tx.executiveSummary)            row.executiveSummary            = tx.executiveSummary
        if (tx.parentTip)                   row.parentTip                   = tx.parentTip
        if (tx.parentTipBenefits)           row.parentTipBenefits           = tx.parentTipBenefits
        if (tx.timeRecommendationReasoning) row.timeRecommendationReasoning = tx.timeRecommendationReasoning
      }
    } catch {
      // game_translations table not yet migrated — skip silently
    }
  }

  return row
}

// ─── Inline bar row ──────────────────────────────────────────────────────────

function MeterRow({
  label, value, max, tone, title,
}: {
  label: string
  value: number | null
  max: number
  tone: 'benefit' | 'risk'
  title?: string
}) {
  const v = value ?? 0
  const pct = Math.max(0, Math.min(100, (v / max) * 100))
  const bar =
    tone === 'benefit'
      ? 'bg-emerald-500 dark:bg-emerald-400'
      : 'bg-rose-500 dark:bg-rose-400'
  return (
    <div className="space-y-1" title={title}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {v.toFixed(1)}
          <span className="text-slate-400 dark:text-slate-500 font-normal">/{max}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={label}
        className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"
      >
        <div className={`h-full ${bar} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default async function FeaturedGame({ locale }: { locale: string }) {
  const [game, t] = await Promise.all([fetchFeatured(locale), getTranslations('home')])
  if (!game) return null

  const benefits = Array.isArray(game.topBenefits)
    ? (game.topBenefits as Array<{ skill: string }>).slice(0, 3).map(b => b.skill)
    : []

  const bdsPct = game.bds != null ? Math.round(game.bds * 100) : null
  const risPct = game.ris != null ? Math.round(game.ris * 100) : null
  const tip = game.parentTipBenefits ?? game.parentTip

  return (
    <section className="border-y border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="flex items-baseline justify-between flex-wrap gap-x-4 gap-y-1 mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {t('featuredEyebrow')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.rich('featuredToday', {
              title: game.title,
              highlight: (chunks) => <span className="font-semibold text-slate-700 dark:text-slate-200">{chunks}</span>,
            })}
          </p>
        </div>
        <p className="text-slate-600 dark:text-slate-300 max-w-2xl mb-8">
          {t('featuredIntro')}
        </p>

        <Link
          href={`/${locale}/game/${game.slug}`}
          className="group block rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-md transition-all"
        >
          <div className="grid grid-cols-1 md:grid-cols-12">

            {/* ① The game ─────────────────────────────────────────────────── */}
            <div className="md:col-span-4 md:border-r border-b md:border-b-0 border-slate-200 dark:border-slate-800">
              <div className="relative aspect-[16/9] md:aspect-[4/3] bg-slate-100 dark:bg-slate-900">
                {game.backgroundImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={game.backgroundImage}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl font-black text-slate-300 dark:text-slate-700">
                      {game.title.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                {game.esrbRating && (
                  <div className={`absolute top-3 left-3 ${ageBadgeColor(game.esrbRating)} text-white text-xs font-black px-2 py-1 rounded-full leading-none`}>
                    {esrbToAge(game.esrbRating)}
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                  ① {t('featuredStep1')}
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {game.title}
                </h3>
                {game.developer && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{game.developer}</p>
                )}

                {game.curascore != null && (
                  <div className="mt-4 flex items-center gap-3">
                    <div className={`${curascoreBg(game.curascore)} text-white text-lg font-black w-12 h-12 rounded-full flex items-center justify-center shrink-0`}>
                      {game.curascore}
                    </div>
                    <div className="leading-tight">
                      <div className={`text-sm font-bold ${curascoreText(game.curascore)}`}>{t('featuredLumiScore')}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{t('featuredLumiScoreSub')}</div>
                    </div>
                  </div>
                )}

                {game.executiveSummary && (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {game.executiveSummary}
                  </p>
                )}
              </div>
            </div>

            {/* ② What we found ────────────────────────────────────────────── */}
            <div className="md:col-span-5 p-5 md:border-r border-b md:border-b-0 border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                ② {t('featuredStep2')}
              </div>

              {/* Benefits block */}
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{t('featuredBenefits')}</span>
                <span className="text-sm font-black tabular-nums text-slate-900 dark:text-slate-100">
                  {bdsPct != null ? bdsPct : '—'}<span className="text-xs font-bold text-slate-400 dark:text-slate-500">/100</span>
                </span>
              </div>
              <div className="space-y-2">
                <MeterRow
                  label={t('featuredMeterCognitive')}
                  value={game.cognitiveScore != null ? game.cognitiveScore * 5 : null}
                  max={5}
                  tone="benefit"
                  title={t('featuredMeterCognitiveTitle')}
                />
                <MeterRow
                  label={t('featuredMeterSocial')}
                  value={game.socialEmotionalScore != null ? game.socialEmotionalScore * 5 : null}
                  max={5}
                  tone="benefit"
                  title={t('featuredMeterSocialTitle')}
                />
                <MeterRow
                  label={t('featuredMeterMotor')}
                  value={game.motorScore != null ? game.motorScore * 5 : null}
                  max={5}
                  tone="benefit"
                  title={t('featuredMeterMotorTitle')}
                />
              </div>

              {benefits.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {benefits.map(b => (
                    <span
                      key={b}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}

              <div className="my-4 border-t border-slate-200 dark:border-slate-800" />

              {/* Risks block */}
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-bold text-rose-700 dark:text-rose-400">{t('featuredRisks')}</span>
                <span className="text-sm font-black tabular-nums text-slate-900 dark:text-slate-100">
                  {risPct != null ? risPct : '—'}<span className="text-xs font-bold text-slate-400 dark:text-slate-500">/100</span>
                </span>
              </div>
              <div className="space-y-2">
                <MeterRow
                  label={t('featuredMeterDopamine')}
                  value={game.dopamineRisk != null ? game.dopamineRisk * 3 : null}
                  max={3}
                  tone="risk"
                  title={t('featuredMeterDopamineTitle')}
                />
                <MeterRow
                  label={t('featuredMeterMonetization')}
                  value={game.monetizationRisk != null ? game.monetizationRisk * 3 : null}
                  max={3}
                  tone="risk"
                  title={t('featuredMeterMonetizationTitle')}
                />
                <MeterRow
                  label={t('featuredMeterSocialRisk')}
                  value={game.socialRisk != null ? game.socialRisk * 3 : null}
                  max={3}
                  tone="risk"
                  title={t('featuredMeterSocialRiskTitle')}
                />
              </div>
            </div>

            {/* ③ What we suggest ──────────────────────────────────────────── */}
            <div className="md:col-span-3 p-5 flex flex-col">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                ③ {t('featuredStep3')}
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black tabular-nums text-slate-900 dark:text-slate-100">
                  {game.timeRecommendationMinutes ?? '—'}
                </span>
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('featuredMin')}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5">
                {t('featuredPerDay')}
              </div>

              {game.timeRecommendationReasoning && (
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{t('featuredWhy')} </span>
                  {game.timeRecommendationReasoning}
                </p>
              )}

              {tip && (
                <>
                  <div className="my-4 border-t border-slate-200 dark:border-slate-800" />
                  <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">
                    {t('featuredParentTip')}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {tip}
                  </p>
                </>
              )}

              <span className="mt-auto pt-4 text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:underline underline-offset-4">
                {t('featuredCta')}
              </span>
            </div>

          </div>
        </Link>
      </div>
    </section>
  )
}
