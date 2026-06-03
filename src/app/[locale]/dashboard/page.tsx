import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { childProfiles, userGames, games, gameScores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { curascoreTextEditorial } from '@/lib/ui'
import Icon from '@/components/Icon'
import { calcAge } from '@/lib/age'
import ProfileManager from '@/components/ProfileManager'
import PlatformConnectionsWidget from '@/components/PlatformConnectionsWidget'
import { getLocale, getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return { title: t('metaTitle' as any) }
}
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
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink pb-6">
          <div>
            <h1 className="font-serif text-display-sm text-ink">{t('title')}</h1>
            <p className="text-muted text-sm mt-1">{t('signedInAs', { email: session.user.email ?? '' })}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a href={`/${locale}/library`} className="flex items-center gap-1.5 px-3 py-1.5 border border-rule text-ink hover:border-ink hover:text-accent transition-colors text-kicker uppercase font-semibold" style={{ fontVariantCaps: 'all-small-caps' }}>
              <Icon name="pc" size={14} aria-hidden="true" /> {t('owned', { count: owned.length })}
            </a>
            {wlCount > 0 && (
              <a href={`/${locale}/library`} className="flex items-center gap-1.5 px-3 py-1.5 border border-rule text-ink hover:border-ink hover:text-warm transition-colors text-kicker uppercase font-semibold" style={{ fontVariantCaps: 'all-small-caps' }}>
                ★ {t('wishlisted', { count: wlCount })}
              </a>
            )}
            <a href={`/${locale}/notifications`} className="flex items-center gap-1.5 px-3 py-1.5 border border-rule text-ink hover:border-ink hover:text-accent transition-colors text-kicker uppercase font-semibold" style={{ fontVariantCaps: 'all-small-caps' }}>
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
            <section key={profile.id} className="border border-rule overflow-hidden">

              {/* Child header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-rule">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ink/10 flex items-center justify-center text-base font-serif text-ink shrink-0">
                    {profile.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-serif text-lg text-ink">{profile.name}</h2>
                    <p className="text-xs text-muted">
                      {t('age', { age })}
                      {(profile.platforms as string[]).length > 0 && ` · ${(profile.platforms as string[]).join(', ')}`}
                    </p>
                  </div>
                </div>

                {/* Library health score */}
                {healthScore != null ? (
                  <div className="text-right">
                    <div className={`font-serif text-3xl ${curascoreTextEditorial(healthScore)}`}>{healthScore}</div>
                    <div className="text-kicker uppercase text-muted mt-0.5" style={{ fontVariantCaps: 'all-small-caps' }}>{t('libraryScore')}</div>
                  </div>
                ) : owned.length > 0 ? (
                  <div className="text-right">
                    <div className="text-xs text-muted">{t('noGamesMatchChild')}</div>
                  </div>
                ) : null}
              </div>

              <div className="px-6 py-5">
                {/* From your library */}
                {childGames.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-kicker uppercase font-semibold text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>{t('fromYourLibrary')}</h3>
                      <a href={`/${locale}/library?child=${profile.id}`} className="text-xs text-accent hover:underline">{t('gamesCount', { count: childGames.length })}</a>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {childGames.slice(0, 12).map(g => (
                        <a key={g.slug} href={`/${locale}/game/${g.slug}`} className="relative shrink-0 w-20 h-20 overflow-hidden bg-rule/30 hover:ring-1 hover:ring-ink transition-all">
                          {g.backgroundImage
                            ? <img src={g.backgroundImage} alt={g.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-rule/40 flex items-center justify-center text-xs font-serif text-muted">{g.title.slice(0,2).toUpperCase()}</div>
                          }
                          {g.curascore != null && (
                            <span className={`absolute bottom-1 right-1 text-[10px] font-serif font-semibold bg-paper px-1 py-0.5 leading-none ${curascoreTextEditorial(g.curascore)}`}>
                              {g.curascore}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    {t('noGamesInLibrary', { name: profile.name })}{' '}
                    <a href={`/${locale}/browse?child=${profile.id}`} className="text-accent hover:underline">{t('browseForChild', { name: profile.name })}</a>
                  </p>
                )}
              </div>
            </section>
          )
        })}

        {profiles.length === 0 && (
          <div className="text-center py-20 border border-rule">
            <p className="mb-3 flex justify-center"><Icon name="family" size={48} aria-hidden="true" className="text-rule" /></p>
            <p className="font-serif text-ink text-lg">{t('addChildCta')}</p>
            <p className="text-sm mt-2 max-w-sm mx-auto text-muted">
              {t('addChildDesc')}
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
