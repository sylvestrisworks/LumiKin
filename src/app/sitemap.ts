import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { games, gameScores, platformExperiences, experienceScores } from '@/lib/db/schema'
import { and, eq, isNotNull } from 'drizzle-orm'
import { sanityClient } from '@/sanity/lib/client'
import { allGuideSlugsQuery, allPostSlugsQuery } from '@/sanity/lib/queries'

// DB slug → friendly hub URL slug (must match platform/[slug]/page.tsx)
const DB_TO_URL_SLUG: Record<string, string> = {
  'fortnite-creative': 'fortnite',
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
const LOCALES = ['en', 'es', 'fr', 'sv', 'de'] as const
const DEFAULT_LOCALE = 'en'

type Locale = typeof LOCALES[number]

function localeUrl(locale: Locale, path: string): string {
  return `${BASE_URL}/${locale}${path}`
}

function multiLocaleEntry(
  path: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  lastModified?: Date,
): MetadataRoute.Sitemap[number][] {
  return LOCALES.map((locale) => ({
    url: localeUrl(locale, path),
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, localeUrl(l, path)]),
      ),
    },
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Static pages ──────────────────────────────────────────────────────────
  const staticEntries: MetadataRoute.Sitemap = [
    ...multiLocaleEntry('/', 1.0, 'daily'),
    ...multiLocaleEntry('/browse', 0.9, 'daily'),
    ...multiLocaleEntry('/discover', 0.8, 'weekly'),
    ...multiLocaleEntry('/learn', 0.8, 'weekly'),
    ...multiLocaleEntry('/guides', 0.8, 'weekly'),
    ...multiLocaleEntry('/blog', 0.7, 'daily'),
    ...multiLocaleEntry('/faq', 0.5, 'monthly'),
    ...multiLocaleEntry('/privacy', 0.3, 'yearly'),
    ...multiLocaleEntry('/terms', 0.3, 'yearly'),
    ...multiLocaleEntry('/game/roblox', 0.8, 'daily'),
    ...multiLocaleEntry('/game/fortnite-creative', 0.8, 'weekly'),
  ]

  // ── Game pages — only scored games (curascore IS NOT NULL) ───────────────
  const allGames = await db
    .select({ slug: games.slug, updatedAt: games.updatedAt })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNotNull(gameScores.curascore))

  const gameEntries: MetadataRoute.Sitemap = allGames.flatMap((game) =>
    multiLocaleEntry(
      `/game/${game.slug}`,
      0.8,
      'weekly',
      game.updatedAt ?? undefined,
    ),
  )

  // ── UGC experience pages — only scored experiences ────────────────────────
  const allUgcExperiences = await db
    .select({
      slug:         platformExperiences.slug,
      updatedAt:    platformExperiences.updatedAt,
      platformSlug: games.slug,
    })
    .from(platformExperiences)
    .innerJoin(games, eq(games.id, platformExperiences.platformId))
    .innerJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .where(and(eq(games.contentType, 'platform'), isNotNull(experienceScores.curascore)))

  const ugcExperienceEntries: MetadataRoute.Sitemap = allUgcExperiences.flatMap((exp) =>
    multiLocaleEntry(
      `/game/${exp.platformSlug}/${exp.slug}`,
      0.7,
      'weekly',
      exp.updatedAt ?? undefined,
    ),
  )

  // One hub page entry per platform that has at least one experience
  const platformDbSlugs = Array.from(new Set(allUgcExperiences.map((e) => e.platformSlug)))
  const platformHubEntries: MetadataRoute.Sitemap = platformDbSlugs.flatMap((dbSlug) =>
    multiLocaleEntry(
      `/platform/${DB_TO_URL_SLUG[dbSlug] ?? dbSlug}`,
      0.8,
      'weekly',
    ),
  )

  // ── Sanity content pages ──────────────────────────────────────────────────
  type SanitySlug = { slug: string; locale: string; _updatedAt?: string }

  const [guideSlugs, postSlugs]: [SanitySlug[], SanitySlug[]] = sanityClient
    ? await Promise.all([
        sanityClient.fetch(allGuideSlugsQuery).catch(() => []),
        sanityClient.fetch(allPostSlugsQuery).catch(() => []),
      ])
    : [[], []]

  const guideContentEntries: MetadataRoute.Sitemap = guideSlugs.map((g) => ({
    url: localeUrl((g.locale as Locale) ?? 'en', `/guides/${g.slug}`),
    lastModified: g._updatedAt ? new Date(g._updatedAt) : undefined,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  const postContentEntries: MetadataRoute.Sitemap = postSlugs.map((p) => ({
    url: localeUrl((p.locale as Locale) ?? 'en', `/blog/${p.slug}`),
    lastModified: p._updatedAt ? new Date(p._updatedAt) : undefined,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [
    ...staticEntries,
    ...gameEntries,
    ...ugcExperienceEntries,
    ...platformHubEntries,
    ...guideContentEntries,
    ...postContentEntries,
  ]
}
