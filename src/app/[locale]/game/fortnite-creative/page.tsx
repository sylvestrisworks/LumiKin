export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games, gameScores } from '@/lib/db/schema'
import { eq, desc, and, lte, ilike, isNotNull, inArray, type SQL } from 'drizzle-orm'
import FortniteCard from '@/components/FortniteCard'
import { curascoreText } from '@/lib/ui'
import FortniteFilters, { type FortniteFilterState } from '@/components/FortniteFilters'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import type { ExperienceSummary } from '@/components/ExperienceCard'

// 'fortnite' is the reviewed/scored game — BR is not a separate scored entry
const FORTNITE_MODE_SLUGS = ['fortnite', 'lego-fortnite', 'fortnite-festival', 'fortnite-rocket-racing'] as const

const MODE_META: Record<string, { initial: string; tagline: string; iconBg: string; iconText: string; hoverBorder: string }> = {
  'fortnite': {
    initial: 'BR', tagline: '100-player battle royale',
    iconBg: 'bg-orange-100 dark:bg-orange-900/40', iconText: 'text-orange-600 dark:text-orange-400',
    hoverBorder: 'hover:border-orange-400 dark:hover:border-orange-600',
  },
  'lego-fortnite': {
    initial: 'LF', tagline: 'Family survival & crafting',
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/40', iconText: 'text-yellow-700 dark:text-yellow-400',
    hoverBorder: 'hover:border-yellow-400 dark:hover:border-yellow-600',
  },
  'fortnite-festival': {
    initial: '♪', tagline: 'Rhythm game by Harmonix',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40', iconText: 'text-purple-600 dark:text-purple-400',
    hoverBorder: 'hover:border-purple-400 dark:hover:border-purple-600',
  },
  'fortnite-rocket-racing': {
    initial: 'RR', tagline: 'Arcade racing by Psyonix',
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/40', iconText: 'text-cyan-700 dark:text-cyan-400',
    hoverBorder: 'hover:border-cyan-400 dark:hover:border-cyan-600',
  },
}

export const metadata: Metadata = {
  title: 'Fortnite Creative Map Guide — LumiKin',
  description: 'LumiKin ratings for popular Fortnite Creative maps. Find safe, fun maps for your child with scores for stranger risk, monetization pressure, and more.',
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function FortniteCreativeHubPage({ searchParams }: Props) {
  const [sp, t, locale] = await Promise.all([searchParams, getTranslations('fortnite'), getLocale()])
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

  // Fetch standalone Fortnite game modes (include backgroundImage for thumbnails)
  const gameModeRows = await db
    .select({
      slug:                    games.slug,
      title:                   games.title,
      esrbRating:              games.esrbRating,
      backgroundImage:         games.backgroundImage,
      curascore:               gameScores.curascore,
      timeRecommendationLabel: gameScores.timeRecommendationLabel,
    })
    .from(games)
    .leftJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(inArray(games.slug, [...FORTNITE_MODE_SLUGS]))

  // Use Fortnite BR background as header fallback if fortnite-creative has none
  const headerBg: string | null = fortnitePlatform?.backgroundImage ?? (await db
    .select({ backgroundImage: games.backgroundImage })
    .from(games)
    .where(eq(games.slug, 'fortnite'))
    .limit(1)
    .then(r => r[0]?.backgroundImage ?? null))

  // Sort to match the canonical order
  const orderedModes = FORTNITE_MODE_SLUGS
    .map(s => gameModeRows.find(r => r.slug === s))
    .filter(Boolean) as typeof gameModeRows

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

  // Only show maps that have a thumbnail — no-image cards look broken
  const visibleMaps = maps.filter(e => e.thumbnailUrl)
  const scored   = visibleMaps.filter(e => e.curascore != null)
  const unscored = visibleMaps.filter(e => e.curascore == null)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Platform header */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-lg bg-slate-900">
          {headerBg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={headerBg}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-950/95 via-blue-900/70 to-slate-900/30" />
          <div className="relative px-6 py-8 flex items-center gap-5">
            {/* Fortnite Creative icon */}
            <div className="w-[72px] h-[72px] rounded-2xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg ring-2 ring-blue-400/40">
              <span className="text-2xl font-black text-white select-none leading-none">FN</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[11px] font-semibold bg-blue-500/25 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full tracking-wide uppercase">Platform</span>
                {platformScore?.curascore != null && (
                  <span className={`text-[11px] font-bold bg-white/10 border border-white/20 px-2 py-0.5 rounded-full ${curascoreText(platformScore.curascore)}`}>
                    Curascore {platformScore.curascore}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white">Fortnite Creative</h1>
              <p className="text-sm text-white/75 mt-1 line-clamp-2">
                Player-built maps across every genre — safety and quality vary widely. Browse our ratings to find the best fits.
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

        {/* Fortnite Game Modes */}
        {orderedModes.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              Fortnite Game Modes
            </h2>
            <div className="flex items-stretch gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 sm:snap-none">
              {orderedModes.map(mode => {
                const meta = MODE_META[mode.slug]
                if (!meta) return null
                return (
                  <div key={mode.slug} className="snap-start shrink-0 w-44 sm:w-auto h-full">
                  <Link
                    href={`/${locale}/game/${mode.slug}`}
                    className={`group flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 hover:shadow-md transition-all h-full ${meta.hoverBorder}`}
                  >
                    {/* Thumbnail */}
                    <div className="relative h-20 shrink-0 overflow-hidden">
                      {mode.backgroundImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mode.backgroundImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className={`w-full h-full ${meta.iconBg}`} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className={`absolute bottom-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center ${meta.iconBg} shadow`}>
                        <span className={`text-[11px] font-black ${meta.iconText}`}>{meta.initial}</span>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="p-3 flex flex-col flex-1">
                      <div className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">{mode.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-tight line-clamp-1">{meta.tagline}</div>
                      <div className="flex items-center gap-1.5 mt-auto pt-2 flex-wrap">
                        {mode.esrbRating && (
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-medium">
                            {mode.esrbRating}
                          </span>
                        )}
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                          Free
                        </span>
                        {mode.curascore != null && (
                          <span className={`text-[10px] font-bold ${curascoreText(mode.curascore)}`}>
                            {mode.curascore}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Search + filters */}
        <Suspense>
          <FortniteFilters active={filters} total={maps.length} />
        </Suspense>

        {/* Results */}
        {hasFilters ? (
          maps.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:snap-none">
              {maps.map(exp => (
                <div key={exp.slug} className="snap-start shrink-0 w-44 sm:w-auto">
                  <FortniteCard exp={exp} />
                </div>
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
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:snap-none">
                  {scored.map(exp => (
                    <div key={exp.slug} className="snap-start shrink-0 w-44 sm:w-auto">
                      <FortniteCard exp={exp} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {unscored.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                  {t('awaitingRating')}
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:snap-none">
                  {unscored.map(exp => (
                    <div key={exp.slug} className="snap-start shrink-0 w-44 sm:w-auto">
                      <FortniteCard exp={exp} />
                    </div>
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

      </main>
    </div>
  )
}
