/**
 * GET /api/cron/coverage-report
 *
 * Daily DB health snapshot. Logs to stdout (visible in Vercel logs and
 * captured as GitHub Actions step output) and returns JSON for alerting.
 *
 * Reports:
 *   - games: total, scored, unscored, queued for rescore, stale (>180 days)
 *   - experiences: same breakdown for Roblox experience_scores
 *   - score distribution: curascore buckets (0-19, 20-39, 40-59, 60-79, 80-100)
 *   - avg curascore across all scored games
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, gameScores, platformExperiences, experienceScores } from '@/lib/db/schema'
import { and, eq, isNull, isNotNull, lt, sql } from 'drizzle-orm'

export const maxDuration = 60

const STALE_DAYS = 180

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const staleCutoff = new Date()
  staleCutoff.setDate(staleCutoff.getDate() - STALE_DAYS)

  // ── Games ─────────────────────────────────────────────────────────────────
  const [
    [{ total: totalGames }],
    [{ scored: scoredGames }],
    [{ queued: queuedGames }],
    [{ stale: staleGames }],
    [{ avg: avgCurascore }],
    distribution,
  ] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(games),

    db.select({ scored: sql<number>`count(*)` })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id)),

    db.select({ queued: sql<number>`count(*)` })
      .from(games)
      .where(eq(games.needsRescore, true)),

    db.select({ stale: sql<number>`count(*)` })
      .from(gameScores)
      .where(lt(gameScores.calculatedAt, staleCutoff)),

    db.select({ avg: sql<number>`round(avg(curascore))` })
      .from(gameScores)
      .where(isNotNull(gameScores.curascore)),

    db.select({
      bucket: sql<string>`
        case
          when curascore < 20  then '0-19'
          when curascore < 40  then '20-39'
          when curascore < 60  then '40-59'
          when curascore < 80  then '60-79'
          else                      '80-100'
        end`,
      count: sql<number>`count(*)`,
    })
      .from(gameScores)
      .where(isNotNull(gameScores.curascore))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ])

  // ── Experiences ───────────────────────────────────────────────────────────
  const [
    [{ total: totalExp }],
    [{ scored: scoredExp }],
    [{ stale: staleExp }],
  ] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(platformExperiences),

    db.select({ scored: sql<number>`count(*)` })
      .from(platformExperiences)
      .innerJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id)),

    db.select({ stale: sql<number>`count(*)` })
      .from(experienceScores)
      .where(lt(experienceScores.calculatedAt, staleCutoff)),
  ])

  const report = {
    date:    new Date().toISOString().slice(0, 10),
    games: {
      total:    Number(totalGames),
      scored:   Number(scoredGames),
      unscored: Number(totalGames) - Number(scoredGames),
      queued:   Number(queuedGames),
      stale:    Number(staleGames),
      coverage: `${Math.round((Number(scoredGames) / Number(totalGames)) * 100)}%`,
      avgCurascore: Number(avgCurascore),
      distribution: Object.fromEntries(distribution.map(r => [r.bucket, Number(r.count)])),
    },
    experiences: {
      total:    Number(totalExp),
      scored:   Number(scoredExp),
      unscored: Number(totalExp) - Number(scoredExp),
      stale:    Number(staleExp),
      coverage: Number(totalExp) > 0
        ? `${Math.round((Number(scoredExp) / Number(totalExp)) * 100)}%`
        : 'n/a',
    },
  }

  console.log('[coverage-report]', JSON.stringify(report, null, 2))

  return NextResponse.json(report)
}
