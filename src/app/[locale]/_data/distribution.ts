import { unstable_cache } from 'next/cache'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

// LumiScore distribution across the whole rated catalogue, bucketed into ten
// 10-point bands (0–9, 10–19, … 90–100). Powers the "Where games land" hero
// histogram. One grouped scan, cached for 5 min alongside the other site stats.
export type ScoreBand = { band: number; count: number }

async function computeScoreDistribution(): Promise<ScoreBand[]> {
  const rows = (await db.execute(sql`
    SELECT LEAST(FLOOR(curascore / 10), 9)::int AS band, count(*)::int AS count
    FROM game_scores
    WHERE curascore IS NOT NULL
    GROUP BY band
    ORDER BY band
  `)) as unknown as { band: number; count: number }[]

  // Densify to all ten bands so empty bands still render a baseline slot.
  const byBand = new Map(rows.map(r => [Number(r.band), Number(r.count)]))
  return Array.from({ length: 10 }, (_, band) => ({ band, count: byBand.get(band) ?? 0 }))
}

export const fetchScoreDistribution = unstable_cache(
  computeScoreDistribution,
  ['score-distribution'],
  { revalidate: 300 },
)
