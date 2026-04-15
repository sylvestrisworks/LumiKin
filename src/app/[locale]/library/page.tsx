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

export const metadata = { title: 'My Library — PlaySmart' }

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uid = (session?.user as any)?.id ?? session?.user?.email ?? null
  if (!uid) redirect('/')

  const [locale, t] = await Promise.all([getLocale(), getTranslations('library')])
  const params = await searchParams
  const selectedChildId = params.child ? parseInt(params.child) : null

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

  // Child filter
  const selectedChild = profiles.find(p => p.id === selectedChildId) ?? null

  function isAppropriate(row: typeof rows[0], child: typeof profiles[0]): boolean {
    const age = calcAge(child.birthDate, child.birthYear)
    const ageOk = row.recommendedMinAge == null || row.recommendedMinAge <= age
    const childPlats = (child.platforms as string[]) ?? []
    const platOk = childPlats.length === 0 || (row.platforms as string[]).some(gp =>
      childPlats.some(cp => gp.toLowerCase().includes(cp.toLowerCase()))
    )
    return ageOk && platOk
  }

  const owned    = selectedChild ? allOwned.filter(r => isAppropriate(r, selectedChild))    : allOwned
  const wishlist = selectedChild ? allWishlist.filter(r => isAppropriate(r, selectedChild)) : allWishlist

  // ── Library stats ──
  const scoredOwned = owned.filter(r => r.curascore != null)
  const avgCurascore = scoredOwned.length
    ? Math.round(scoredOwned.reduce((s, r) => s + r.curascore!, 0) / scoredOwned.length)
    : null

  // Top 3 skills by average normalized score across owned games
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('title')}</h1>
              <ImportLibraryButton />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              {selectedChild
                ? `${owned.length} ${t('owned').toLowerCase()} · ${wishlist.length} ${t('wishlist').toLowerCase()}`
                : `${allOwned.length} ${t('owned').toLowerCase()} · ${allWishlist.length} ${t('wishlist').toLowerCase()}`}
            </p>
          </div>

          {/* Child filter pills */}
          {profiles.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">View for:</span>
              <a
                href={`/${locale}/library`}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  !selectedChild
                    ? 'bg-slate-800 text-white'
                    : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500'
                }`}
              >
                All
              </a>
              {profiles.map(p => {
                const age = calcAge(p.birthDate, p.birthYear)
                return (
                  <a
                    key={p.id}
                    href={`/${locale}/library?child=${p.id}`}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                      selectedChild?.id === p.id
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
        </div>

        {/* Filtered notice */}
        {selectedChild && (allOwned.length !== owned.length || allWishlist.length !== wishlist.length) && (
          <div className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
            {t('showingFor', { count: owned.length, total: allOwned.length })} {t('filterByChild', { name: selectedChild.name })} (age {calcAge(selectedChild.birthDate, selectedChild.birthYear)}
            {(selectedChild.platforms as string[]).length > 0 && `, ${(selectedChild.platforms as string[]).join('/')}`}).
            {' '}<a href={`/${locale}/library`} className="underline hover:text-indigo-900">{t('clearFilter')}</a>
          </div>
        )}

        {/* Stats summary */}
        {owned.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">{t('librarySummary')}</h2>
            <div className="flex flex-wrap gap-8">

              {/* Avg Curascore */}
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

              {/* Top skills */}
              {topSkills.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('topFocusSkills')}</div>
                  <div className="flex flex-col gap-1.5">
                    {topSkills.map((s, i) => (
                      <div key={s.key} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-4">{i + 1}.</span>
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.round(s.avg * 120)}px`, minWidth: '20px' }} />
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
            <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-4">
              {selectedChild ? selectedChild.name : t('owned')} ({owned.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {owned.map(r => <GameCompactCard key={r.entryId} game={toSummary(r)} />)}
            </div>
          </section>
        ) : (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">🎮</p>
            <p className="font-medium text-slate-600 dark:text-slate-400">{t('emptyOwned')}</p>
            <p className="text-sm mt-1">{t('emptyOwnedSub')}</p>
          </div>
        )}

        {/* Wishlist */}
        {wishlist.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-4">{t('wishlist')} ({wishlist.length})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {wishlist.map(r => <GameCompactCard key={r.entryId} game={toSummary(r)} />)}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
