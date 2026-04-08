export const dynamic = 'force-dynamic'

import { desc, eq, isNotNull, lte, gte, and, sql, inArray, count, avg } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import GameDiscoveryDashboard from '@/components/GameDiscoveryDashboard'
import type { GameSummary, SwapPair, CatalogStats } from '@/types/game'

export const metadata: Metadata = {
  title: 'Discover — Curascore by Good Game Parent',
  description: 'Find the right game for your child, grounded in child development.',
}

async function getTopGames(): Promise<GameSummary[]> {
  const rows = await db
    .select({
      slug:                      games.slug,
      title:                     games.title,
      developer:                 games.developer,
      genres:                    games.genres,
      esrbRating:                games.esrbRating,
      backgroundImage:           games.backgroundImage,
      metacriticScore:           games.metacriticScore,
      curascore:                 gameScores.curascore,
      timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
      timeRecommendationColor:   gameScores.timeRecommendationColor,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNotNull(gameScores.curascore))
    .orderBy(desc(gameScores.curascore))
    .limit(48)   // more games so genre filtering has enough to work with

  return rows.map((r) => ({
    slug:                      r.slug,
    title:                     r.title,
    developer:                 r.developer,
    genres:                    (r.genres as string[]) ?? [],
    esrbRating:                r.esrbRating,
    backgroundImage:           r.backgroundImage,
    metacriticScore:           r.metacriticScore,
    curascore:                 r.curascore,
    timeRecommendationMinutes: r.timeRecommendationMinutes,
    timeRecommendationColor:   r.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
  }))
}

// ─── Catalog stats ────────────────────────────────────────────────────────────

async function getCatalogStats(): Promise<CatalogStats> {
  const [totals, eRated, green] = await Promise.all([
    db.select({
      total:       count(),
      noLootBoxes: count(sql`CASE WHEN ${games.hasLootBoxes} = false OR ${games.hasLootBoxes} IS NULL THEN 1 END`),
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNotNull(gameScores.curascore)),

    db.select({ avgScore: avg(gameScores.curascore) })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(isNotNull(gameScores.curascore), eq(games.esrbRating, 'E'))),

    db.select({ n: count() })
    .from(gameScores)
    .where(and(isNotNull(gameScores.curascore), gte(gameScores.curascore, 66))),
  ])

  const total      = Number(totals[0]?.total ?? 0)
  const noLootBox  = Number(totals[0]?.noLootBoxes ?? 0)
  const avgE       = Math.round(Number(eRated[0]?.avgScore ?? 0))
  const greenCount = Number(green[0]?.n ?? 0)

  return {
    totalScored:    total,
    lootBoxFreePct: total > 0 ? Math.round((noLootBox / total) * 100) : 0,
    avgCurascoreE:  avgE,
    greenCount,
  }
}

// ─── Safe Swap generator ──────────────────────────────────────────────────────

function buildRiskType(monetization: number | null, social: number | null, dopamine: number | null): string {
  if (monetization != null && monetization >= 0.45) return 'monetization'
  if (dopamine     != null && dopamine     >= 0.45) return 'dopamine'
  if (social       != null && social       >= 0.45) return 'social'
  return 'general'
}

const RISK_EXPLANATIONS: Record<string, string> = {
  monetization: 'This game uses real-money purchases, loot boxes, or currency obfuscation — design techniques proven to encourage overspending, especially in children.',
  dopamine:     'This game is engineered with variable reward loops and near-miss mechanics — the same psychological patterns used in slot machines — to make it hard to stop playing.',
  social:       'This game uses social obligation mechanics: guild requirements, friend leaderboards, and competitive pressure that create anxiety around logging off.',
  general:      'Our analysis found multiple high-risk design patterns that outweigh its developmental benefits.',
}

function buildFromReason(monetization: number | null, social: number | null, dopamine: number | null): string {
  if (monetization != null && monetization >= 0.55) return 'Heavy monetization pressure and spending prompts'
  if (social       != null && social       >= 0.55) return 'Unmoderated social features and stranger-interaction risks'
  if (dopamine     != null && dopamine     >= 0.55) return 'Compulsive loop design — hard to put down'
  if (monetization != null && monetization >= 0.4)  return 'In-app purchases targeting young players'
  return 'High overall risk score across safety dimensions'
}

function buildToReason(bds: number | null, ris: number | null): string {
  if (bds != null && bds >= 0.6 && ris != null && ris <= 0.25) return 'Strong developmental benefits with minimal safety concerns'
  if (bds != null && bds >= 0.5)  return 'Similar gameplay energy with meaningful skills development'
  if (ris != null && ris <= 0.2)  return 'Same genre appeal — no spending pressure or social risks'
  return 'Much safer by the numbers, comparable fun factor'
}

async function getSwapPair(): Promise<SwapPair | null> {
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
        reason:    buildToReason(g.bds, g.ris),
        href:      `/game/${g.slug}`,
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
      reason:          buildFromReason(fromGame.monetizationRisk, fromGame.socialRisk, fromGame.dopamineRisk),
      href:            `/game/${fromGame.slug}`,
      riskType,
      riskExplanation: RISK_EXPLANATIONS[riskType],
    },
    alternatives,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DiscoverPage() {
  const [topGames, swap, stats] = await Promise.all([
    getTopGames(),
    getSwapPair(),
    getCatalogStats(),
  ])
  return <GameDiscoveryDashboard topGames={topGames} swap={swap ?? undefined} stats={stats} />
}
