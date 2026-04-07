export const dynamic = 'force-dynamic'

import { desc, eq, isNotNull, lte, gte, and, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import GameDiscoveryDashboard from '@/components/GameDiscoveryDashboard'
import type { GameSummary, SwapPair } from '@/types/game'

export const metadata: Metadata = {
  title: 'Discover — Good Game Parent',
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
    .limit(24)

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

// ─── Safe Swap generator ──────────────────────────────────────────────────────

function buildFromReason(monetization: number | null, social: number | null, dopamine: number | null): string {
  if (monetization != null && monetization >= 0.55) return 'Heavy monetization pressure and spending prompts'
  if (social != null && social >= 0.55) return 'Unmoderated social features and stranger-interaction risks'
  if (dopamine != null && dopamine >= 0.55) return 'Compulsive loop design — hard to put down'
  if (monetization != null && monetization >= 0.4) return 'In-app purchases targeting young players'
  return 'High overall risk score across safety dimensions'
}

function buildToReason(bds: number | null, ris: number | null): string {
  if (bds != null && bds >= 0.6 && ris != null && ris <= 0.25) return 'Strong developmental benefits with minimal safety concerns'
  if (bds != null && bds >= 0.5) return 'Similar gameplay energy with meaningful skills development'
  if (ris != null && ris <= 0.2) return 'Same genre appeal — no spending pressure or social risks'
  return 'Much safer by the numbers, comparable fun factor'
}

async function getSwapPair(): Promise<SwapPair | null> {
  // Pool of high-risk games (curascore ≤ 40, ris ≥ 0.45) that have genres
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
      sql`jsonb_typeof(${games.genres}::jsonb) = 'array'`,
      sql`jsonb_array_length(${games.genres}::jsonb) > 0`,
    ))
    .orderBy(desc(gameScores.ris))
    .limit(20)

  if (risky.length === 0) return null

  // Pick one deterministically for the day (rotates daily)
  const dayIndex = Math.floor(Date.now() / 86_400_000)
  const fromGame = risky[dayIndex % risky.length]
  const fromGenres = (fromGame.genres as string[]) ?? []

  // Find a safer game: curascore ≥ 65, ris ≤ 0.3, sharing at least one genre, same-ish ESRB
  const ESRB_ORDER = ['E', 'E10+', 'T', 'M', 'AO']
  const fromEsrbIdx = ESRB_ORDER.indexOf(fromGame.esrbRating ?? 'T')
  const allowedEsrb = ESRB_ORDER.slice(0, Math.max(fromEsrbIdx + 1, 2)) // allow up to same rating

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
      sql`${games.esrbRating} = ANY(ARRAY[${sql.join(allowedEsrb.map(r => sql`${r}`), sql`, `)}])`,
    ))
    .orderBy(desc(gameScores.curascore))
    .limit(40)

  // Prefer genre overlap, fall back to any safe game
  const withOverlap = safePool.filter(g => {
    const gGenres = (g.genres as string[]) ?? []
    return fromGenres.some(fg => gGenres.includes(fg))
  })

  const toGame = withOverlap.length > 0
    ? withOverlap[dayIndex % withOverlap.length]
    : safePool[0]

  if (!toGame) return null

  const fromGenre = fromGenres[0] ?? 'Action'
  const toGenres  = (toGame.genres as string[]) ?? []
  const toGenre   = toGenres[0] ?? fromGenre

  return {
    from: {
      title:     fromGame.title,
      genre:     fromGenre,
      curascore: fromGame.curascore ?? 0,
      reason:    buildFromReason(fromGame.monetizationRisk, fromGame.socialRisk, fromGame.dopamineRisk),
      href:      `/game/${fromGame.slug}`,
    },
    to: {
      title:     toGame.title,
      genre:     toGenre,
      curascore: toGame.curascore ?? 0,
      reason:    buildToReason(toGame.bds, toGame.ris),
      href:      `/game/${toGame.slug}`,
    },
  }
}

export default async function DiscoverPage() {
  const [topGames, swap] = await Promise.all([getTopGames(), getSwapPair()])
  return <GameDiscoveryDashboard topGames={topGames} swap={swap ?? undefined} />
}
