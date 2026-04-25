export const revalidate = 3600

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { eq, and, desc, asc, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, platformExperiences, experienceScores } from '@/lib/db/schema'
import PlatformExperienceCard, { type PlatformExperienceSummary } from '@/components/PlatformExperienceCard'
import PlatformScoreHistogram, { type HistogramBucket } from '@/components/PlatformScoreHistogram'

// Friendly URL slug → DB slug. Add entries here when new platform slugs diverge.
const SLUG_ALIASES: Record<string, string> = {
  fortnite: 'fortnite-creative',
}

// Reverse map for generateStaticParams (DB slug → URL slug)
const DB_TO_URL: Record<string, string> = {
  'fortnite-creative': 'fortnite',
}

// Per-platform accent gradient (DB slug keyed)
const ACCENT: Record<string, string> = {
  roblox:              'from-red-950/95 via-red-900/70 to-slate-900/20',
  'fortnite-creative': 'from-indigo-950/95 via-indigo-900/70 to-slate-900/20',
}

const ICON_BG: Record<string, string> = {
  roblox:              'bg-red-600 ring-red-400/40',
  'fortnite-creative': 'bg-blue-600 ring-blue-400/40',
}

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const dbSlug = SLUG_ALIASES[slug] ?? slug
  const [platform] = await db
    .select({ title: games.title })
    .from(games)
    .where(eq(games.slug, dbSlug))
    .limit(1)

  if (!platform) return {}
  return {
    title: `${platform.title} Hub — LumiKin`,
    description: `LumiKin safety scores for ${platform.title} experiences. Browse ratings by score, find the safest picks, and see what to watch out for.`,
  }
}

export async function generateStaticParams() {
  const platforms = await db
    .select({ slug: games.slug })
    .from(games)
    .where(eq(games.contentType, 'platform'))

  const locales = ['en', 'es', 'fr', 'sv', 'de']
  return locales.flatMap(locale =>
    platforms.map(p => ({
      locale,
      slug: DB_TO_URL[p.slug] ?? p.slug,
    }))
  )
}

function toExperienceSummary(
  exp: typeof platformExperiences.$inferSelect,
  score: typeof experienceScores.$inferSelect | null,
): PlatformExperienceSummary {
  return {
    slug:                      exp.slug,
    title:                     exp.title,
    thumbnailUrl:              exp.thumbnailUrl,
    creatorName:               exp.creatorName,
    activePlayers:             exp.activePlayers,
    curascore:                 score?.curascore ?? null,
    timeRecommendationMinutes: score?.timeRecommendationMinutes ?? null,
    recommendedMinAge:         score?.recommendedMinAge ?? null,
    strangerRisk:              score?.strangerRisk ?? null,
    monetizationScore:         score?.monetizationScore ?? null,
  }
}

function ExperienceGrid({
  experiences,
  locale,
  platformSlug,
}: {
  experiences: PlatformExperienceSummary[]
  locale: string
  platformSlug: string
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:snap-none">
      {experiences.map(exp => (
        <div key={exp.slug} className="snap-start shrink-0 w-44 sm:w-auto">
          <PlatformExperienceCard exp={exp} locale={locale} platformSlug={platformSlug} />
        </div>
      ))}
    </div>
  )
}

export default async function PlatformHubPage({ params }: Props) {
  const { locale, slug } = await params
  const dbSlug = SLUG_ALIASES[slug] ?? slug

  const [
    platformRows,
    [statsRow],
    bucketRows,
    topRows,
    bottomRows,
    recentRows,
  ] = await Promise.all([
    // 1. Platform game row
    db
      .select({
        id:              games.id,
        slug:            games.slug,
        title:           games.title,
        description:     games.description,
        backgroundImage: games.backgroundImage,
        esrbRating:      games.esrbRating,
        pegiRating:      games.pegiRating,
        contentType:     games.contentType,
      })
      .from(games)
      .where(eq(games.slug, dbSlug))
      .limit(1),

    // 2. Aggregate stats (count, avg, min, max curascore)
    db
      .select({
        count:    sql<number>`count(${experienceScores.id})::int`,
        avgScore: sql<number>`round(avg(${experienceScores.curascore}))::int`,
        minScore: sql<number>`min(${experienceScores.curascore})`,
        maxScore: sql<number>`max(${experienceScores.curascore})`,
      })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore))),

    // 3. Score distribution buckets
    db
      .select({
        bucket: sql<number>`floor(${experienceScores.curascore} / 10) * 10`,
        count:  sql<number>`count(*)::int`,
      })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore)))
      .groupBy(sql`floor(${experienceScores.curascore} / 10) * 10`)
      .orderBy(sql`floor(${experienceScores.curascore} / 10) * 10`),

    // 4. Top 10 by LumiScore DESC
    db
      .select({ exp: platformExperiences, score: experienceScores })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore)))
      .orderBy(desc(experienceScores.curascore))
      .limit(10),

    // 5. Bottom 10 by LumiScore ASC
    db
      .select({ exp: platformExperiences, score: experienceScores })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore)))
      .orderBy(asc(experienceScores.curascore))
      .limit(10),

    // 6. 10 most recently scored
    db
      .select({ exp: platformExperiences, score: experienceScores })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore)))
      .orderBy(desc(experienceScores.calculatedAt))
      .limit(10),
  ])

  const platform = platformRows[0]
  if (!platform || platform.contentType !== 'platform') notFound()

  const buckets = bucketRows as HistogramBucket[]
  const topExperiences    = topRows.map(r    => toExperienceSummary(r.exp, r.score))
  const bottomExperiences = bottomRows.map(r => toExperienceSummary(r.exp, r.score))
  const recentExperiences = recentRows.map(r => toExperienceSummary(r.exp, r.score))

  const scoredCount = Number(statsRow?.count ?? 0)
  const avgScore    = statsRow?.avgScore ?? null
  const accent      = ACCENT[dbSlug] ?? 'from-slate-950/95 via-slate-900/70 to-slate-900/20'
  const iconBg      = ICON_BG[dbSlug] ?? 'bg-indigo-600 ring-indigo-400/40'
  const initials    = platform.title.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Platform hero */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-lg bg-slate-900">
          {platform.backgroundImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={platform.backgroundImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          )}
          <div className={`absolute inset-0 bg-gradient-to-r ${accent}`} />
          <div className="relative px-6 py-8 flex items-center gap-5">
            <div className={`w-[72px] h-[72px] rounded-2xl ${iconBg} ring-2 flex items-center justify-center shrink-0 shadow-lg`}>
              <span className="text-3xl font-black text-white select-none">{initials}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[11px] font-semibold bg-white/10 text-white/70 border border-white/20 px-2 py-0.5 rounded-full tracking-wide uppercase">
                  Platform
                </span>
                {avgScore != null && (
                  <span className="text-[11px] font-bold bg-white/10 border border-white/20 text-white/80 px-2 py-0.5 rounded-full">
                    Avg LumiScore {avgScore}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white">{platform.title}</h1>
              {platform.description && (
                <p className="text-sm text-white/70 mt-1 line-clamp-2">{platform.description}</p>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                  <span className="text-base font-bold text-white">{scoredCount}</span>
                  <span className="text-xs text-white/50 ml-1">rated</span>
                </div>
                {platform.esrbRating && (
                  <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                    <span className="text-xs text-white/60">ESRB {platform.esrbRating}</span>
                  </div>
                )}
                {platform.pegiRating && (
                  <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                    <span className="text-xs text-white/60">PEGI {platform.pegiRating}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Score distribution histogram */}
        {scoredCount > 0 && (
          <PlatformScoreHistogram buckets={buckets} />
        )}

        {scoredCount === 0 && (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            No scored experiences yet. Check back soon.
          </div>
        )}

        {/* Top rated */}
        {topExperiences.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              Top Rated
            </h2>
            <ExperienceGrid
              experiences={topExperiences}
              locale={locale}
              platformSlug={dbSlug}
            />
          </section>
        )}

        {/* Lowest rated — only shown when there are enough distinct results */}
        {bottomExperiences.length > 0 && scoredCount >= 4 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              Lowest Rated
            </h2>
            <ExperienceGrid
              experiences={bottomExperiences}
              locale={locale}
              platformSlug={dbSlug}
            />
          </section>
        )}

        {/* Recently scored */}
        {recentExperiences.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              Recently Scored
            </h2>
            <ExperienceGrid
              experiences={recentExperiences}
              locale={locale}
              platformSlug={dbSlug}
            />
          </section>
        )}

      </main>
    </div>
  )
}
