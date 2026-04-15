export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games, gameScores } from '@/lib/db/schema'
import { eq, desc, and, lte, ilike, isNotNull, type SQL } from 'drizzle-orm'
import ExperienceCard, { type ExperienceSummary } from '@/components/ExperienceCard'
import { curascoreText } from '@/lib/ui'
import RobloxFilters, { type RobloxFilterState } from '@/components/RobloxFilters'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Roblox Experience Guide — PlaySmart',
  description: 'PlaySmart ratings for popular Roblox experiences. Find out which games are safe for your child, with scores for stranger risk, monetization pressure, and more.',
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function RobloxHubPage({ searchParams }: Props) {
  const [sp, t] = await Promise.all([searchParams, getTranslations('roblox')])
  const filters: RobloxFilterState = {
    q:    typeof sp.q    === 'string' ? sp.q    : '',
    sort: typeof sp.sort === 'string' ? sp.sort : 'active',
    risk: typeof sp.risk === 'string' ? sp.risk : '',
    time: typeof sp.time === 'string' ? sp.time : '',
  }
  const hasFilters = !!(filters.q || filters.risk || filters.time || (filters.sort && filters.sort !== 'active'))

  // Fetch Roblox platform game row + its curascore
  const [roblox] = await db
    .select({ id: games.id, title: games.title, backgroundImage: games.backgroundImage, description: games.description })
    .from(games)
    .where(eq(games.slug, 'roblox'))
    .limit(1)

  const [platformScore] = roblox
    ? await db
        .select({ curascore: gameScores.curascore, timeRecommendationLabel: gameScores.timeRecommendationLabel })
        .from(gameScores)
        .where(eq(gameScores.gameId, roblox.id))
        .limit(1)
    : [null]

  // Build filter conditions
  const conditions: SQL[] = []
  if (filters.q)             conditions.push(ilike(platformExperiences.title, `%${filters.q}%`))
  if (filters.risk === 'low')    { conditions.push(isNotNull(experienceScores.id)); conditions.push(lte(experienceScores.riskScore, 0.33)) }
  if (filters.risk === 'medium') { conditions.push(isNotNull(experienceScores.id)); conditions.push(lte(experienceScores.riskScore, 0.66)) }
  if (filters.time === '30') { conditions.push(isNotNull(experienceScores.id)); conditions.push(lte(experienceScores.timeRecommendationMinutes, 30)) }
  if (filters.time === '60') { conditions.push(isNotNull(experienceScores.id)); conditions.push(lte(experienceScores.timeRecommendationMinutes, 60)) }

  const orderBy =
    filters.sort === 'curascore' ? desc(experienceScores.curascore) :
    filters.sort === 'visits'    ? desc(platformExperiences.visitCount) :
                                   desc(platformExperiences.activePlayers)

  const rows = await db
    .select({ exp: platformExperiences, score: experienceScores })
    .from(platformExperiences)
    .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy)

  const experiences: ExperienceSummary[] = rows.map(({ exp, score }) => ({
    slug:          exp.slug,
    title:         exp.title,
    thumbnailUrl:  exp.thumbnailUrl,
    creatorName:   exp.creatorName,
    activePlayers: exp.activePlayers,
    visitCount:    exp.visitCount,
    curascore:     score?.curascore ?? null,
    timeRecommendationMinutes: score?.timeRecommendationMinutes ?? null,
    recommendedMinAge:         score?.recommendedMinAge ?? null,
    strangerRisk:              score?.strangerRisk ?? null,
    monetizationScore:         score?.monetizationScore ?? null,
  }))

  const scored   = experiences.filter(e => e.curascore != null)
  const unscored = experiences.filter(e => e.curascore == null)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Platform header */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
          {roblox?.backgroundImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={roblox.backgroundImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-20 dark:opacity-10"
            />
          )}
          <div className="relative px-6 py-5 flex items-start gap-5">
            {/* Roblox logo placeholder */}
            <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 flex items-center justify-center shrink-0">
              <span className="text-2xl font-black text-red-500 select-none">R</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Roblox</h1>
                <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">Platform</span>
                {platformScore?.curascore != null && (
                  <span className={`text-sm font-black ${curascoreText(platformScore.curascore)}`}>
                    Curascore {platformScore.curascore}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                Roblox is a platform of millions of user-generated experiences. Safety varies greatly by experience — browse our ratings below.
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
          <RobloxFilters active={filters} total={experiences.length} />
        </Suspense>

        {/* Results */}
        {hasFilters ? (
          /* When filtering: single flat grid */
          experiences.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {experiences.map(exp => (
                <ExperienceCard key={exp.slug} exp={exp} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">
              No experiences match your filters.
            </div>
          )
        ) : (
          <>
            {/* Rated experiences grid */}
            {scored.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                  {t('rated')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {scored.map(exp => (
                    <ExperienceCard key={exp.slug} exp={exp} />
                  ))}
                </div>
              </section>
            )}

            {/* Unscored experiences (awaiting AI review) */}
            {unscored.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                  {t('awaitingRating')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {unscored.map(exp => (
                    <ExperienceCard key={exp.slug} exp={exp} />
                  ))}
                </div>
              </section>
            )}

            {experiences.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                No experiences indexed yet. Check back soon.
              </div>
            )}
          </>
        )}

        {/* Parent guidance footer */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-5 py-4 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-1">About Roblox ratings</p>
          <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
            Each experience is independently rated by our AI. Because Roblox is user-generated, content can change.
            We recommend enabling parental controls in Roblox account settings and reviewing with your child which experiences they play.
          </p>
        </div>
      </main>
    </div>
  )
}
