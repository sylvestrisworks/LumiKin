export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { userGames, games, gameScores, childProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import GameCompactCard from '@/components/GameCompactCard'
import ImportLibraryButton from '@/components/ImportLibraryButton'
import type { GameSummary } from '@/types/game'
import { getLocale, getTranslations } from 'next-intl/server'
import { calcAge } from '@/lib/age'

export const metadata = { title: 'My Library — LumiKin' }

// ─── ESRB → minimum age fallback ─────────────────────────────────────────────

function esrbToMinAge(rating: string | null | undefined): number | null {
  switch (rating) {
    case 'E':   return 0
    case 'E10': return 10
    case 'T':   return 13
    case 'M':   return 17
    case 'AO':  return 18
    default:    return null
  }
}

// ─── Skill → score column mapping ────────────────────────────────────────────

type ScoreKey = 'cognitiveScore' | 'socialEmotionalScore' | 'motorScore'

const SKILL_SCORE: Record<string, ScoreKey> = {
  cognitive:       'cognitiveScore',
  problem_solving: 'cognitiveScore',
  creativity:      'cognitiveScore',
  social:          'socialEmotionalScore',
  teamwork:        'socialEmotionalScore',
  motor:           'motorScore',
}

const SKILL_SCORE_THRESHOLD = 0.3

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; sort?: string }>
}) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uid = (session?.user as any)?.id ?? session?.user?.email ?? null
  if (!uid) redirect('/')

  const [locale, t, params] = await Promise.all([
    getLocale(),
    getTranslations('library'),
    searchParams,
  ])

  const selectedChildId = params.child ? parseInt(params.child) : null
  const sortKey: SortKey = VALID_SORTS.includes(params.sort as SortKey)
    ? (params.sort as SortKey)
    : 'curascore'

  const [rows, profiles] = await Promise.all([
    db
      .select({
        entryId:                   userGames.id,
        listType:                  userGames.listType,
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

  const allOwned    = rows.filter(r => r.listType === 'owned')
  const allWishlist = rows.filter(r => r.listType === 'wishlist')

  const selectedChild = profiles.find(p => p.id === selectedChildId) ?? null

  // ── Child filter ───────────────────────────────────────────────────────────

  function isAppropriate(row: typeof rows[0], child: typeof profiles[0]): boolean {
    const age    = calcAge(child.birthDate, child.birthYear)
    const minAge = row.recommendedMinAge ?? esrbToMinAge(row.esrbRating)
    const ageOk  = minAge == null || minAge <= age

    const childPlats = (child.platforms as string[]) ?? []
    const gamePlats  = (row.platforms  as string[]) ?? []
    const platOk = childPlats.length === 0
      || gamePlats.some(gp => childPlats.some(cp => gp.toLowerCase().includes(cp.toLowerCase())))

    const childSkills = (child.focusSkills as string[]) ?? []
    // Unscored games always pass the skill filter — we can't evaluate them yet
    const isUnscored = row.cognitiveScore == null && row.socialEmotionalScore == null && row.motorScore == null
    const skillOk = childSkills.length === 0 || isUnscored
      || childSkills.some(skill => {
           const col = SKILL_SCORE[skill]
           if (!col) return false
           return (row[col] as number | null ?? 0) > SKILL_SCORE_THRESHOLD
         })

    return ageOk && platOk && skillOk
  }

  const filteredOwned    = selectedChild ? allOwned.filter(r => isAppropriate(r, selectedChild))    : allOwned
  const filteredWishlist = selectedChild ? allWishlist.filter(r => isAppropriate(r, selectedChild)) : allWishlist

  const owned    = sortRows(filteredOwned,    sortKey)
  const wishlist = sortRows(filteredWishlist, sortKey)

  // ── Library stats ──────────────────────────────────────────────────────────

  const scoredOwned = owned.filter(r => r.curascore != null)
  const avgCurascore = scoredOwned.length
    ? Math.round(scoredOwned.reduce((s, r) => s + r.curascore!, 0) / scoredOwned.length)
    : null

  const skillTotals = { cognitive: 0, social: 0, motor: 0 }
  let skillCount = 0
  for (const r of scoredOwned) {
    if (r.cognitiveScore != null || r.socialEmotionalScore != null || r.motorScore != null) {
      skillTotals.cognitive += r.cognitiveScore ?? 0
      skillTotals.social    += r.socialEmotionalScore ?? 0
      skillTotals.motor     += r.motorScore ?? 0
      skillCount++
    }
  }

  const skillLabels: Record<string, string> = {
    cognitive: t('skillBrainLearning'),
    social:    t('skillSocialSkills'),
    motor:     t('skillMotorSkills'),
  }

  const topSkills = skillCount > 0
    ? Object.entries(skillTotals)
        .map(([key, total]) => ({ key, avg: total / skillCount }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3)
    : []

  // ── Skill label map for filter notice ─────────────────────────────────────

  const SKILL_DISPLAY: Record<string, string> = {
    cognitive:       t('skillBrainLearning'),
    social:          t('skillSocialSkills'),
    motor:           t('skillMotorSkills'),
    creativity:      t('skillCreativity'),
    problem_solving: t('skillProblemSolving'),
    teamwork:        t('skillTeamwork'),
  }

  // ── URL builder (preserves both sort + child params) ──────────────────────

  function libUrl(overrides: { child?: number | null; sort?: SortKey }) {
    const c = 'child' in overrides ? overrides.child : selectedChildId
    const s = overrides.sort ?? sortKey
    const parts: string[] = []
    if (c != null) parts.push(`child=${c}`)
    if (s !== 'curascore') parts.push(`sort=${s}`)
    return `/${locale}/library${parts.length ? `?${parts.join('&')}` : ''}`
  }

  // ── Row → GameSummary ──────────────────────────────────────────────────────

  function toSummary(r: typeof rows[0]): GameSummary {
    return {
      id:                        r.gameId,
      slug:                      r.slug,
      title:                     r.title,
      backgroundImage:           r.backgroundImage ?? null,
      esrbRating:                r.esrbRating ?? null,
      genres:                    (r.genres as string[]) ?? [],
      platforms:                 (r.platforms as string[]) ?? [],
      hasMicrotransactions:      r.hasMicrotransactions ?? false,
      hasLootBoxes:              r.hasLootBoxes ?? false,
      curascore:                 r.curascore ?? null,
      timeRecommendationMinutes: r.timeRecommendationMinutes ?? null,
      timeRecommendationColor:   (r.timeRecommendationColor as 'green' | 'amber' | 'red' | null) ?? null,
      bds:                       r.bds ?? null,
      ris:                       r.ris ?? null,
    }
  }

  const childSkills = selectedChild ? (selectedChild.focusSkills as string[]) ?? [] : []
  const childPlatforms = selectedChild ? (selectedChild.platforms as string[]) ?? [] : []
  const isFiltered = selectedChild != null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('title')}</h1>
            <ImportLibraryButton />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {isFiltered
              ? `${owned.length} ${t('owned').toLowerCase()} · ${wishlist.length} ${t('wishlist').toLowerCase()}`
              : `${allOwned.length} ${t('owned').toLowerCase()} · ${allWishlist.length} ${t('wishlist').toLowerCase()}`}
          </p>
        </div>

        {/* Filters row — child pills + sort pills */}
        <div className="flex flex-col gap-3">

          {/* Child filter */}
          {profiles.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium w-14 shrink-0">View for:</span>
              <a
                href={libUrl({ child: null })}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  !selectedChild
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                }`}
              >
                {t('viewAll')}
              </a>
              {profiles.map(p => {
                const age = calcAge(p.birthDate, p.birthYear)
                const isActive = selectedChild?.id === p.id
                return (
                  <a
                    key={p.id}
                    href={libUrl({ child: p.id })}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-700 dark:hover:border-indigo-500 dark:hover:text-indigo-400'
                    }`}
                  >
                    {p.name} <span className="opacity-70">({age})</span>
                  </a>
                )
              })}
            </div>
          )}

          {/* Sort pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium w-14 shrink-0">{t('sortBy')}</span>
            {(['curascore', 'time', 'added', 'alpha'] as SortKey[]).map(s => (
              <a
                key={s}
                href={libUrl({ sort: s })}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  sortKey === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-700 dark:hover:border-indigo-500 dark:hover:text-indigo-400'
                }`}
              >
                {s === 'curascore' ? t('sortCurascore') : s === 'time' ? t('sortTime') : s === 'added' ? t('sortRecent') : 'A–Z'}
              </a>
            ))}
          </div>
        </div>

        {/* Filter notice */}
        {isFiltered && (
          <div className="text-sm bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3 space-y-1">
            <p className="text-indigo-800 dark:text-indigo-200 font-medium">
              {t('filterByChild', { name: selectedChild!.name })}
              {' '}·{' '}
              <span className="font-normal text-indigo-600 dark:text-indigo-400">
                {t('showingFor', { count: owned.length, total: allOwned.length })}
              </span>
              {' '}
              <a href={libUrl({ child: null })} className="underline text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 text-xs ml-1">
                {t('clearFilter')}
              </a>
            </p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 flex flex-wrap gap-x-3 gap-y-1">
              <span>Age {calcAge(selectedChild!.birthDate, selectedChild!.birthYear)}</span>
              {childPlatforms.length > 0 && (
                <span>📱 {childPlatforms.join(', ')}</span>
              )}
              {childSkills.length > 0 && (
                <span>⭐ {childSkills.map(s => SKILL_DISPLAY[s] ?? s).join(', ')}</span>
              )}
            </p>
            {owned.length === 0 && allOwned.length > 0 && (
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">{t('noMatchFilter')}</p>
            )}
          </div>
        )}

        {/* Stats summary */}
        {owned.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('librarySummary')}
              </h2>
              {scoredOwned.length < owned.length && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {t('scoredOf', { scored: scoredOwned.length, total: owned.length })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-8">

              {avgCurascore != null && (
                <div className="text-center">
                  <div className={`text-4xl font-black ${
                    avgCurascore >= 70 ? 'text-emerald-600' :
                    avgCurascore >= 50 ? 'text-amber-500' : 'text-red-500'
                  }`}>
                    {avgCurascore}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('avgCurascore')}</div>
                </div>
              )}

              {topSkills.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('topFocusSkills')}</div>
                  <div className="flex flex-col gap-1.5">
                    {topSkills.map((s, i) => (
                      <div key={s.key} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-4">{i + 1}.</span>
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.round(s.avg * 120)}px`, minWidth: '12px' }} />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{skillLabels[s.key]}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">{Math.round(s.avg * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Owned games */}
        {owned.length > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300">
                {isFiltered
                  ? `${selectedChild!.name}'s ${t('owned').toLowerCase()} (${owned.length})`
                  : `${t('owned')} (${owned.length})`}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                  Make sure Steam &rarr; Privacy Settings &rarr; Game details is set to <strong>Public</strong>
                </span>
                <ImportLibraryButton />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {owned.map(r => <GameCompactCard key={r.entryId} game={toSummary(r)} />)}
            </div>
          </section>
        ) : (
          <div className="max-w-md mx-auto py-6 space-y-3">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">{t('emptyOwned')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('emptyOwnedSub')}</p>
              </div>

              {/* Privacy tip — visible by default, not collapsed */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  First: make your Steam library public
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  Steam app &rarr; click your avatar &rarr; <strong>View my profile</strong> &rarr; <strong>Edit Profile</strong> &rarr; <strong>Privacy Settings</strong> &rarr; set <strong>Game details</strong> to <strong>Public</strong>
                </p>
              </div>

              <ImportLibraryButton />
            </div>
            <p className="text-xs text-center text-slate-400 dark:text-slate-500">
              Or browse the catalogue and use <strong>Add to Library</strong> on any game page
            </p>
          </div>
        )}

        {/* Wishlist */}
        {allWishlist.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-4">
              {t('wishlist')} ({wishlist.length}{isFiltered && wishlist.length < allWishlist.length ? ` of ${allWishlist.length}` : ''})
            </h2>
            {wishlist.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {wishlist.map(r => <GameCompactCard key={r.entryId} game={toSummary(r)} />)}
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-4">
                {t('noMatchFilter')}
              </p>
            )}
          </section>
        )}

      </div>
    </div>
  )
}
