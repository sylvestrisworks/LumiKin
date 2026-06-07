// Discovery data helpers shared by /browse (shelf mode) and any future surface.
// Moved out of the old /discover route so the editorial panels (LumiScore scale,
// catalog stats, Safe Swap) can live on the unified /browse page.
//
// /browse is `force-dynamic`, so the catalog-stat aggregate (two COUNT passes)
// is wrapped in unstable_cache to keep it off the per-request hot path. The Safe
// Swap query rotates daily and depends on the request locale's translations, so
// it stays uncached (two light queries).

import { unstable_cache } from 'next/cache'
import { desc, eq, isNotNull, lte, gte, and, sql, inArray, count } from 'drizzle-orm'
import type { getTranslations } from 'next-intl/server'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import type { SwapPair, CatalogStats } from '@/types/game'

// ─── Catalog stats ────────────────────────────────────────────────────────────

// One pass over the scored catalogue. The numbers tell a parent-relevant story:
// how much we cover, how many are worth playing, how pervasive paid mechanics are
// (the eye-opener), and how many are clean of them.
export const getCatalogStats = unstable_cache(
  async (): Promise<CatalogStats> => {
    const [totals, great] = await Promise.all([
      db.select({
        total:     count(),
        monetized: count(sql`CASE WHEN ${games.hasLootBoxes} = true OR ${games.hasMicrotransactions} = true THEN 1 END`),
        clean:     count(sql`CASE WHEN (${games.hasLootBoxes} = false OR ${games.hasLootBoxes} IS NULL) AND (${games.hasMicrotransactions} = false OR ${games.hasMicrotransactions} IS NULL) THEN 1 END`),
      })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(isNotNull(gameScores.curascore)),

      db.select({ n: count() })
      .from(gameScores)
      .where(and(isNotNull(gameScores.curascore), gte(gameScores.curascore, 66))),
    ])

    const total     = Number(totals[0]?.total ?? 0)
    const monetized = Number(totals[0]?.monetized ?? 0)
    const clean     = Number(totals[0]?.clean ?? 0)

    return {
      totalScored:           total,
      greatCount:            Number(great[0]?.n ?? 0),
      monetizedPct:          total > 0 ? Math.round((monetized / total) * 100) : 0,
      zeroMonetizationCount: clean,
    }
  },
  ['browse-catalog-stats'],
  { revalidate: 3600 },
)

// ─── Safe Swap generator ────────────────────────────────────────────────────

type DiscoverT = Awaited<ReturnType<typeof getTranslations<'discover'>>>

function buildRiskType(monetization: number | null, social: number | null, dopamine: number | null): string {
  if (monetization != null && monetization >= 0.45) return 'monetization'
  if (dopamine     != null && dopamine     >= 0.45) return 'dopamine'
  if (social       != null && social       >= 0.45) return 'social'
  return 'general'
}

const RISK_EXPLANATION_KEYS: Record<string, Parameters<DiscoverT>[0]> = {
  monetization: 'swapRiskMonetization',
  dopamine:     'swapRiskDopamine',
  social:       'swapRiskSocial',
  general:      'swapRiskGeneral',
}

function buildFromReason(t: DiscoverT, monetization: number | null, social: number | null, dopamine: number | null): string {
  if (monetization != null && monetization >= 0.55) return t('swapFromHeavyMon')
  if (social       != null && social       >= 0.55) return t('swapFromSocial')
  if (dopamine     != null && dopamine     >= 0.55) return t('swapFromDopamine')
  if (monetization != null && monetization >= 0.4)  return t('swapFromMon')
  return t('swapFromGeneral')
}

function buildToReason(t: DiscoverT, bds: number | null, ris: number | null): string {
  if (bds != null && bds >= 0.6 && ris != null && ris <= 0.25) return t('swapToStrong')
  if (bds != null && bds >= 0.5)  return t('swapToSimilar')
  if (ris != null && ris <= 0.2)  return t('swapToSameGenre')
  return t('swapToSafer')
}

export async function getSwapPair(t: DiscoverT, locale: string): Promise<SwapPair | null> {
  const risky = await db
    .select({
      id:               games.id,
      slug:             games.slug,
      title:            games.title,
      genres:           games.genres,
      esrbRating:       games.esrbRating,
      curascore:        gameScores.curascore,
      ris:              gameScores.ris,
      monetizationRisk: gameScores.monetizationRisk,
      socialRisk:       gameScores.socialRisk,
      dopamineRisk:     gameScores.dopamineRisk,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      lte(gameScores.curascore, 40),
      gte(gameScores.ris, 0.45),
      isNotNull(games.genres),
      sql`jsonb_typeof(${games.genres}) = 'array' AND ${games.genres} != '[]'::jsonb`,
    ))
    .orderBy(desc(gameScores.ris))
    .limit(20)

  if (risky.length === 0) return null

  const dayIndex  = Math.floor(Date.now() / 86_400_000)
  const fromGame  = risky[dayIndex % risky.length]
  const fromGenres = (fromGame.genres as string[]) ?? []

  const ESRB_ORDER = ['E', 'E10+', 'T', 'M', 'AO']
  const fromEsrbIdx  = ESRB_ORDER.indexOf(fromGame.esrbRating ?? 'T')
  const allowedEsrb  = ESRB_ORDER.slice(0, Math.max(fromEsrbIdx + 1, 2))

  // fetch more candidates so we can return up to 3 alternatives
  const safePool = await db
    .select({
      slug:      games.slug,
      title:     games.title,
      genres:    games.genres,
      esrbRating: games.esrbRating,
      curascore: gameScores.curascore,
      bds:       gameScores.bds,
      ris:       gameScores.ris,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      gte(gameScores.curascore, 65),
      lte(gameScores.ris, 0.3),
      sql`${games.id} != ${fromGame.id}`,
      inArray(games.esrbRating, allowedEsrb),
    ))
    .orderBy(desc(gameScores.curascore))
    .limit(60)

  // prefer genre overlap
  const withOverlap = safePool.filter(g => {
    const gGenres = (g.genres as string[]) ?? []
    return fromGenres.some(fg => gGenres.includes(fg))
  })

  const pool = withOverlap.length >= 3 ? withOverlap : [...withOverlap, ...safePool.filter(g => !withOverlap.includes(g))]

  // pick 3 distinct alternatives rotating by day
  const alternatives = []
  const used = new Set<string>()
  for (let i = 0; alternatives.length < 3 && i < pool.length; i++) {
    const g = pool[(dayIndex + i) % pool.length]
    if (g && !used.has(g.slug)) {
      used.add(g.slug)
      const gGenres = (g.genres as string[]) ?? []
      alternatives.push({
        title:     g.title,
        genre:     gGenres[0] ?? fromGenres[0] ?? 'Game',
        curascore: g.curascore!,
        reason:    buildToReason(t, g.bds, g.ris),
        href:      `/${locale}/game/${g.slug}`,
      })
    }
  }

  if (alternatives.length === 0) return null

  const riskType = buildRiskType(fromGame.monetizationRisk, fromGame.socialRisk, fromGame.dopamineRisk)

  return {
    from: {
      title:           fromGame.title,
      genre:           fromGenres[0] ?? 'Game',
      curascore:       fromGame.curascore ?? 0,
      reason:          buildFromReason(t, fromGame.monetizationRisk, fromGame.socialRisk, fromGame.dopamineRisk),
      href:            `/${locale}/game/${fromGame.slug}`,
      riskType,
      riskExplanation: t(RISK_EXPLANATION_KEYS[riskType]),
    },
    alternatives,
  }
}
