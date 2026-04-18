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
  title: 'Roblox Experience Guide — LumiKin',
  description: 'LumiKin ratings for popular Roblox experiences. Find out which games are safe for your child, with scores for stranger risk, monetization pressure, and more.',
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
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-lg bg-slate-900">
          {roblox?.backgroundImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={roblox.backgroundImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-red-950/95 via-red-900/70 to-slate-900/30" />
          <div className="relative px-6 py-8 flex items-center gap-5">
            {/* Roblox icon */}
            <div className="w-[72px] h-[72px] rounded-2xl bg-red-600 flex items-center justify-center shrink-0 shadow-lg ring-2 ring-red-400/40">
              <span className="text-3xl font-black text-white select-none">R</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[11px] font-semibold bg-red-500/25 text-red-200 border border-red-400/30 px-2 py-0.5 rounded-full tracking-wide uppercase">Platform</span>
                {platformScore?.curascore != null && (
                  <span className={`text-[11px] font-bold bg-white/10 border border-white/20 px-2 py-0.5 rounded-full ${curascoreText(platformScore.curascore)}`}>
                    Curascore {platformScore.curascore}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white">Roblox</h1>
              <p className="text-sm text-white/75 mt-1 line-clamp-2">
                Millions of user-generated experiences — safety varies widely. Browse our ratings to find the best fits for your child.
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                  <span className="text-base font-bold text-white">{scored.length}</span>
                  <span className="text-xs text-white/50 ml-1">{t('rated').toLowerCase()}</span>
                </div>
                {platformScore?.timeRecommendationLabel && (
                  <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                    <span className="text-sm font-semibold text-white">{platformScore.timeRecommendationLabel}</span>
                    <span className="text-xs text-white/50 ml-1">recommended</span>
                  </div>
                )}
                <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                  <span className="text-xs text-white/60">Free to play</span>
                </div>
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
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:snap-none">
              {experiences.map(exp => (
                <div key={exp.slug} className="snap-start shrink-0 w-40 sm:w-auto">
                  <ExperienceCard exp={exp} />
                </div>
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
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:snap-none">
                  {scored.map(exp => (
                    <div key={exp.slug} className="snap-start shrink-0 w-40 sm:w-auto">
                      <ExperienceCard exp={exp} />
                    </div>
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
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:snap-none">
                  {unscored.map(exp => (
                    <div key={exp.slug} className="snap-start shrink-0 w-40 sm:w-auto">
                      <ExperienceCard exp={exp} />
                    </div>
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
