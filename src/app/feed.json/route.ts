import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { desc, eq, isNotNull } from 'drizzle-orm'

export const revalidate = 3600

const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
const FEED_URL   = `${SITE_URL}/feed.json`
const FEED_ITEMS = 50

export async function GET() {
  const rows = await db
    .select({
      slug:             games.slug,
      title:            games.title,
      platforms:        games.platforms,
      curascore:        gameScores.curascore,
      timeLabel:        gameScores.timeRecommendationLabel,
      executiveSummary: gameScores.executiveSummary,
      calculatedAt:     gameScores.calculatedAt,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNotNull(gameScores.curascore))
    .orderBy(desc(gameScores.calculatedAt))
    .limit(FEED_ITEMS)

  const items = rows.map((row) => {
    const url  = `${SITE_URL}/en/game/${row.slug}`
    const platform = Array.isArray(row.platforms) && (row.platforms as string[]).length > 0
      ? (row.platforms as string[])[0]
      : null

    const summary = row.executiveSummary
      ? row.executiveSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : null

    const contentText = [
      `LumiScore: ${row.curascore}/100`,
      row.timeLabel ? `Recommended: ${row.timeLabel}/day` : null,
      platform ? `Platform: ${platform}` : null,
      summary,
    ].filter(Boolean).join('\n\n')

    return {
      id:             url,
      url,
      title:          row.title,
      content_text:   contentText,
      date_published: (row.calculatedAt ?? new Date()).toISOString(),
      tags:           platform ? [platform] : undefined,
    }
  })

  const feed = {
    version:       'https://jsonfeed.org/version/1.1',
    title:         'LumiKin — Recently Scored Games',
    home_page_url: SITE_URL,
    feed_url:      FEED_URL,
    description:   `The ${FEED_ITEMS} most recently scored games on LumiKin — child-safety ratings covering developmental benefits, addictive design patterns, and daily screen-time recommendations.`,
    language:      'en',
    authors:       [{ name: 'LumiKin', url: SITE_URL }],
    icon:          `${SITE_URL}/lumikin-icon.svg`,
    items,
  }

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
