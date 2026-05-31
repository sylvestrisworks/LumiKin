import { db } from '@/lib/db'
import { games, gameScores, platformExperiences, experienceScores } from '@/lib/db/schema'
import { and, asc, eq, isNotNull, isNull, ne, or } from 'drizzle-orm'
import { sanityClient } from '@/sanity/lib/client'
import { allGuideSlugsQuery, allPostSlugsQuery } from '@/sanity/lib/queries'

export const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
export const LOCALES = ['en', 'es', 'fr', 'sv', 'de'] as const
export type Locale = typeof LOCALES[number]

// Google caps a single sitemap at 50 000 URLs / 50 MB. Each entry below is
// ~465 bytes (5 alternates per <url>); 20 000 keeps each chunk ~9 MB.
export const CHUNK_SIZE = 20_000

const DB_TO_URL_SLUG: Record<string, string> = {
  'fortnite-creative': 'fortnite',
}

export type SitemapEntry = {
  loc: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
  alternates?: Record<string, string>
}

function localeUrl(locale: Locale, path: string): string {
  return `${BASE_URL}/${locale}${path}`
}

function multiLocaleEntry(
  path: string,
  priority: number,
  changefreq: SitemapEntry['changefreq'],
  lastmod?: Date,
): SitemapEntry[] {
  const alternates: Record<string, string> = Object.fromEntries(
    LOCALES.map((l) => [l, localeUrl(l, path)]),
  )
  return LOCALES.map((locale) => ({
    loc: localeUrl(locale, path),
    lastmod: lastmod?.toISOString(),
    changefreq,
    priority,
    alternates,
  }))
}

export async function buildAllEntries(): Promise<SitemapEntry[]> {
  const staticEntries: SitemapEntry[] = [
    ...multiLocaleEntry('/',                       1.0, 'daily'),
    ...multiLocaleEntry('/browse',                 0.9, 'daily'),
    ...multiLocaleEntry('/partners',               0.8, 'monthly'),
    ...multiLocaleEntry('/methodology',            0.8, 'monthly'),
    ...multiLocaleEntry('/press',                  0.7, 'monthly'),
    ...multiLocaleEntry('/discover',               0.8, 'weekly'),
    ...multiLocaleEntry('/learn',                  0.8, 'weekly'),
    ...multiLocaleEntry('/guides',                 0.8, 'weekly'),
    ...multiLocaleEntry('/blog',                   0.7, 'daily'),
    ...multiLocaleEntry('/faq',                    0.5, 'monthly'),
    ...multiLocaleEntry('/privacy',                0.3, 'yearly'),
    ...multiLocaleEntry('/terms',                  0.3, 'yearly'),
    ...multiLocaleEntry('/game/roblox',            0.8, 'daily'),
    ...multiLocaleEntry('/game/fortnite-creative', 0.8, 'weekly'),
    ...multiLocaleEntry('/age',                    0.8, 'weekly'),
  ]

  const ageEntries: SitemapEntry[] = Array.from({ length: 14 }, (_, i) => i + 4)
    .flatMap((age) => multiLocaleEntry(`/age/${age}`, 0.7, 'weekly'))

  const allGames = await db
    .select({ slug: games.slug, calculatedAt: gameScores.calculatedAt })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      isNotNull(gameScores.curascore),
      or(isNull(games.contentType), ne(games.contentType, 'platform')),
    ))
    .orderBy(asc(games.id))

  const gameEntries: SitemapEntry[] = allGames.flatMap((g) =>
    multiLocaleEntry(`/game/${g.slug}`, 0.8, 'weekly', g.calculatedAt ?? undefined),
  )

  const allUgc = await db
    .select({
      slug:         platformExperiences.slug,
      platformSlug: games.slug,
      calculatedAt: experienceScores.calculatedAt,
    })
    .from(platformExperiences)
    .innerJoin(games, eq(games.id, platformExperiences.platformId))
    .innerJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .where(and(eq(games.contentType, 'platform'), isNotNull(experienceScores.curascore), eq(platformExperiences.isPublic, true)))
    .orderBy(asc(platformExperiences.id))

  const ugcEntries: SitemapEntry[] = allUgc.flatMap((exp) =>
    multiLocaleEntry(
      `/game/${exp.platformSlug}/${exp.slug}`,
      0.7,
      'weekly',
      exp.calculatedAt ?? undefined,
    ),
  )

  const platformDbSlugs = Array.from(new Set(allUgc.map((e) => e.platformSlug)))
  const platformHubEntries: SitemapEntry[] = platformDbSlugs.flatMap((dbSlug) =>
    multiLocaleEntry(`/platform/${DB_TO_URL_SLUG[dbSlug] ?? dbSlug}`, 0.8, 'weekly'),
  )

  const traditionalPlatformSlugs = ['playstation', 'xbox', 'nintendo-switch', 'ios', 'android', 'pc']
  const traditionalPlatformEntries: SitemapEntry[] = traditionalPlatformSlugs.flatMap((slug) =>
    multiLocaleEntry(`/platform/${slug}`, 0.8, 'weekly'),
  )

  type SanitySlug = { slug: string; locale: string; _updatedAt?: string }
  const [guideSlugs, postSlugs]: [SanitySlug[], SanitySlug[]] = sanityClient
    ? await Promise.all([
        sanityClient.fetch(allGuideSlugsQuery).catch(() => []),
        sanityClient.fetch(allPostSlugsQuery).catch(() => []),
      ])
    : [[], []]

  const guideEntries: SitemapEntry[] = guideSlugs.map((g) => ({
    loc: localeUrl((g.locale as Locale) ?? 'en', `/guides/${g.slug}`),
    lastmod: g._updatedAt,
    changefreq: 'monthly',
    priority: 0.7,
  }))

  const postEntries: SitemapEntry[] = postSlugs.map((p) => ({
    loc: localeUrl((p.locale as Locale) ?? 'en', `/blog/${p.slug}`),
    lastmod: p._updatedAt,
    changefreq: 'weekly',
    priority: 0.6,
  }))

  return [
    ...staticEntries,
    ...ageEntries,
    ...gameEntries,
    ...ugcEntries,
    ...platformHubEntries,
    ...traditionalPlatformEntries,
    ...guideEntries,
    ...postEntries,
  ]
}

const XML_ESCAPE: Record<string, string> = {
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
}
export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => XML_ESCAPE[c]!)
}

export function renderUrlset(entries: SitemapEntry[]): string {
  const items = entries.map((e) => {
    const alt = e.alternates
      ? Object.entries(e.alternates)
          .map(([lang, href]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(href)}"/>`)
          .join('')
      : ''
    const lastmod = e.lastmod ? `<lastmod>${escapeXml(e.lastmod)}</lastmod>` : ''
    const changefreq = e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ''
    const priority = e.priority != null ? `<priority>${e.priority}</priority>` : ''
    return `<url><loc>${escapeXml(e.loc)}</loc>${alt}${lastmod}${changefreq}${priority}</url>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${items}</urlset>`
}

export function renderIndex(chunkCount: number, lastmod: string): string {
  const items = Array.from({ length: chunkCount }, (_, id) =>
    `<sitemap><loc>${BASE_URL}/sitemap/${id}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`
}
