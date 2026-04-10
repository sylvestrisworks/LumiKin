import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { childProfiles, userGames, games, gameScores } from '@/lib/db/schema'
import { eq, isNotNull } from 'drizzle-orm'
import { Suspense } from 'react'
import TailoredFeed from '@/components/TailoredFeed'
import NewForChild from '@/components/NewForChild'
import ProfileManager from '@/components/ProfileManager'
import { getLocale } from 'next-intl/server'
import { curascoreBg } from '@/lib/ui'

export const metadata = { title: 'Family Dashboard — PlaySmart' }
export const dynamic = 'force-dynamic'

type LibraryGame = {
  slug: string
  title: string
  backgroundImage: string | null
  curascore: number | null
  recommendedMinAge: number | null
  platforms: string[]
  timeRecommendationColor: string | null
}

export default async function FamilyDashboard() {
  const session = await auth()
  if (!session?.user) redirect('/')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id ?? session.user.email!
  const locale = await getLocale()

  const [profiles, libraryRows, wishlistCount] = await Promise.all([
    db.select().from(childProfiles).where(eq(childProfiles.userId, userId)),

    // All owned games with scores
    db.select({
        slug:              games.slug,
        title:             games.title,
        backgroundImage:   games.backgroundImage,
        platforms:         games.platforms,
        curascore:         gameScores.curascore,
        recommendedMinAge: gameScores.recommendedMinAge,
        timeRecommendationColor: gameScores.timeRecommendationColor,
        listType:          userGames.listType,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .leftJoin(gameScores, eq(gameScores.gameId, userGames.gameId))
      .where(eq(userGames.userId, userId)),

    Promise.resolve(0), // placeholder
  ])

  const owned   = libraryRows.filter(r => r.listType === 'owned') as LibraryGame[]
  const wlCount = libraryRows.filter(r => r.listType === 'wishlist').length

  // Per-child library filtering
  function gamesForChild(birthYear: number, platforms: string[]): LibraryGame[] {
    const age = new Date().getFullYear() - birthYear
    return owned.filter(g => {
      const ageOk = g.recommendedMinAge == null || g.recommendedMinAge <= age
      const platOk = platforms.length === 0 || (g.platforms as string[]).some(gp =>
        platforms.some(cp => gp.toLowerCase().includes(cp.toLowerCase()))
      )
      return ageOk && platOk
    }).sort((a, b) => (b.curascore ?? 0) - (a.curascore ?? 0))
  }

  function libHealthScore(games: LibraryGame[]): number | null {
    const scored = games.filter(g => g.curascore != null)
    if (!scored.length) return null
    return Math.round(scored.reduce((s, g) => s + g.curascore!, 0) / scored.length)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Family Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">Signed in as {session.user.email}</p>
          </div>
          {/* Library quick stats */}
          <div className="flex items-center gap-3 text-sm">
            <a href={`/${locale}/library`} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors text-xs font-medium">
              🎮 {owned.length} owned
            </a>
            {wlCount > 0 && (
              <a href={`/${locale}/library`} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:border-amber-300 hover:text-amber-600 transition-colors text-xs font-medium">
                ★ {wlCount} wishlisted
              </a>
            )}
          </div>
        </div>

        {/* Profile manager */}
        <ProfileManager
          initialProfiles={profiles.map(p => ({
            id:          p.id,
            name:        p.name,
            birthYear:   p.birthYear,
            platforms:   (p.platforms as string[]) ?? [],
            focusSkills: (p.focusSkills as string[]) ?? [],
          }))}
        />

        {/* Child cards */}
        {profiles.map(profile => {
          const childGames  = gamesForChild(profile.birthYear, (profile.platforms as string[]) ?? [])
          const healthScore = libHealthScore(childGames)
          const age         = new Date().getFullYear() - profile.birthYear

          return (
            <section key={profile.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              {/* Child header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-base font-bold text-indigo-600 shrink-0">
                    {profile.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">{profile.name}</h2>
                    <p className="text-xs text-slate-400">
                      Age {age}
                      {(profile.platforms as string[]).length > 0 && ` · ${(profile.platforms as string[]).join(', ')}`}
                    </p>
                  </div>
                </div>

                {/* Library health score */}
                {healthScore != null ? (
                  <div className="text-right">
                    <div className={`text-3xl font-black ${
                      healthScore >= 70 ? 'text-emerald-600' :
                      healthScore >= 50 ? 'text-amber-500' : 'text-red-500'
                    }`}>{healthScore}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Library score</div>
                  </div>
                ) : owned.length > 0 ? (
                  <div className="text-right">
                    <div className="text-xs text-slate-400">No owned games<br/>match this child yet</div>
                  </div>
                ) : null}
              </div>

              <div className="px-6 py-5 space-y-6">

                {/* New this week */}
                <Suspense fallback={null}>
                  <NewForChild
                    birthYear={profile.birthYear}
                    platforms={(profile.platforms as string[]) ?? []}
                  />
                </Suspense>

                {/* From your library */}
                {childGames.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">From your library</h3>
                      <a href={`/${locale}/library`} className="text-xs text-indigo-600 hover:underline">{childGames.length} games →</a>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {childGames.slice(0, 10).map(g => (
                        <a key={g.slug} href={`/${locale}/game/${g.slug}`} className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-slate-100 hover:ring-2 hover:ring-indigo-400 transition-all">
                          {g.backgroundImage
                            ? <img src={g.backgroundImage} alt={g.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-xs font-bold text-indigo-300">{g.title.slice(0,2).toUpperCase()}</div>
                          }
                          {g.curascore != null && (
                            <span className={`absolute bottom-1 right-1 text-[9px] font-black text-white px-1 py-0.5 rounded-full ${curascoreBg(g.curascore)}`}>
                              {g.curascore}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discover */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Discover</h3>
                  <Suspense fallback={
                    <div className="flex gap-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="shrink-0 w-36 h-52 rounded-xl bg-slate-100 animate-pulse" />
                      ))}
                    </div>
                  }>
                    <TailoredFeed
                      profileId={profile.id}
                      name={profile.name}
                      birthYear={profile.birthYear}
                      platforms={(profile.platforms as string[]) ?? []}
                      focusSkills={(profile.focusSkills as string[]) ?? []}
                      layout="row"
                    />
                  </Suspense>
                </div>

              </div>
            </section>
          )
        })}

        {profiles.length === 0 && (
          <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
            <p className="text-4xl mb-3">👨‍👩‍👧</p>
            <p className="font-medium text-slate-600 text-lg">Add a child profile to get started</p>
            <p className="text-sm mt-2 max-w-sm mx-auto">
              We&apos;ll show personalised picks and score your existing library for each child in your family.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
