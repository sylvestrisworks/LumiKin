import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { games, gameScores, platformExperiences, experienceScores } from '@/lib/db/schema'
import { and, asc, count, eq, isNotNull } from 'drizzle-orm'
import { sanityClient } from '@/sanity/lib/client'
import { allGuideSlugsQuery, allPostSlugsQuery } from '@/sanity/lib/queries'

// Regenerate hourly so new scores appear in the sitemap within 60 minutes.
export const revalidate = 3600

const DB_TO_URL_SLUG: Record<string, string> = {
  'fortnite-creative': 'fortnite',
}

const BASE_URL    = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
const LOCALES     = ['en', 'es', 'fr', 'sv', 'de'] as const
type Locale = typeof LOCALES[number]

// Sitemap ID encoding (allows self-describing dispatch without re-querying counts):
//   0         → static / platform hub / Sanity pages
//   1000–1999 → game chunks  (1000 = chunk 0, 1001 = chunk 1, …)
//   2000–2999 → UGC experience chunks
const GAME_ID_OFFSET  = 1_000
const UGC_ID_OFFSET   = 2_000
// 9 000 slugs × 5 locales = 45 000 entries per sitemap — safely under the 50 000 URL limit.
const SLUGS_PER_CHUNK = 9_000

function chunkOf(id: number): { type: 'static' | 'games' | 'ugc'; n: number } {
  if (id < GAME_ID_OFFSET) return { type: 'static', n: 0 }
  if (id < UGC_ID_OFFSET)  return { type: 'games',  n: id - GAME_ID_OFFSET }
  return                           { type: 'ugc',    n: id - UGC_ID_OFFSET }
}

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

// Called once per revalidation to decide how many sitemaps are needed.
export async function generateSitemaps() {
  const [{ gameCount }] = await db
    .select({ gameCount: count() })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNotNull(gameScores.curascore))

  const [{ ugcCount }] = await db
    .select({ ugcCount: count() })
    .from(platformExperiences)
    .innerJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .where(isNotNull(experienceScores.curascore))

  const gameChunks = Math.max(1, Math.ceil(gameCount / SLUGS_PER_CHUNK))
  const ugcChunks  = Math.max(1, Math.ceil(ugcCount  / SLUGS_PER_CHUNK))

  return [
    { id: 0 },
    ...Array.from({ length: gameChunks }, (_, i) => ({ id: GAME_ID_OFFSET + i })),
    ...Array.from({ length: ugcChunks  }, (_, i) => ({ id: UGC_ID_OFFSET  + i })),
  ]
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const { type, n } = chunkOf(id)

  // ── Chunk 0: static pages, platform hubs, Sanity content ─────────────────
  if (type === 'static') {
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
    ]

    // One hub entry per platform that has at least one scored experience
    const platformRows = await db
      .selectDistinct({ slug: games.slug })
      .from(games)
      .innerJoin(platformExperiences, eq(platformExperiences.platformId, games.id))
      .innerJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
      .where(and(eq(games.contentType, 'platform'), isNotNull(experienceScores.curascore)))

    const platformEntries: MetadataRoute.Sitemap = platformRows.flatMap(({ slug }) =>
      multiLocaleEntry(`/platform/${DB_TO_URL_SLUG[slug] ?? slug}`, 0.8, 'weekly'),
    )

    // Sanity-authored guides and blog posts
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

    return [...staticEntries, ...platformEntries, ...guideEntries, ...postEntries]
  }

  // ── Game pages chunk ─────────────────────────────────────────────────────
  if (type === 'games') {
    const rows = await db
      .select({ slug: games.slug, calculatedAt: gameScores.calculatedAt })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(isNotNull(gameScores.curascore))
      .orderBy(asc(games.id))
      .limit(SLUGS_PER_CHUNK)
      .offset(n * SLUGS_PER_CHUNK)

    return rows.flatMap((g) =>
      multiLocaleEntry(`/game/${g.slug}`, 0.8, 'weekly', g.calculatedAt ?? undefined),
    )
  }

  // ── UGC experience pages chunk ───────────────────────────────────────────
  if (type === 'ugc') {
    const rows = await db
      .select({
        slug:         platformExperiences.slug,
        platformSlug: games.slug,
        calculatedAt: experienceScores.calculatedAt,
      })
      .from(platformExperiences)
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .innerJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
      .where(and(eq(games.contentType, 'platform'), isNotNull(experienceScores.curascore)))
      .orderBy(asc(platformExperiences.id))
      .limit(SLUGS_PER_CHUNK)
      .offset(n * SLUGS_PER_CHUNK)

    return rows.flatMap((exp) =>
      multiLocaleEntry(
        `/game/${exp.platformSlug}/${exp.slug}`,
        0.7,
        'weekly',
        exp.calculatedAt ?? undefined,
      ),
    )
  }

  return []
}
