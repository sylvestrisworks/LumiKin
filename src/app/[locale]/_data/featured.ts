import { eq, and, isNotNull, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, reviews, gameTranslations } from '@/lib/db/schema'

export const SHORTLIST = [
  'stardew-valley',
  'minecraft',
  'the-legend-of-zelda-breath-of-the-wild',
  'mario-kart-8-deluxe',
  'roblox',
  'celeste',
  'animal-crossing-new-horizons',
]

export function pickSlug(): string {
  const d = new Date()
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((d.getTime() - start) / 86_400_000)
  return SHORTLIST[dayOfYear % SHORTLIST.length]
}

export type FeaturedGameData = {
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

export async function fetchFeatured(locale: string): Promise<FeaturedGameData | null> {
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
  // so the featured surface renders fully localized rather than half-English.
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

  const row = (rows[0] as FeaturedGameData) ?? null
  if (!row) return null

  // Overlay translated narrative fields when locale is not English. Per-field
  // gap policy: if the translation row exists but a specific field is NULL
  // (cron hasn't backfilled it yet), null out the English source rather than
  // leaking it into a non-English page. The translate-content cron fills these
  // in over time; until then the field is simply hidden.
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
        row.executiveSummary            = tx.executiveSummary
        row.parentTip                   = tx.parentTip
        row.parentTipBenefits           = tx.parentTipBenefits
        row.timeRecommendationReasoning = tx.timeRecommendationReasoning
      } else {
        // No translation row at all — hide all translatable narrative fields
        // rather than leaking English.
        row.executiveSummary            = null
        row.parentTip                   = null
        row.parentTipBenefits           = null
        row.timeRecommendationReasoning = null
      }
    } catch {
      // game_translations table not yet migrated — skip silently
    }
  }

  return row
}
