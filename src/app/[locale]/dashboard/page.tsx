import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { childProfiles, userGames, games, gameScores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { curascoreBg } from '@/lib/ui'
import { calcAge } from '@/lib/age'
import ProfileManager from '@/components/ProfileManager'
import PlatformConnectionsWidget from '@/components/PlatformConnectionsWidget'
import { getLocale, getTranslations } from 'next-intl/server'

export const metadata = { title: 'Family Dashboard — LumiKin' }
export const dynamic = 'force-dynamic'

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

type LibraryGame = {
  slug: string
  title: string
  backgroundImage: string | null
  curascore: number | null
  recommendedMinAge: number | null
  esrbRating: string | null
  platforms: string[]
  timeRecommendationColor: string | null
}

export default async function FamilyDashboard() {
  const session = await auth()
  if (!session?.user) redirect('/')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id ?? session.user.email!
  const [locale, t] = await Promise.all([getLocale(), getTranslations('dashboard')])

  const [profiles, libraryRows] = await Promise.all([
    db.select().from(childProfiles).where(eq(childProfiles.userId, userId)),

    db.select({
        slug:              games.slug,
        title:             games.title,
        backgroundImage:   games.backgroundImage,
        esrbRating:        games.esrbRating,
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
  ])

  const owned   = libraryRows.filter(r => r.listType === 'owned') as LibraryGame[]
  const wlCount = libraryRows.filter(r => r.listType === 'wishlist').length

  function gamesForChild(age: number, platforms: string[]): LibraryGame[] {
    return owned.filter(g => {
      const minAge = g.recommendedMinAge ?? esrbToMinAge(g.esrbRating)
      const ageOk  = minAge == null || minAge <= age
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('title')}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{t('signedInAs', { email: session.user.email ?? '' })}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a href={`/${locale}/library`} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-700 transition-colors text-xs font-medium">
              🎮 {t('owned', { count: owned.length })}
            </a>
            {wlCount > 0 && (
              <a href={`/${locale}/library`} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:border-amber-300 hover:text-amber-600 transition-colors text-xs font-medium">
                ★ {t('wishlisted', { count: wlCount })}
              </a>
            )}
            <a href={`/${locale}/notifications`} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-700 transition-colors text-xs font-medium">
              🔔 {t('notifications')}
            </a>
          </div>
        </div>

        {/* Platform connections */}
        <PlatformConnectionsWidget />

        {/* Profile manager */}
        <ProfileManager
          initialProfiles={profiles.map(p => ({
            id:          p.id,
            name:        p.name,
            birthYear:   p.birthYear,
            birthDate:   p.birthDate ?? null,
            platforms:   (p.platforms as string[]) ?? [],
            focusSkills: (p.focusSkills as string[]) ?? [],
          }))}
        />

        {/* Child cards */}
        {profiles.map(profile => {
          const age         = calcAge(profile.birthDate, profile.birthYear)
          const childGames  = gamesForChild(age, (profile.platforms as string[]) ?? [])
          const healthScore = libHealthScore(childGames)

          return (
            <section key={profile.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

              {/* Child header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-base font-bold text-indigo-600 shrink-0">
                    {profile.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{profile.name}</h2>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {t('age', { age })}
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
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-0.5">{t('libraryScore')}</div>
                  </div>
                ) : owned.length > 0 ? (
                  <div className="text-right">
                    <div className="text-xs text-slate-400 dark:text-slate-500">{t('noGamesMatchChild')}</div>
                  </div>
                ) : null}
              </div>

              <div className="px-6 py-5">
                {/* From your library */}
                {childGames.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('fromYourLibrary')}</h3>
                      <a href={`/${locale}/library?child=${profile.id}`} className="text-xs text-indigo-600 hover:underline">{t('gamesCount', { count: childGames.length })}</a>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {childGames.slice(0, 12).map(g => (
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
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    {t('noGamesInLibrary', { name: profile.name })}{' '}
                    <a href={`/${locale}/browse?child=${profile.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">{t('browseForChild', { name: profile.name })}</a>
                  </p>
                )}
              </div>
            </section>
          )
        })}

        {profiles.length === 0 && (
          <div className="text-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <p className="text-4xl mb-3">👨‍👩‍👧</p>
            <p className="font-medium text-slate-600 dark:text-slate-400 text-lg">{t('addChildCta')}</p>
            <p className="text-sm mt-2 max-w-sm mx-auto text-slate-400 dark:text-slate-500">
              {t('addChildDesc')}
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
