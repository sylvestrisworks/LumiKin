export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { userGames, games, gameScores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import GameCompactCard from '@/components/GameCompactCard'
import type { GameSummary } from '@/types/game'

export const metadata = { title: 'My Library — PlaySmart' }

const SKILL_LABELS: Record<string, string> = {
  cognitive:      'Brain & Learning',
  social:         'Social Skills',
  motor:          'Motor Skills',
}

export default async function LibraryPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uid = (session?.user as any)?.id ?? session?.user?.email ?? null
  if (!uid) redirect('/')

  const rows = await db
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
    })
    .from(userGames)
    .innerJoin(games, eq(games.id, userGames.gameId))
    .leftJoin(gameScores, eq(gameScores.gameId, userGames.gameId))
    .where(eq(userGames.userId, uid))

  const owned    = rows.filter(r => r.listType === 'owned')
  const wishlist = rows.filter(r => r.listType === 'wishlist')

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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Library</h1>
          <p className="text-slate-500 text-sm mt-0.5">{owned.length} games owned · {wishlist.length} wishlisted</p>
        </div>

        {/* Stats summary */}
        {owned.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Library Summary</h2>
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
                  <div className="text-xs text-slate-500 mt-1">Avg Curascore</div>
                </div>
              )}

              {/* Top skills */}
              {topSkills.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-2">Top Focus Skills</div>
                  <div className="flex flex-col gap-1.5">
                    {topSkills.map((s, i) => (
                      <div key={s.key} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-4">{i + 1}.</span>
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.round(s.avg * 120)}px`, minWidth: '20px' }} />
                        <span className="text-sm font-medium text-slate-700">{SKILL_LABELS[s.key]}</span>
                        <span className="text-xs text-slate-400">{Math.round(s.avg * 100)}%</span>
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
            <h2 className="text-base font-semibold text-slate-700 mb-4">Owned ({owned.length})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {owned.map(r => <GameCompactCard key={r.entryId} game={toSummary(r)} />)}
            </div>
          </section>
        ) : (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">🎮</p>
            <p className="font-medium text-slate-600">Your library is empty</p>
            <p className="text-sm mt-1">Visit any game page and click &ldquo;Add to Library&rdquo;.</p>
          </div>
        )}

        {/* Wishlist */}
        {wishlist.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-slate-700 mb-4">Wishlist ({wishlist.length})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {wishlist.map(r => <GameCompactCard key={r.entryId} game={toSummary(r)} />)}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
