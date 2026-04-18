import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { games, platformExperiences } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sanityClient } from '@/sanity/lib/client'
import { allGuideSlugsQuery, allPostSlugsQuery } from '@/sanity/lib/queries'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'
const LOCALES = ['en', 'es', 'fr', 'sv', 'de'] as const
const DEFAULT_LOCALE = 'en'

type Locale = typeof LOCALES[number]

function localeUrl(locale: Locale, path: string): string {
  return locale === DEFAULT_LOCALE
    ? `${BASE_URL}${path}`
    : `${BASE_URL}/${locale}${path}`
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

  // ── Game pages ────────────────────────────────────────────────────────────
  const allGames = await db
    .select({ slug: games.slug, updatedAt: games.updatedAt })
    .from(games)

  const gameEntries: MetadataRoute.Sitemap = allGames.flatMap((game) =>
    multiLocaleEntry(
      `/game/${game.slug}`,
      0.8,
      'weekly',
      game.updatedAt ?? undefined,
    ),
  )

  // ── Roblox experience pages ────────────────────────────────────────────────
  const robloxPlatformId = (
    await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, 'roblox'))
      .limit(1)
  )[0]?.id

  const robloxExperiences = robloxPlatformId
    ? await db
        .select({ slug: platformExperiences.slug, updatedAt: platformExperiences.updatedAt })
        .from(platformExperiences)
        .where(eq(platformExperiences.platformId, robloxPlatformId))
    : []

  const robloxEntries: MetadataRoute.Sitemap = robloxExperiences.flatMap((exp) =>
    multiLocaleEntry(
      `/game/roblox/${exp.slug}`,
      0.7,
      'weekly',
      exp.updatedAt ?? undefined,
    ),
  )

  // ── Fortnite Creative island pages ────────────────────────────────────────
  const fortnitePlatformId = (
    await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, 'fortnite'))
      .limit(1)
  )[0]?.id

  const fortniteIslands = fortnitePlatformId
    ? await db
        .select({ slug: platformExperiences.slug, updatedAt: platformExperiences.updatedAt })
        .from(platformExperiences)
        .where(eq(platformExperiences.platformId, fortnitePlatformId))
    : []

  const fortniteEntries: MetadataRoute.Sitemap = fortniteIslands.flatMap((island) =>
    multiLocaleEntry(
      `/game/fortnite-creative/${island.slug}`,
      0.7,
      'weekly',
      island.updatedAt ?? undefined,
    ),
  )

  // ── Sanity content pages ──────────────────────────────────────────────────
  type SanitySlug = { slug: string; locale: string; _updatedAt?: string }

  const [guideSlugs, postSlugs]: [SanitySlug[], SanitySlug[]] = await Promise.all([
    sanityClient.fetch(allGuideSlugsQuery).catch(() => []),
    sanityClient.fetch(allPostSlugsQuery).catch(() => []),
  ])

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
    ...robloxEntries,
    ...fortniteEntries,
    ...guideContentEntries,
    ...postContentEntries,
  ]
}
