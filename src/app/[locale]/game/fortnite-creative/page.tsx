export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games, gameScores } from '@/lib/db/schema'
import { eq, desc, and, lte, ilike, isNotNull, type SQL } from 'drizzle-orm'
import FortniteCard from '@/components/FortniteCard'
import { curascoreText } from '@/lib/ui'
import FortniteFilters, { type FortniteFilterState } from '@/components/FortniteFilters'
import { getTranslations } from 'next-intl/server'
import type { ExperienceSummary } from '@/components/ExperienceCard'

export const metadata: Metadata = {
  title: 'Fortnite Creative Map Guide — LumiKin',
  description: 'LumiKin ratings for popular Fortnite Creative maps. Find safe, fun maps for your child with scores for stranger risk, monetization pressure, and more.',
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function FortniteCreativeHubPage({ searchParams }: Props) {
  const [sp, t] = await Promise.all([searchParams, getTranslations('fortnite')])
  const filters: FortniteFilterState = {
    q:    typeof sp.q    === 'string' ? sp.q    : '',
    sort: typeof sp.sort === 'string' ? sp.sort : 'curascore',
    risk: typeof sp.risk === 'string' ? sp.risk : '',
    time: typeof sp.time === 'string' ? sp.time : '',
  }
  const hasFilters = !!(filters.q || filters.risk || filters.time || (filters.sort && filters.sort !== 'curascore'))

  // Find Fortnite Creative platform row
  const [fortnitePlatform] = await db
    .select({ id: games.id, title: games.title, backgroundImage: games.backgroundImage, description: games.description })
    .from(games)
    .where(eq(games.slug, 'fortnite-creative'))
    .limit(1)

  const [platformScore] = fortnitePlatform
    ? await db
        .select({ curascore: gameScores.curascore, timeRecommendationLabel: gameScores.timeRecommendationLabel })
        .from(gameScores)
        .where(eq(gameScores.gameId, fortnitePlatform.id))
        .limit(1)
    : [null]

  // Build filter conditions — only show maps for this platform
  const conditions: SQL[] = []
  if (fortnitePlatform) conditions.push(eq(platformExperiences.platformId, fortnitePlatform.id))
  if (filters.q)             conditions.push(ilike(platformExperiences.title, `%${filters.q}%`))
  if (filters.risk === 'low')    { conditions.push(isNotNull(experienceScores.id)); conditions.push(lte(experienceScores.riskScore, 0.33)) }
  if (filters.risk === 'medium') { conditions.push(isNotNull(experienceScores.id)); conditions.push(lte(experienceScores.riskScore, 0.66)) }
  if (filters.time === '30') { conditions.push(isNotNull(experienceScores.id)); conditions.push(lte(experienceScores.timeRecommendationMinutes, 30)) }
  if (filters.time === '60') { conditions.push(isNotNull(experienceScores.id)); conditions.push(lte(experienceScores.timeRecommendationMinutes, 60)) }

  const orderBy =
    filters.sort === 'newest' ? desc(platformExperiences.createdAt) :
                                desc(experienceScores.curascore)

  const rows = await db
    .select({ exp: platformExperiences, score: experienceScores })
    .from(platformExperiences)
    .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy)

  const maps: ExperienceSummary[] = rows.map(({ exp, score }) => ({
    slug:          exp.slug,
    title:         exp.title,
    thumbnailUrl:  exp.thumbnailUrl,
    creatorName:   exp.creatorName,
    activePlayers: null,
    visitCount:    null,
    curascore:     score?.curascore ?? null,
    timeRecommendationMinutes: score?.timeRecommendationMinutes ?? null,
    recommendedMinAge:         score?.recommendedMinAge ?? null,
    strangerRisk:              score?.strangerRisk ?? null,
    monetizationScore:         score?.monetizationScore ?? null,
  }))

  const scored   = maps.filter(e => e.curascore != null)
  const unscored = maps.filter(e => e.curascore == null)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Platform header */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
          {fortnitePlatform?.backgroundImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fortnitePlatform.backgroundImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-20 dark:opacity-10"
            />
          )}
          <div className="relative px-6 py-5 flex items-start gap-5">
            {/* Fortnite Creative logo */}
            <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
              <span className="text-xl font-black text-blue-500 select-none leading-none">FN</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Fortnite Creative</h1>
                <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">Platform</span>
                {platformScore?.curascore != null && (
                  <span className={`text-sm font-black ${curascoreText(platformScore.curascore)}`}>
                    Curascore {platformScore.curascore}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                Fortnite Creative lets players build and share their own maps. Quality and safety vary by map — browse our ratings below.
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 dark:text-slate-500">
                <span>{scored.length} {t('rated').toLowerCase()}</span>
                {platformScore?.timeRecommendationLabel && (
                  <span>Platform: {platformScore.timeRecommendationLabel}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search + filters */}
        <Suspense>
          <FortniteFilters active={filters} total={maps.length} />
        </Suspense>

        {/* Results */}
        {hasFilters ? (
          maps.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {maps.map(exp => (
                <FortniteCard key={exp.slug} exp={exp} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">
              No maps match your filters.
            </div>
          )
        ) : (
          <>
            {scored.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                  {t('rated')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {scored.map(exp => (
                    <FortniteCard key={exp.slug} exp={exp} />
                  ))}
                </div>
              </section>
            )}

            {unscored.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                  {t('awaitingRating')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {unscored.map(exp => (
                    <FortniteCard key={exp.slug} exp={exp} />
                  ))}
                </div>
              </section>
            )}

            {maps.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                No maps indexed yet. Check back soon.
              </div>
            )}
          </>
        )}

        {/* Parent guidance footer */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-5 py-4 text-sm text-blue-800 dark:text-blue-300">
          <p className="font-semibold mb-1">About Fortnite Creative ratings</p>
          <p className="text-blue-700 dark:text-blue-400 leading-relaxed">
            Each map is independently rated by our AI. Because Fortnite Creative is user-generated, map content can change.
            We recommend reviewing which maps your child plays and enabling parental controls in Epic Games account settings.
          </p>
        </div>
      </main>
    </div>
  )
}
