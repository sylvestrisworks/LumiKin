import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { games, gameScores, platformExperiences, experienceScores } from '@/lib/db/schema'
import { and, asc, eq, isNotNull, isNull, ne, or } from 'drizzle-orm'
import { sanityClient } from '@/sanity/lib/client'
import { allGuideSlugsQuery, allPostSlugsQuery } from '@/sanity/lib/queries'

// force-dynamic so Vercel regenerates on every request without caching at the edge.
// The DB queries are fast (indexed slug+curascore scans).
// We crossed Google's 50 000-URL cap in May 2026 — sitemap is now split via
// generateSitemaps() into deterministic chunks of CHUNK_SIZE URLs. Next.js serves
// the index at /sitemap.xml and each chunk at /sitemap/<id>.xml automatically.
export const dynamic = 'force-dynamic'

const CHUNK_SIZE = 45_000

const DB_TO_URL_SLUG: Record<string, string> = {
  'fortnite-creative': 'fortnite',
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
const LOCALES   = ['en', 'es', 'fr', 'sv', 'de'] as const
type Locale = typeof LOCALES[number]

function localeUrl(locale: Locale, path: string): string {
  return `${BASE_URL}/${locale}${path}`
}

function multiLocaleEntry(
  path: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  lastModified?: Date,
): MetadataRoute.Sitemap {
  return LOCALES.map((locale) => ({
    url: localeUrl(locale, path),
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, localeUrl(l, path)])),
    },
  }))
}

async function buildAllEntries(): Promise<MetadataRoute.Sitemap> {

  // ── Static pages ──────────────────────────────────────────────────────────
  const staticEntries: MetadataRoute.Sitemap = [
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

  // Age-specific discovery pages: /age/4 ... /age/17
  const ageEntries: MetadataRoute.Sitemap = Array.from({ length: 14 }, (_, i) => i + 4)
    .flatMap((age) => multiLocaleEntry(`/age/${age}`, 0.7, 'weekly'))

  // ── Scored games — lastModified = calculatedAt from the score row ────────
  const allGames = await db
    .select({ slug: games.slug, calculatedAt: gameScores.calculatedAt })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      isNotNull(gameScores.curascore),
      or(isNull(games.contentType), ne(games.contentType, 'platform')),
    ))
    .orderBy(asc(games.id))

  const gameEntries: MetadataRoute.Sitemap = allGames.flatMap((g) =>
    multiLocaleEntry(`/game/${g.slug}`, 0.8, 'weekly', g.calculatedAt ?? undefined),
  )

  // ── Scored UGC experiences ────────────────────────────────────────────────
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

  const ugcEntries: MetadataRoute.Sitemap = allUgc.flatMap((exp) =>
    multiLocaleEntry(
      `/game/${exp.platformSlug}/${exp.slug}`,
      0.7,
      'weekly',
      exp.calculatedAt ?? undefined,
    ),
  )

  // UGC platform hub pages (Roblox, Fortnite Creative, etc.)
  const platformDbSlugs = Array.from(new Set(allUgc.map((e) => e.platformSlug)))
  const platformHubEntries: MetadataRoute.Sitemap = platformDbSlugs.flatMap((dbSlug) =>
    multiLocaleEntry(`/platform/${DB_TO_URL_SLUG[dbSlug] ?? dbSlug}`, 0.8, 'weekly'),
  )

  // Traditional platform landing pages (PlayStation, Xbox, Nintendo Switch, iOS, Android, PC)
  const traditionalPlatformSlugs = ['playstation', 'xbox', 'nintendo-switch', 'ios', 'android', 'pc']
  const traditionalPlatformEntries: MetadataRoute.Sitemap = traditionalPlatformSlugs.flatMap((slug) =>
    multiLocaleEntry(`/platform/${slug}`, 0.8, 'weekly'),
  )

  // ── Sanity content pages ──────────────────────────────────────────────────
  type SanitySlug = { slug: string; locale: string; _updatedAt?: string }
  const [guideSlugs, postSlugs]: [SanitySlug[], SanitySlug[]] = sanityClient
    ? await Promise.all([
        sanityClient.fetch(allGuideSlugsQuery).catch(() => []),
        sanityClient.fetch(allPostSlugsQuery).catch(() => []),
      ])
    : [[], []]

  const guideEntries: MetadataRoute.Sitemap = guideSlugs.map((g) => ({
    url: localeUrl((g.locale as Locale) ?? 'en', `/guides/${g.slug}`),
    lastModified: g._updatedAt ? new Date(g._updatedAt) : undefined,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  const postEntries: MetadataRoute.Sitemap = postSlugs.map((p) => ({
    url: localeUrl((p.locale as Locale) ?? 'en', `/blog/${p.slug}`),
    lastModified: p._updatedAt ? new Date(p._updatedAt) : undefined,
    changeFrequency: 'weekly' as const,
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

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  const all = await buildAllEntries()
  const count = Math.max(1, Math.ceil(all.length / CHUNK_SIZE))
  return Array.from({ length: count }, (_, id) => ({ id }))
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const all = await buildAllEntries()
  return all.slice(id * CHUNK_SIZE, (id + 1) * CHUNK_SIZE)
}
