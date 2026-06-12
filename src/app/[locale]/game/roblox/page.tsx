export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games, gameScores } from '@/lib/db/schema'
import { eq, desc, and, lte, ilike, isNotNull, type SQL } from 'drizzle-orm'
import ExperienceCard, { type ExperienceSummary } from '@/components/ExperienceCard'
import Icon from '@/components/Icon'
import { curascoreTextEditorial } from '@/lib/ui'
import RobloxFilters, { type RobloxFilterState } from '@/components/RobloxFilters'
import { getTranslations } from 'next-intl/server'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'roblox' })
  return {
    title:       t('hubMetaTitle'),
    description: t('hubMetaDescription'),
  }
}

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
        .select({ curascore: gameScores.curascore, timeRecommendationLabel: gameScores.timeRecommendationLabel, timeRecommendationColor: gameScores.timeRecommendationColor })
        .from(gameScores)
        .where(eq(gameScores.gameId, roblox.id))
        .limit(1)
    : [null]

  // Build filter conditions — always scope to Roblox platform
  const conditions: SQL[] = []
  if (roblox) conditions.push(eq(platformExperiences.platformId, roblox.id))
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
    inputConfidence:           score?.inputConfidence ?? null,
  }))

  const scored   = experiences.filter(e => e.curascore != null)
  const unscored = experiences.filter(e => e.curascore == null)

  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Platform header — editorial nameplate */}
        <div className="border-2 border-ink bg-paper px-6 py-7 flex items-center gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 border-2 border-ink flex items-center justify-center shrink-0 text-ink">
            <Icon name="roblox" size={48} className="text-ink" label="Roblox" />
          </div>

          <div className="flex-1 min-w-0">
            <span className="block text-kicker uppercase font-semibold text-muted mb-1" style={{ fontVariantCaps: 'all-small-caps' }}>
              {t('platformBadge')}
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif text-ink tracking-tight">Roblox</h1>
            <p className="text-sm text-muted mt-1 line-clamp-2">
              {t('hubTagline')}
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-kicker uppercase font-semibold text-muted border border-rule px-2 py-1" style={{ fontVariantCaps: 'all-small-caps' }}>
                {scored.length} {t('rated')}
              </span>
              {platformScore?.curascore != null && (
                <span className={`text-kicker uppercase font-semibold border border-rule px-2 py-1 ${curascoreTextEditorial(platformScore.curascore)}`} style={{ fontVariantCaps: 'all-small-caps' }}>
                  LumiScore {platformScore.curascore}
                </span>
              )}
              {platformScore?.timeRecommendationLabel && (
                <span className="text-kicker uppercase font-semibold text-muted border border-rule px-2 py-1" style={{ fontVariantCaps: 'all-small-caps' }}>
                  {/* The label is already a complete verdict (e.g. "Not recommended
                      for children"); only the positive time tiers take the
                      "recommended" suffix, otherwise it doubles the word. */}
                  {platformScore.timeRecommendationColor === 'red'
                    ? platformScore.timeRecommendationLabel
                    : `${platformScore.timeRecommendationLabel} ${t('recommendedSuffix')}`}
                </span>
              )}
              <span className="text-kicker uppercase font-semibold text-muted border border-rule px-2 py-1" style={{ fontVariantCaps: 'all-small-caps' }}>
                {t('freeToPlay')}
              </span>
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
                <div key={exp.slug} className="snap-start shrink-0 w-44 sm:w-auto">
                  <ExperienceCard exp={exp} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted">
              {t('noFilterMatch')}
            </div>
          )
        ) : (
          <>
            {/* Rated experiences grid */}
            {scored.length > 0 && (
              <section>
                <h2 className="text-kicker uppercase font-semibold text-muted mb-3 border-t border-ink pt-4" style={{ fontVariantCaps: 'all-small-caps' }}>
                  {t('rated')}
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:snap-none">
                  {scored.map(exp => (
                    <div key={exp.slug} className="snap-start shrink-0 w-44 sm:w-auto">
                      <ExperienceCard exp={exp} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Unscored experiences (awaiting AI review) */}
            {unscored.length > 0 && (
              <section>
                <h2 className="text-kicker uppercase font-semibold text-muted mb-3 border-t border-ink pt-4" style={{ fontVariantCaps: 'all-small-caps' }}>
                  {t('awaitingRating')}
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:snap-none">
                  {unscored.map(exp => (
                    <div key={exp.slug} className="snap-start shrink-0 w-44 sm:w-auto">
                      <ExperienceCard exp={exp} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {experiences.length === 0 && (
              <div className="text-center py-16 text-muted">
                {t('noIndexed')}
              </div>
            )}
          </>
        )}

      </main>
    </div>
  )
}
