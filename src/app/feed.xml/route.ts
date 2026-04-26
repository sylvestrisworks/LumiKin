import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { desc, eq, isNotNull } from 'drizzle-orm'

export const revalidate = 3600

const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
const FEED_URL  = `${SITE_URL}/feed.xml`
const FEED_ITEMS = 50

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toRfc2822(date: Date): string {
  return date.toUTCString()
}

export async function GET() {
  const rows = await db
    .select({
      slug:              games.slug,
      title:             games.title,
      platforms:         games.platforms,
      curascore:         gameScores.curascore,
      timeLabel:         gameScores.timeRecommendationLabel,
      executiveSummary:  gameScores.executiveSummary,
      calculatedAt:      gameScores.calculatedAt,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNotNull(gameScores.curascore))
    .orderBy(desc(gameScores.calculatedAt))
    .limit(FEED_ITEMS)

  const now = new Date()
  const lastBuild = rows[0]?.calculatedAt ?? now

  const items = rows.map((row) => {
    const url  = `${SITE_URL}/en/game/${row.slug}`
    const platform = Array.isArray(row.platforms) && (row.platforms as string[]).length > 0
      ? (row.platforms as string[])[0]
      : null

    const summary = row.executiveSummary
      ? row.executiveSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
      : null

    const desc = [
      `LumiScore: ${row.curascore}/100`,
      row.timeLabel ? `Recommended: ${row.timeLabel}/day` : null,
      platform ? `Platform: ${platform}` : null,
      summary,
    ].filter(Boolean).join(' — ')

    return `
  <item>
    <title>${escapeXml(`${row.title} — LumiScore ${row.curascore}/100`)}</title>
    <link>${escapeXml(url)}</link>
    <description>${escapeXml(desc)}</description>
    <pubDate>${toRfc2822(row.calculatedAt ?? now)}</pubDate>
    <author>ratings@lumikin.org (LumiKin)</author>
    <guid isPermaLink="true">${escapeXml(url)}</guid>
  </item>`
  }).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>LumiKin — Recently Scored Games</title>
    <link>${escapeXml(`${SITE_URL}/en/browse`)}</link>
    <description>The ${FEED_ITEMS} most recently scored games on LumiKin — child-safety ratings covering developmental benefits, addictive design patterns, and daily screen-time recommendations.</description>
    <language>en</language>
    <lastBuildDate>${toRfc2822(lastBuild ?? now)}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${escapeXml(FEED_URL)}" rel="self" type="application/rss+xml"/>
    <image>
      <url>${escapeXml(`${SITE_URL}/lumikin-icon.svg`)}</url>
      <title>LumiKin</title>
      <link>${escapeXml(SITE_URL)}</link>
    </image>${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
