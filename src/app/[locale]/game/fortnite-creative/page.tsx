export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { platformExperiences, experienceScores, games, gameScores } from '@/lib/db/schema'
import { eq, desc, and, lte, ilike, isNotNull, inArray, type SQL } from 'drizzle-orm'
import FortniteCard from '@/components/FortniteCard'
import Icon from '@/components/Icon'
import { curascoreTextEditorial } from '@/lib/ui'
import FortniteFilters, { type FortniteFilterState } from '@/components/FortniteFilters'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import type { ExperienceSummary } from '@/components/ExperienceCard'

// 'fortnite' is the reviewed/scored game — BR is not a separate scored entry
const FORTNITE_MODE_SLUGS = ['fortnite', 'lego-fortnite', 'fortnite-festival', 'fortnite-rocket-racing'] as const

const MODE_META: Record<string, { initial: string; taglineKey: string }> = {
  'fortnite':                { initial: 'BR', taglineKey: 'modeBrTagline' },
  'lego-fortnite':           { initial: 'LF', taglineKey: 'modeLegoTagline' },
  'fortnite-festival':       { initial: '♪',  taglineKey: 'modeFestivalTagline' },
  'fortnite-rocket-racing':  { initial: 'RR', taglineKey: 'modeRocketRacingTagline' },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'fortnite' })
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
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
  conditions.push(eq(platformExperiences.isPublic, true))
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
    activePlayers: exp.activePlayers,
    visitCount:    null,
    curascore:     score?.curascore ?? null,
    timeRecommendationMinutes: score?.timeRecommendationMinutes ?? null,
    recommendedMinAge:         score?.recommendedMinAge ?? null,
    strangerRisk:              score?.strangerRisk ?? null,
    monetizationScore:         score?.monetizationScore ?? null,
    inputConfidence:           score?.inputConfidence ?? null,
  }))

  const scored   = maps.filter(e => e.curascore != null)
  const unscored = maps.filter(e => e.curascore == null)

  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Platform header — editorial nameplate */}
        <div className="border-2 border-ink bg-paper px-6 py-7 flex items-center gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 border-2 border-ink flex items-center justify-center shrink-0 text-ink">
            <Icon name="fortnite" size={48} className="text-ink" label={t('title')} />
          </div>

          <div className="flex-1 min-w-0">
            <span className="block text-kicker uppercase font-semibold text-muted mb-1" style={{ fontVariantCaps: 'all-small-caps' }}>
              {t('platformBadge')}
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif text-ink tracking-tight">{t('title')}</h1>
            <p className="text-sm text-muted mt-1 line-clamp-2">
              {t('platformTagline')}
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
                  {platformScore.timeRecommendationLabel}
                </span>
              )}
              <span className="text-kicker uppercase font-semibold text-muted border border-rule px-2 py-1" style={{ fontVariantCaps: 'all-small-caps' }}>
                {t('freeToPlay')}
              </span>
            </div>
          </div>
        </div>

        {/* Fortnite Game Modes */}
        {orderedModes.length > 0 && (
          <section>
            <h2 className="text-kicker uppercase font-semibold text-muted mb-3 border-t border-ink pt-4" style={{ fontVariantCaps: 'all-small-caps' }}>
              {t('gameModesHeader')}
            </h2>
            <div className="flex items-stretch gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 sm:snap-none">
              {orderedModes.map(mode => {
                const meta = MODE_META[mode.slug]
                if (!meta) return null
                return (
                  <div key={mode.slug} className="snap-start shrink-0 w-44 sm:w-auto h-full">
                  <Link
                    href={`/${locale}/game/${mode.slug}`}
                    className="group flex flex-col border border-rule overflow-hidden hover:border-ink transition-colors h-full"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-20 shrink-0 overflow-hidden bg-rule/30">
                      {mode.backgroundImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mode.backgroundImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-lg font-serif text-muted select-none">{meta.initial}</span>
                        </div>
                      )}
                      <div className="absolute bottom-1.5 left-1.5 bg-paper text-ink text-[11px] font-black px-1.5 py-0.5 leading-none">
                        {meta.initial}
                      </div>
                    </div>
                    {/* Content */}
                    <div className="p-3 flex flex-col flex-1">
                      <div className="font-serif text-sm text-ink leading-tight group-hover:text-accent transition-colors">{mode.title}</div>
                      <div className="text-xs text-muted mt-0.5 leading-tight line-clamp-1">{t(meta.taglineKey)}</div>
                      <div className="flex items-center gap-2 mt-auto pt-2 flex-wrap">
                        {mode.esrbRating && (
                          <span className="text-kicker uppercase text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
                            {mode.esrbRating}
                          </span>
                        )}
                        <span className="text-kicker uppercase text-ivy" style={{ fontVariantCaps: 'all-small-caps' }}>
                          {t('freeBadge')}
                        </span>
                        {mode.curascore != null && (
                          <span className={`font-serif text-sm font-semibold ${curascoreTextEditorial(mode.curascore)}`}>
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
            <div className="text-center py-16 text-muted">
              {t('noMapsFiltered')}
            </div>
          )
        ) : (
          <>
            {scored.length > 0 && (
              <section>
                <h2 className="text-kicker uppercase font-semibold text-muted mb-3 border-t border-ink pt-4" style={{ fontVariantCaps: 'all-small-caps' }}>
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
                <h2 className="text-kicker uppercase font-semibold text-muted mb-3 border-t border-ink pt-4" style={{ fontVariantCaps: 'all-small-caps' }}>
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
              <div className="text-center py-16 text-muted">
                {t('noMapsYet')}
              </div>
            )}
          </>
        )}

      </main>
    </div>
  )
}
