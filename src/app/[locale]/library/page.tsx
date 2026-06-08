export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { userGames, games, gameScores, childProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import LibraryCard from '@/components/LibraryCard'
import LibrarySearch from '@/components/LibrarySearch'
import ImportLibraryButton from '@/components/ImportLibraryButton'
import { ListingCard } from '@/components/editorial/ListingCard'
import { ScoreBar } from '@/components/editorial/ScoreTable'
import type { GameSummary } from '@/types/game'
import { getLocale, getTranslations } from 'next-intl/server'
import { calcAge } from '@/lib/age'
import { curascoreTextEditorial, esrbToAge } from '@/lib/ui'
import { localizeGenre } from '@/lib/i18n/genres'
import {
  isAppropriate, avgCurascore, topSkills, ageFit,
} from '@/lib/childMatch'
import { PLATFORM_OPTIONS } from '@/lib/childProfileOptions'
import Icon from '@/components/Icon'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'library' })
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return { title: t('metaTitle' as any) }
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortKey = 'curascore' | 'time' | 'added' | 'alpha'
const VALID_SORTS: SortKey[] = ['curascore', 'time', 'added', 'alpha']

function sortRows<T extends {
  title: string
  curascore: number | null
  timeRecommendationMinutes: number | null
  addedAt: Date | null
}>(arr: T[], sort: SortKey): T[] {
  return [...arr].sort((a, b) => {
    switch (sort) {
      case 'curascore': return (b.curascore ?? -1) - (a.curascore ?? -1)
      case 'time':      return (b.timeRecommendationMinutes ?? -1) - (a.timeRecommendationMinutes ?? -1)
      case 'added':     return (b.addedAt?.getTime() ?? 0) - (a.addedAt?.getTime() ?? 0)
      case 'alpha':     return a.title.localeCompare(b.title)
    }
  })
}

function asArr(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : []
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    child?: string; sort?: string; platform?: string; genre?: string; rating?: string; q?: string
  }>
}) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uid = (session?.user as any)?.id ?? session?.user?.email ?? null
  if (!uid) redirect('/')

  const [locale, t, tGenres, params] = await Promise.all([
    getLocale(),
    getTranslations('library'),
    getTranslations('genres'),
    searchParams,
  ])

  const selectedChildId = params.child ? parseInt(params.child) : null
  const sortKey: SortKey = VALID_SORTS.includes(params.sort as SortKey)
    ? (params.sort as SortKey)
    : 'curascore'
  const platformF = params.platform ?? null
  const genreF    = params.genre ?? null
  const ratingF   = params.rating ?? null
  const qF        = (params.q ?? '').trim()

  const [rows, profiles] = await Promise.all([
    db
      .select({
        entryId:                   userGames.id,
        listType:                  userGames.listType,
        source:                    userGames.source,
        addedAt:                   userGames.addedAt,
        gameId:                    games.id,
        slug:                      games.slug,
        title:                     games.title,
        backgroundImage:           games.backgroundImage,
        esrbRating:                games.esrbRating,
        genres:                    games.genres,
        platforms:                 games.platforms,
        hasMicrotransactions:      games.hasMicrotransactions,
        hasLootBoxes:              games.hasLootBoxes,
        curascore:                 gameScores.curascore,
        bds:                       gameScores.bds,
        ris:                       gameScores.ris,
        cognitiveScore:            gameScores.cognitiveScore,
        socialEmotionalScore:      gameScores.socialEmotionalScore,
        motorScore:                gameScores.motorScore,
        timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
        timeRecommendationColor:   gameScores.timeRecommendationColor,
        recommendedMinAge:         gameScores.recommendedMinAge,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .leftJoin(gameScores, eq(gameScores.gameId, userGames.gameId))
      .where(eq(userGames.userId, uid)),

    db.select().from(childProfiles).where(eq(childProfiles.userId, uid)),
  ])

  type Row = typeof rows[0]

  const allOwned    = rows.filter(r => r.listType === 'owned')
  const allWishlist = rows.filter(r => r.listType === 'wishlist')

  const selectedChild = profiles.find(p => p.id === selectedChildId) ?? null
  const childAge = selectedChild ? calcAge(selectedChild.birthDate, selectedChild.birthYear) : null

  // ── Filter facets derived from the user's own shelf ──────────────────────────

  const availablePlatforms = PLATFORM_OPTIONS.filter(opt =>
    rows.some(r => asArr(r.platforms).some(gp => gp.toLowerCase().includes(opt.toLowerCase()))),
  )

  const genreCounts = new Map<string, number>()
  for (const r of rows) for (const g of asArr(r.genres)) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)
  const availableGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([g]) => g)

  const RATING_ORDER = ['E', 'E10', 'E10+', 'T', 'M', 'AO']
  const availableRatings = RATING_ORDER.filter(rt => rows.some(r => r.esrbRating === rt))

  // ── Apply filters ────────────────────────────────────────────────────────────

  // `ignoreChildAge` keeps platform/skill matching but shows too-young titles so
  // the age-fit badge can flag them — used for the wishlist (future purchases).
  function applyFacets(arr: Row[], ignoreChildAge = false): Row[] {
    let out = arr
    if (selectedChild) out = out.filter(r => isAppropriate(r, selectedChild, { ignoreAge: ignoreChildAge }))
    if (platformF)     out = out.filter(r => asArr(r.platforms).some(gp => gp.toLowerCase().includes(platformF.toLowerCase())))
    if (genreF)        out = out.filter(r => asArr(r.genres).includes(genreF))
    if (ratingF)       out = out.filter(r => r.esrbRating === ratingF)
    if (qF)            out = out.filter(r => r.title.toLowerCase().includes(qF.toLowerCase()))
    return out
  }

  const owned    = sortRows(applyFacets(allOwned), sortKey)
  const wishlist = sortRows(applyFacets(allWishlist, true), sortKey)

  const anyFacet = selectedChild != null || platformF != null || genreF != null || ratingF != null || qF !== ''

  // ── Stats ────────────────────────────────────────────────────────────────────

  const scoredOwned = owned.filter(r => r.curascore != null)
  const avg = avgCurascore(owned)
  const unscoredCount = owned.length - scoredOwned.length

  const timed = owned.filter(r => r.timeRecommendationMinutes != null)
  const avgDailyMinutes = timed.length
    ? Math.round(timed.reduce((s, r) => s + r.timeRecommendationMinutes!, 0) / timed.length)
    : null

  const skillLabels: Record<string, string> = {
    cognitive: t('skillBrainLearning'),
    social:    t('skillSocialSkills'),
    motor:     t('skillMotorSkills'),
  }
  const skills = topSkills(owned)

  // ── Featured pick (top-scoring owned game) ───────────────────────────────────

  const featured = !qF && owned.length >= 4
    ? [...owned].filter(r => r.bds != null && r.ris != null && r.curascore != null)
        .sort((a, b) => (b.curascore ?? 0) - (a.curascore ?? 0))[0] ?? null
    : null

  // ── URL builder (preserves every facet) ──────────────────────────────────────

  function libUrl(overrides: {
    child?: number | null; sort?: SortKey; platform?: string | null; genre?: string | null; rating?: string | null
  }) {
    const next = {
      child:    'child'    in overrides ? overrides.child    : selectedChildId,
      sort:     overrides.sort ?? sortKey,
      platform: 'platform' in overrides ? overrides.platform : platformF,
      genre:    'genre'    in overrides ? overrides.genre    : genreF,
      rating:   'rating'   in overrides ? overrides.rating   : ratingF,
    }
    const parts: string[] = []
    if (next.child != null)        parts.push(`child=${next.child}`)
    if (next.sort !== 'curascore') parts.push(`sort=${next.sort}`)
    if (next.platform)             parts.push(`platform=${encodeURIComponent(next.platform)}`)
    if (next.genre)                parts.push(`genre=${encodeURIComponent(next.genre)}`)
    if (next.rating)               parts.push(`rating=${encodeURIComponent(next.rating)}`)
    if (qF)                        parts.push(`q=${encodeURIComponent(qF)}`)
    return `/${locale}/library${parts.length ? `?${parts.join('&')}` : ''}`
  }

  const clearAllUrl = `/${locale}/library${sortKey !== 'curascore' ? `?sort=${sortKey}` : ''}`

  // ── Row → GameSummary ──────────────────────────────────────────────────────

  function toSummary(r: Row): GameSummary {
    return {
      id:                        r.gameId,
      slug:                      r.slug,
      title:                     r.title,
      backgroundImage:           r.backgroundImage ?? null,
      esrbRating:                r.esrbRating ?? null,
      genres:                    asArr(r.genres),
      platforms:                 asArr(r.platforms),
      hasMicrotransactions:      r.hasMicrotransactions ?? false,
      hasLootBoxes:              r.hasLootBoxes ?? false,
      curascore:                 r.curascore ?? null,
      timeRecommendationMinutes: r.timeRecommendationMinutes ?? null,
      timeRecommendationColor:   (r.timeRecommendationColor as 'green' | 'amber' | 'red' | null) ?? null,
      bds:                       r.bds ?? null,
      ris:                       r.ris ?? null,
    }
  }

  // Age-fit badge is only meaningful on the wishlist, where too-young titles are
  // shown rather than filtered out. Owned games in child view are all age-appropriate.
  function cardFor(r: Row, showAgeFit = false) {
    const fit = showAgeFit && childAge != null ? ageFit(r, childAge) : null
    return <LibraryCard key={r.entryId} game={toSummary(r)} ageFit={fit} source={r.source} />
  }

  // ── Reusable filter pill ─────────────────────────────────────────────────────

  const pillBase = 'text-xs px-3 min-h-[44px] inline-flex items-center font-medium border transition-colors'
  const pillIdle = 'border-rule text-ink hover:border-ink hover:text-accent'

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Masthead */}
        <div className="border-b border-ink pb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-display-sm text-ink">{t('title')}</h1>
              <ImportLibraryButton />
            </div>
            <a
              href={`/${locale}/dashboard`}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-rule text-ink hover:border-ink hover:text-accent transition-colors text-kicker uppercase font-semibold shrink-0"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              <Icon name="family" size={14} aria-hidden="true" /> {t('toDashboard')}
            </a>
          </div>
          <p className="font-serif italic text-muted text-lg mt-2 max-w-2xl leading-snug">
            {t('standfirst')}
          </p>
          <p className="text-muted text-sm mt-2">
            {anyFacet
              ? `${owned.length} ${t('owned').toLowerCase()} · ${wishlist.length} ${t('wishlist').toLowerCase()}`
              : `${allOwned.length} ${t('owned').toLowerCase()} · ${allWishlist.length} ${t('wishlist').toLowerCase()}`}
          </p>
        </div>

        {/* Add-kids nudge — the Dashboard unlock, shown once games exist but no child profiles do */}
        {rows.length > 0 && profiles.length === 0 && (
          <a
            href={`/${locale}/dashboard`}
            className="flex items-center justify-between gap-3 border-l-2 border-accent bg-ink/[0.03] px-4 py-3 hover:bg-ink/[0.06] transition-colors"
          >
            <span className="text-sm text-ink">{t('addKidsNudge')}</span>
            <span className="text-kicker uppercase font-semibold text-accent shrink-0" style={{ fontVariantCaps: 'all-small-caps' }}>
              {t('addKidsNudgeCta')}
            </span>
          </a>
        )}

        {/* Featured pick */}
        {featured && (
          <section>
            <div className="border-t border-ink pt-4 mb-6">
              <p className="text-kicker uppercase font-semibold text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
                {t('featuredKicker')}
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-start">
              <ListingCard
                card={{
                  title:     featured.title,
                  kicker:    asArr(featured.genres)[0] ? localizeGenre(asArr(featured.genres)[0], tGenres as never) : t('featuredKicker'),
                  dek:       t('featuredDek', { minutes: featured.timeRecommendationMinutes ?? 0 }),
                  bds:       featured.bds!,
                  ris:       featured.ris!,
                  minutes:   featured.timeRecommendationMinutes ?? 0,
                  ages:      esrbToAge(featured.esrbRating),
                  photoUrl:  featured.backgroundImage,
                  photoFrom: '#e7dfd3',
                  photoTo:   '#cabfae',
                }}
                readLabel={t('readReview')}
              />
              {/* Summary panel sits beside the featured pick */}
              {owned.length > 0 && (
                <div className="border border-rule p-6 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-kicker uppercase font-semibold text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
                      {t('librarySummary')}
                    </h2>
                    {unscoredCount > 0 && (
                      <span className="text-xs text-muted">{t('scoredOf', { scored: scoredOwned.length, total: owned.length })}</span>
                    )}
                  </div>
                  <SummaryBody />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Filters */}
        {rows.length > 0 && (
          <div className="flex flex-col gap-3">

            {/* Search */}
            <LibrarySearch />

            {/* Child filter */}
            {profiles.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-kicker uppercase text-muted w-14 shrink-0" style={{ fontVariantCaps: 'all-small-caps' }}>{t('viewForLabel')}</span>
                <a href={libUrl({ child: null })} className={`${pillBase} ${!selectedChild ? 'bg-ink border-ink text-paper' : pillIdle}`}>
                  {t('viewAll')}
                </a>
                {profiles.map(p => {
                  const age = calcAge(p.birthDate, p.birthYear)
                  const isActive = selectedChild?.id === p.id
                  return (
                    <a key={p.id} href={libUrl({ child: isActive ? null : p.id })} className={`${pillBase} ${isActive ? 'bg-accent border-accent text-paper' : pillIdle}`}>
                      {p.name} <span className="opacity-70">&nbsp;({age})</span>
                    </a>
                  )
                })}
              </div>
            )}

            {/* Platform / genre / rating facets */}
            {availablePlatforms.length > 0 && (
              <FacetRow
                label={t('platformLabel')}
                options={availablePlatforms.map(p => ({ value: p, label: p }))}
                selected={platformF}
                href={(v) => libUrl({ platform: v })}
              />
            )}
            {availableGenres.length > 0 && (
              <FacetRow
                label={t('genreLabel')}
                options={availableGenres.map(g => ({ value: g, label: localizeGenre(g, tGenres as never) }))}
                selected={genreF}
                href={(v) => libUrl({ genre: v })}
              />
            )}
            {availableRatings.length > 0 && (
              <FacetRow
                label={t('ratingLabel')}
                options={availableRatings.map(rt => ({ value: rt, label: esrbToAge(rt) }))}
                selected={ratingF}
                href={(v) => libUrl({ rating: v })}
              />
            )}

            {/* Sort */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-kicker uppercase text-muted w-14 shrink-0" style={{ fontVariantCaps: 'all-small-caps' }}>{t('sortBy')}</span>
              {(['curascore', 'time', 'added', 'alpha'] as SortKey[]).map(s => (
                <a key={s} href={libUrl({ sort: s })} className={`${pillBase} ${sortKey === s ? 'bg-accent border-accent text-paper' : pillIdle}`}>
                  {s === 'curascore' ? t('sortCurascore') : s === 'time' ? t('sortTime') : s === 'added' ? t('sortRecent') : 'A–Z'}
                </a>
              ))}
              {anyFacet && (
                <a href={clearAllUrl} className="text-xs underline text-accent hover:no-underline ml-1 inline-flex items-center min-h-[44px]">
                  {t('clearAll')}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Child filter notice */}
        {selectedChild && (
          <div className="text-sm border-l-2 border-accent pl-4 py-1 space-y-1">
            <p className="text-ink font-medium">
              {t('filterByChild', { name: selectedChild.name })}
              {' '}·{' '}
              <span className="font-normal text-muted">{t('showingFor', { count: owned.length, total: allOwned.length })}</span>
              {' '}
              <a href={`/${locale}/dashboard`} className="underline text-accent hover:no-underline text-xs ml-1">
                {t('manageProfile', { name: selectedChild.name })}
              </a>
            </p>
            <p className="text-xs text-muted">
              {t('age', { age: childAge ?? 0 })}
              {asArr(selectedChild.platforms).length > 0 && ` · ${asArr(selectedChild.platforms).join(', ')}`}
            </p>
          </div>
        )}

        {/* Summary panel — standalone when there is no featured pick */}
        {!featured && owned.length > 0 && (
          <div className="border border-rule p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-kicker uppercase font-semibold text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>
                {t('librarySummary')}
              </h2>
              {unscoredCount > 0 && (
                <span className="text-xs text-muted">{t('scoredOf', { scored: scoredOwned.length, total: owned.length })}</span>
              )}
            </div>
            <SummaryBody />
          </div>
        )}

        {/* Owned games */}
        {owned.length > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2 border-t border-ink pt-4">
              <h2 className="font-serif text-lg text-ink">
                {selectedChild
                  ? t('ownedByChild', { name: selectedChild.name, count: owned.length })
                  : `${t('owned')} (${owned.length})`}
              </h2>
              {unscoredCount > 0 && (
                <span className="text-xs text-muted">{t('unscoredNote', { count: unscoredCount })}</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-5 gap-y-7">
              {owned.map(r => cardFor(r))}
            </div>
          </section>
        ) : anyFacet ? (
          <div className="border border-rule p-8 text-center space-y-2">
            <p className="font-serif text-lg text-ink">{t('noMatchFilter')}</p>
            <a href={clearAllUrl} className="text-sm text-accent underline hover:no-underline">{t('clearAll')}</a>
          </div>
        ) : (
          <div className="max-w-md mx-auto py-6 space-y-3">
            <div className="border border-rule p-6 space-y-4">
              <div>
                <h3 className="font-serif text-lg text-ink">{t('emptyOwned')}</h3>
                <p className="text-sm text-muted mt-1">{t('emptyOwnedSub')}</p>
              </div>
              <div className="border-l-2 border-warm pl-3 py-1">
                <p className="text-kicker uppercase font-semibold text-warm mb-1" style={{ fontVariantCaps: 'all-small-caps' }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {t('steamPublicHeading' as any)}
                </p>
                <p className="text-xs text-ink/70 leading-relaxed">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {t.rich('steamPublicSteps' as any, { strong: (c) => <strong>{c}</strong> })}
                </p>
              </div>
              <ImportLibraryButton />
            </div>
            <p className="text-xs text-center text-muted">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {t.rich('orBrowseCatalogue' as any, { strong: (c) => <strong>{c}</strong> })}
            </p>
          </div>
        )}

        {/* Wishlist */}
        {allWishlist.length > 0 && (
          <section>
            <h2 className="font-serif text-lg text-ink mb-5 border-t border-ink pt-4">
              {t('wishlist')} {selectedChild && wishlist.length < allWishlist.length
                ? t('countOfTotal', { count: wishlist.length, total: allWishlist.length })
                : `(${wishlist.length})`}
            </h2>
            {wishlist.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-5 gap-y-7">
                {wishlist.map(r => cardFor(r, true))}
              </div>
            ) : (
              <p className="text-sm text-muted py-4">{t('noMatchFilter')}</p>
            )}
          </section>
        )}

      </div>
    </div>
  )

  // ── Local sub-components (close over computed stats) ─────────────────────────

  function SummaryBody() {
    return (
      <div className="flex flex-wrap gap-x-10 gap-y-6 items-start">
        {avg != null && (
          <div>
            <p className="text-kicker uppercase text-muted mb-1" style={{ fontVariantCaps: 'all-small-caps' }}>{t('avgCurascore')}</p>
            <p className={`font-serif tabular-nums leading-none tracking-tight text-[3.5rem] ${curascoreTextEditorial(avg)}`} style={{ fontOpticalSizing: 'auto', fontWeight: 500 }}>
              {avg}
            </p>
          </div>
        )}

        {avgDailyMinutes != null && (
          <div>
            <p className="text-kicker uppercase text-muted mb-1" style={{ fontVariantCaps: 'all-small-caps' }}>{t('avgDailyLimit')}</p>
            <p className="font-serif tabular-nums leading-none tracking-tight text-[3.5rem] text-ink" style={{ fontOpticalSizing: 'auto', fontWeight: 500 }}>
              {avgDailyMinutes}<span className="text-base text-muted font-sans ml-1">{t('minShort')}</span>
            </p>
          </div>
        )}

        {skills.length > 0 && (
          <div className="min-w-[14rem] flex-1">
            <p className="text-kicker uppercase text-muted mb-2" style={{ fontVariantCaps: 'all-small-caps' }}>{t('topFocusSkills')}</p>
            <div className="flex flex-col gap-2.5">
              {skills.map(s => (
                <div key={s.key} className="grid grid-cols-[7rem_1fr_auto] gap-x-3 items-center">
                  <span className="text-sm text-ink">{skillLabels[s.key]}</span>
                  <ScoreBar value={s.avg} tone="ink" thin />
                  <span className="text-xs text-muted tabular-nums">{Math.round(s.avg * 100)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }
}

// ─── Facet pill row ─────────────────────────────────────────────────────────────

function FacetRow({
  label, options, selected, href,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string | null
  href: (value: string | null) => string
}) {
  const base = 'text-xs px-3 min-h-[44px] inline-flex items-center font-medium border transition-colors'
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-kicker uppercase text-muted w-14 shrink-0" style={{ fontVariantCaps: 'all-small-caps' }}>{label}</span>
      {options.map(o => {
        const active = selected === o.value
        return (
          <a key={o.value} href={href(active ? null : o.value)} className={`${base} ${active ? 'bg-accent border-accent text-paper' : 'border-rule text-ink hover:border-ink hover:text-accent'}`}>
            {o.label}
          </a>
        )
      })}
    </div>
  )
}
