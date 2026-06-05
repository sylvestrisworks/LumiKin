export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { eq, desc, asc, sql, and, lte, gte, gt, ilike, inArray, isNull, isNotNull, or, type SQL } from 'drizzle-orm'
import { curascoreTextEditorial } from '@/lib/ui'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { games, gameScores, childProfiles, platformExperiences, experienceScores } from '@/lib/db/schema'
import BrowseFilters, { ViewToggle, type ActiveFilters } from '@/components/BrowseFilters'
import GameCompactCard from '@/components/GameCompactCard'
import SearchBar from '@/components/SearchBar'
import CarouselRow from '@/components/CarouselRow'
import RobloxCarouselRow from '@/components/RobloxCarouselRow'
import FortniteCarouselRow from '@/components/FortniteCarouselRow'
import AgePicker from '@/components/AgePicker'
import PlatformPicker from '@/components/PlatformPicker'
import { type ExperienceSummary } from '@/components/ExperienceCard'
import { auth } from '@/auth'
import { calcAge } from '@/lib/age'
import type { GameSummary } from '@/types/game'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'browse' })
  return {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    title:       t('metaTitle' as any),
    description: t('metaDescription' as any),
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 48

// DB slug → friendly hub URL slug (mirrors platform/[slug]/page.tsx)
const DB_TO_URL: Record<string, string> = {
  'fortnite-creative': 'fortnite',
}

// ─── Platform keyword map ─────────────────────────────────────────────────────
const PLATFORM_KEYWORDS: Record<string, string[]> = {
  PC:          ['PC'],
  PlayStation: ['PlayStation'],
  Xbox:        ['Xbox'],
  Switch:      ['Nintendo Switch'],
  iOS:         ['iOS'],
  Android:     ['Android'],
}

const VR_KEYWORDS = [
  'Oculus', 'Quest', 'Vive', 'Rift', 'Valve Index',
  'PlayStation VR', 'PSVR', 'Mixed Reality', 'Gear VR',
]

// ─── Genre keyword map ────────────────────────────────────────────────────────
const GENRE_KEYWORDS: Record<string, string[]> = {
  Action:      ['Action'],
  Adventure:   ['Adventure'],
  Puzzle:      ['Puzzle'],
  RPG:         ['RPG', 'Role-playing'],
  Strategy:    ['Strategy'],
  Simulation:  ['Simulation'],
  Sports:      ['Sports'],
  Platformer:  ['Platformer'],
  Shooter:     ['Shooter'],
  Racing:      ['Racing'],
  Family:      ['Family'],
  Casual:      ['Casual'],
  Indie:       ['Indie'],
  Fighting:    ['Fighting'],
  Educational: ['Educational'],
  Arcade:      ['Arcade'],
  Card:        ['Card'],
}

// ─── Shelf mode: carousel data ───────────────────────────────────────────────

type CarouselRowData = {
  id: string
  title: string
  iconName: string
  browseHref: string
  games: GameSummary[]
}

const CAROUSEL_SELECT = {
  slug:            games.slug,
  title:           games.title,
  developer:       games.developer,
  genres:          games.genres,
  esrbRating:      games.esrbRating,
  backgroundImage: games.backgroundImage,
  rawgAdded:       games.rawgAdded,
  trendingScore:   games.trendingScore,
  curascore:       gameScores.curascore,
  calculatedAt:    gameScores.calculatedAt,
  timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
  timeRecommendationColor:   gameScores.timeRecommendationColor,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCarouselGame(r: any): GameSummary {
  return {
    slug:            r.slug,
    title:           r.title,
    developer:       r.developer ?? null,
    genres:          Array.isArray(r.genres) ? (r.genres as string[]) : [],
    esrbRating:      r.esrbRating ?? null,
    backgroundImage: r.backgroundImage ?? null,
    curascore:       r.curascore ?? null,
    calculatedAt:    r.calculatedAt ? new Date(r.calculatedAt).toISOString() : null,
    timeRecommendationMinutes: r.timeRecommendationMinutes ?? null,
    timeRecommendationColor:   (r.timeRecommendationColor ?? null) as 'green' | 'amber' | 'red' | null,
  }
}

// Map a child's age (years) → the most appropriate ESRB tier for shelf filtering.
function ageToEsrbTier(age: number): 'E' | 'E10' | 'T' | 'M' {
  if (age < 7)  return 'E'
  if (age < 12) return 'E10'
  if (age < 17) return 'T'
  return 'M'
}

function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, ch => '\\' + ch)
}

async function getCarouselRows(platforms: string[], age: string | undefined, locale: string): Promise<CarouselRowData[]> {
  const t = await getTranslations({ locale, namespace: 'browse' })
  const platformFilter: SQL | undefined = platforms.length > 0
    ? or(...platforms.map(p => sql`${games.platforms}::text ILIKE ${'%' + escapeIlike(p) + '%'}`))
    : undefined

  const ratings = age ? (ESRB_FOR_AGE[age] ?? ['E', 'E10+', 'T']) : null
  const ageFilter: SQL = age && ratings
    ? inArray(games.esrbRating, ratings)
    : or(isNull(games.esrbRating), inArray(games.esrbRating, ['E', 'E10+', 'T', 'M']))!

  const base = (extra?: SQL) => and(isNotNull(gameScores.curascore), platformFilter, ageFilter, extra)

  const trendingCutoff = new Date()
  trendingCutoff.setMonth(trendingCutoff.getMonth() - 18)

  const [topRated, coopPlay, highBenefit, vrGames, beginnerGames, newAndGood, popular, trending] = await Promise.all([
    db.select(CAROUSEL_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(base()).orderBy(desc(gameScores.curascore), sql`${games.rawgAdded} DESC NULLS LAST`).limit(12),
    db.select(CAROUSEL_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(base(gte(gameScores.socialEmotionalScore, 0.5))).orderBy(desc(gameScores.socialEmotionalScore)).limit(12),
    db.select(CAROUSEL_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(base(gte(gameScores.cognitiveScore, 0.6))).orderBy(desc(gameScores.bds)).limit(12),
    db.select(CAROUSEL_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(and(isNotNull(gameScores.curascore), eq(games.isVr, true), ageFilter)).orderBy(desc(gameScores.curascore)).limit(12),
    db.select(CAROUSEL_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(and(isNotNull(gameScores.curascore), platformFilter, inArray(games.esrbRating, ['E', 'E10+']), lte(gameScores.ris, 0.25), gte(gameScores.curascore, 55))).orderBy(desc(gameScores.curascore)).limit(12),
    db.select(CAROUSEL_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(base(gte(gameScores.curascore, 60))).orderBy(desc(games.releaseDate)).limit(12),
    db.select(CAROUSEL_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(and(base(), isNotNull(games.metacriticScore))).orderBy(desc(games.rawgAdded), desc(games.metacriticScore)).limit(12),
    db.select(CAROUSEL_SELECT).from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id)).where(and(base(), isNotNull(games.trendingScore), gt(games.trendingScore, 0))).orderBy(desc(games.trendingScore)).limit(12).catch(() => []),
  ])

  const b = `/${locale}/browse`
  const ap = age ? `&age=${age}` : ''
  const pp = platforms.length > 0 ? `&platforms=${platforms.join(',')}` : ''

  const rows: CarouselRowData[] = [
    /* eslint-disable @typescript-eslint/no-explicit-any */
    { id: 'trending', title: t('carouselTrending'     as any), iconName: 'trending',  browseHref: `${b}?sort=trending${ap}${pp}`,           games: trending.map(toCarouselGame)     },
    { id: 'popular',  title: t('carouselAcclaimed'    as any), iconName: 'acclaimed', browseHref: `${b}?sort=popular${ap}${pp}`,             games: popular.map(toCarouselGame)      },
    { id: 'newgood',  title: t('carouselNewWorth'     as any), iconName: 'new',       browseHref: `${b}?sort=newest${ap}${pp}`,              games: newAndGood.map(toCarouselGame)   },
    { id: 'top',      title: t('carouselTopRated'     as any), iconName: 'topscore',  browseHref: `${b}?sort=curascore${ap}${pp}`,           games: topRated.map(toCarouselGame)     },
    { id: 'coop',     title: t('carouselFamilyCoop'   as any), iconName: 'family',    browseHref: `${b}?benefits=teamwork${ap}${pp}`,        games: coopPlay.map(toCarouselGame)     },
    { id: 'brain',    title: t('carouselSmart'        as any), iconName: 'smart',     browseHref: `${b}?benefits=problem-solving${ap}${pp}`, games: highBenefit.map(toCarouselGame)  },
    { id: 'vr',       title: t('carouselVrAr'         as any), iconName: 'vr',        browseHref: `${b}?platforms=VR${ap}`,                  games: vrGames.map(toCarouselGame)      },
    { id: 'beginner', title: t('carouselBeginner'     as any), iconName: 'beginner',  browseHref: `${b}?age=E10&risk=low${pp}`,              games: beginnerGames.map(toCarouselGame)},
    /* eslint-enable @typescript-eslint/no-explicit-any */
  ]

  return rows.filter(r => r.games.length > 0)
}

// ─── Age → ESRB mapping ───────────────────────────────────────────────────────

const ESRB_FOR_AGE: Record<string, string[]> = {
  E:   ['E'],
  E10: ['E', 'E10+'],
  T:   ['E', 'E10+', 'T'],
  M:   ['E', 'E10+', 'T', 'M'],
}

const BENEFIT_SKILL_MAP: Record<string, string> = {
  'problem-solving': 'Problem Solving',
  spatial:           'Spatial Awareness',
  teamwork:          'Teamwork',
  creativity:        'Creativity',
  communication:     'Communication',
}

// ─── Data fetching ────────────────────────────────────────────────────────────

type Row = {
  slug: string
  title: string
  developer: string | null
  genres: unknown
  esrbRating: string | null
  backgroundImage: string | null
  metacriticScore: number | null
  timeRecommendationMinutes: number | null
  timeRecommendationColor: string | null
  curascore: number | null
  bds: number | null
  ris: number | null
  hasMicrotransactions: boolean | null
  hasLootBoxes: boolean | null
}

type ChildFilter = { age: number; platforms: string[] }

async function queryGames(filters: ActiveFilters, child?: ChildFilter): Promise<{ rows: Row[]; total: number }> {
  const conditions: SQL[] = []
  const page   = Math.max(1, filters.page ?? 1)
  const offset = (page - 1) * PAGE_SIZE

  // Visa bara spel som faktiskt är släppta (releaseDate <= nu, eller null)
  conditions.push(
    or(
      isNull(games.releaseDate),
      lte(games.releaseDate, new Date()),
    )!
  )

  if (filters.q) {
    conditions.push(ilike(games.title, `%${filters.q}%`))
  }

  if (filters.age) {
    const ratings = ESRB_FOR_AGE[filters.age]
    if (ratings) {
      conditions.push(inArray(games.esrbRating, ratings))
    }
  }

  for (const genre of filters.genres) {
    const keywords = GENRE_KEYWORDS[genre]
    if (keywords && keywords.length > 0) {
      if (keywords.length === 1) {
        conditions.push(sql`${games.genres}::text ILIKE ${'%' + keywords[0] + '%'}`)
      } else {
        const orClauses = keywords.map(k => sql`${games.genres}::text ILIKE ${'%' + k + '%'}`)
        conditions.push(sql`(${sql.join(orClauses, sql` OR `)})`)
      }
    }
  }

  const standardPlatforms = filters.platforms.filter(p => p !== 'VR')
  for (const platform of standardPlatforms) {
    const keywords = PLATFORM_KEYWORDS[platform]
    if (keywords && keywords.length > 0) {
      if (keywords.length === 1) {
        conditions.push(sql`${games.platforms}::text ILIKE ${'%' + keywords[0] + '%'}`)
      } else {
        const orClauses = keywords.map(k => sql`${games.platforms}::text ILIKE ${'%' + k + '%'}`)
        conditions.push(sql`(${sql.join(orClauses, sql` OR `)})`)
      }
    }
  }

  if (filters.platforms.includes('VR')) {
    const vrConditions = VR_KEYWORDS.map(k =>
      sql`${games.platforms}::text ILIKE ${'%' + k + '%'}`
    )
    conditions.push(sql`(${sql.join(vrConditions, sql` OR `)})`)
  }

  if (filters.price === 'free') {
    conditions.push(
      or(
        eq(games.basePrice, 0),
        isNull(games.basePrice),
      )!
    )
  } else if (filters.price === '20') {
    conditions.push(
      and(
        isNotNull(games.basePrice),
        lte(games.basePrice, 20),
      )!
    )
  } else if (filters.price === '40') {
    conditions.push(
      and(
        isNotNull(games.basePrice),
        lte(games.basePrice, 40),
      )!
    )
  }

  if (filters.risk === 'low') {
    conditions.push(lte(gameScores.ris, 0.30))
  } else if (filters.risk === 'medium') {
    conditions.push(lte(gameScores.ris, 0.60))
  }

  if (filters.time) {
    const maxMinutes = parseInt(filters.time)
    if (!isNaN(maxMinutes)) {
      conditions.push(lte(gameScores.timeRecommendationMinutes, maxMinutes))
    }
  }

  for (const benefit of filters.benefits) {
    const skillName = BENEFIT_SKILL_MAP[benefit]
    if (skillName) {
      conditions.push(
        sql`${gameScores.topBenefits}::jsonb @> ${JSON.stringify([{ skill: skillName }])}::jsonb`
      )
    }
  }

  for (const regulation of filters.compliance) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM compliance_status cs
        WHERE cs.game_id = ${games.id}
          AND cs.regulation = ${regulation}
          AND cs.status = 'compliant'
      )`
    )
  }

  if (filters.rep === 'good') {
    conditions.push(gte(gameScores.representationScore, 4 / 6))
  }

  if (filters.noProp === 'true') {
    conditions.push(
      or(
        isNull(gameScores.propagandaLevel),
        eq(gameScores.propagandaLevel, 0),
      )!
    )
  }

  if (filters.bechdel === 'pass') {
    conditions.push(eq(gameScores.bechdelResult, 'pass'))
  }

  if (child) {
    conditions.push(
      or(
        isNull(gameScores.recommendedMinAge),
        lte(gameScores.recommendedMinAge, child.age),
      )!
    )
    if (child.platforms.length > 0) {
      const platConditions = child.platforms.map(p =>
        sql`${games.platforms}::text ILIKE ${'%' + p + '%'}`
      )
      conditions.push(sql`(${sql.join(platConditions, sql` OR `)})`)
    }
  }

  let orderBy
  switch (filters.sort) {
    case 'benefit':    orderBy = [desc(gameScores.bds),    desc(gameScores.curascore)]; break
    case 'safest':     orderBy = [asc(gameScores.ris),     desc(gameScores.curascore)]; break
    case 'riskiest':   orderBy = [desc(gameScores.ris),    asc(gameScores.curascore)];  break
    case 'newest':     orderBy = [sql`${games.releaseDate} DESC NULLS LAST`];                                    break
    case 'alpha':      orderBy = [asc(games.title)];                                                            break
    case 'metacritic': orderBy = [sql`${games.metacriticScore} DESC NULLS LAST`];                              break
    case 'trending':   orderBy = [sql`${games.trendingScore} DESC NULLS LAST`, desc(gameScores.curascore)];    break
    case 'popular':    orderBy = [sql`${games.rawgAdded} DESC NULLS LAST`, sql`${games.metacriticScore} DESC NULLS LAST`]; break
    default:           orderBy = [desc(gameScores.curascore), sql`${games.rawgAdded} DESC NULLS LAST`, sql`${games.metacriticScore} DESC NULLS LAST`]; break
  }

  const where = conditions.length ? and(...conditions) : undefined

  const [rows, countResult] = await Promise.all([
    db
      .select({
        slug:            games.slug,
        title:           games.title,
        developer:       games.developer,
        genres:          games.genres,
        esrbRating:      games.esrbRating,
        backgroundImage: games.backgroundImage,
        metacriticScore: games.metacriticScore,
        hasMicrotransactions: games.hasMicrotransactions,
        hasLootBoxes:    games.hasLootBoxes,
        timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
        timeRecommendationColor:   gameScores.timeRecommendationColor,
        curascore:       gameScores.curascore,
        bds:             gameScores.bds,
        ris:             gameScores.ris,
      })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(where),
  ])

  return { rows: rows as Row[], total: Number(countResult[0]?.count ?? 0) }
}

// ─── Parse search params ──────────────────────────────────────────────────────

const VALID_AGE    = new Set(['E', 'E10', 'T', 'M'])
const VALID_RISK   = new Set(['low', 'medium'])
const VALID_SORT   = new Set(['curascore', 'benefit', 'safest', 'riskiest', 'newest', 'alpha', 'metacritic', 'trending', 'popular'])
const VALID_PRICE  = new Set(['free', '20', '40'])
const VALID_TIME   = new Set(['30', '60', '90'])
const VALID_VIEW   = new Set(['list', 'grid'])

const VALID_GENRES = new Set([
  'Action', 'Adventure', 'Puzzle', 'RPG', 'Strategy', 'Simulation',
  'Sports', 'Platformer', 'Shooter', 'Racing', 'Family', 'Casual',
  'Indie', 'Fighting', 'Educational', 'Arcade', 'Card',
])

const VALID_PLATFORMS  = new Set(['PC', 'PlayStation', 'Xbox', 'Switch', 'iOS', 'Android', 'VR'])
const VALID_BENEFITS   = new Set(['problem-solving', 'spatial', 'teamwork', 'creativity', 'communication'])
const VALID_COMPLIANCE = new Set(['DSA', 'GDPR-K', 'ODDS'])

function parseFilters(sp: Record<string, string | string[] | undefined>): ActiveFilters {
  const str = (key: string) => (typeof sp[key] === 'string' ? sp[key] as string : undefined)
  const arr = (key: string): string[] => {
    const v = sp[key]
    if (!v) return []
    return typeof v === 'string' ? v.split(',').filter(Boolean) : v
  }

  const rawAge   = str('age')
  const rawRisk  = str('risk')
  const rawSort  = str('sort')
  const rawPrice = str('price')
  const rawTime  = str('time')
  const rawView  = str('view')

  return {
    age:        rawAge  && VALID_AGE.has(rawAge)   ? rawAge  : undefined,
    genres:     arr('genres').filter(g => VALID_GENRES.has(g)),
    platforms:  arr('platforms').filter(p => VALID_PLATFORMS.has(p)),
    benefits:   arr('benefits').filter(b => VALID_BENEFITS.has(b)),
    compliance: arr('compliance').filter(c => VALID_COMPLIANCE.has(c)),
    risk:       rawRisk  && VALID_RISK.has(rawRisk)   ? rawRisk  : undefined,
    time:       rawTime  && VALID_TIME.has(rawTime)   ? rawTime  : undefined,
    price:      rawPrice && VALID_PRICE.has(rawPrice) ? rawPrice : undefined,
    rep:        str('rep') === 'good' ? 'good' : undefined,
    noProp:     str('noProp') === 'true' ? 'true' : undefined,
    bechdel:    str('bechdel') === 'pass' ? 'pass' : undefined,
    sort:       rawSort && VALID_SORT.has(rawSort) ? rawSort : 'curascore',
    q:          str('q')?.slice(0, 200).replace(/[<>"'%;()&+]/g, '').trim() ?? undefined,
    page:       str('page') ? Math.max(1, parseInt(str('page')!)) : 1,
    view:       rawView && VALID_VIEW.has(rawView) ? rawView as 'list' | 'grid' : 'list',
  }
}

// ─── Pagination URL builder ───────────────────────────────────────────────────

function pageUrl(filters: ActiveFilters, targetPage: number, locale = 'en', childId?: number): string {
  const params = new URLSearchParams()
  if (filters.age)               params.set('age',        filters.age)
  if (filters.genres.length)     params.set('genres',     filters.genres.join(','))
  if (filters.platforms.length)  params.set('platforms',  filters.platforms.join(','))
  if (filters.benefits.length)   params.set('benefits',   filters.benefits.join(','))
  if (filters.compliance.length) params.set('compliance', filters.compliance.join(','))
  if (filters.risk)              params.set('risk',       filters.risk)
  if (filters.time)              params.set('time',       filters.time)
  if (filters.price)             params.set('price',      filters.price)
  if (filters.rep)               params.set('rep',        filters.rep)
  if (filters.noProp)            params.set('noProp',     filters.noProp)
  if (filters.bechdel)           params.set('bechdel',    filters.bechdel)
  if (filters.sort && filters.sort !== 'curascore') params.set('sort', filters.sort)
  if (filters.q)                 params.set('q',          filters.q)
  if (filters.view && filters.view !== 'list') params.set('view', filters.view)
  if (childId)                   params.set('child',      String(childId))
  if (targetPage > 1)            params.set('page',       String(targetPage))
  return `/${locale}/browse?${params.toString()}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BrowsePage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const t  = await getTranslations({ locale, namespace: 'browse' })
  const tg = await getTranslations({ locale, namespace: 'gameCompact' })
  const filters = parseFilters(sp)

  const childIdParam = typeof sp.child === 'string' ? parseInt(sp.child) : null
  let profiles: { id: number; name: string; birthYear: number; birthDate: string | null; platforms: unknown }[] = []
  let selectedChild: { id: number; name: string; age: number; platforms: string[] } | null = null

  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uid = (session?.user as any)?.id ?? session?.user?.email ?? null
  if (uid) {
    profiles = await db.select({
      id:        childProfiles.id,
      name:      childProfiles.name,
      birthYear: childProfiles.birthYear,
      birthDate: childProfiles.birthDate,
      platforms: childProfiles.platforms,
    })
      .from(childProfiles)
      .where(eq(childProfiles.userId, uid))

    if (childIdParam) {
      const found = profiles.find(p => p.id === childIdParam)
      if (found) {
        selectedChild = {
          id:        found.id,
          name:      found.name,
          age:       calcAge(found.birthDate, found.birthYear),
          platforms: (found.platforms as string[]) ?? [],
        }
      }
    }
  }

  const childFilter = selectedChild
    ? { age: selectedChild.age, platforms: selectedChild.platforms }
    : undefined

  // Shelf mode: no search query, no sorting/filtering beyond age+platforms
  const isShelfMode = !filters.q &&
    filters.genres.length === 0 &&
    filters.benefits.length === 0 &&
    filters.compliance.length === 0 &&
    !filters.risk && !filters.time && !filters.price &&
    !filters.rep && !filters.noProp && !filters.bechdel &&
    filters.sort === 'curascore'

  // UGC platform chips — always needed
  const ugcPlatformsPromise = db
    .selectDistinct({ slug: games.slug, title: games.title })
    .from(games)
    .innerJoin(platformExperiences, eq(platformExperiences.platformId, games.id))
    .where(eq(games.contentType, 'platform'))

  // Shelf mode: fetch carousels + Roblox/Fortnite
  let carousels: CarouselRowData[] = []
  let robloxExperiences: ExperienceSummary[] = []
  let fortniteExperiences: ExperienceSummary[] = []
  let rows: Row[] = []
  let total = 0

  const ugcPlatforms = await ugcPlatformsPromise

  // Effective shelf-mode filters — URL filters win; otherwise fall back to selected child's profile
  const shelfAge: string | undefined =
    filters.age ?? (selectedChild ? ageToEsrbTier(selectedChild.age) : undefined)
  const shelfPlatforms: string[] =
    filters.platforms.length > 0
      ? filters.platforms
      : (selectedChild?.platforms ?? [])

  if (isShelfMode) {
    const [robloxRow, fortniteRow] = await Promise.all([
      db.select({ id: games.id }).from(games).where(eq(games.slug, 'roblox')).limit(1).then(r => r[0] ?? null),
      db.select({ id: games.id }).from(games).where(eq(games.slug, 'fortnite-creative')).limit(1).then(r => r[0] ?? null),
    ])

    const expSelect = {
      slug:          platformExperiences.slug,
      title:         platformExperiences.title,
      thumbnailUrl:  platformExperiences.thumbnailUrl,
      creatorName:   platformExperiences.creatorName,
      activePlayers: platformExperiences.activePlayers,
      visitCount:    platformExperiences.visitCount,
      curascore:     experienceScores.curascore,
      timeRecommendationMinutes: experienceScores.timeRecommendationMinutes,
      recommendedMinAge:         experienceScores.recommendedMinAge,
      strangerRisk:              experienceScores.strangerRisk,
      monetizationScore:         experienceScores.monetizationScore,
      inputConfidence:           experienceScores.inputConfidence,
    }

    ;[carousels, robloxExperiences, fortniteExperiences] = await Promise.all([
      getCarouselRows(shelfPlatforms, shelfAge, locale),
      robloxRow
        ? db.select(expSelect).from(platformExperiences)
            .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
            .where(and(eq(platformExperiences.platformId, robloxRow.id), eq(platformExperiences.isPublic, true)))
            .orderBy(desc(platformExperiences.activePlayers))
            .limit(8)
        : Promise.resolve([]),
      fortniteRow
        ? db.select(expSelect).from(platformExperiences)
            .leftJoin(experienceScores, eq(experienceScores.experienceId, platformExperiences.id))
            .where(and(eq(platformExperiences.platformId, fortniteRow.id), isNotNull(platformExperiences.thumbnailUrl), eq(platformExperiences.isPublic, true)))
            .orderBy(desc(experienceScores.curascore))
            .limit(8)
        : Promise.resolve([]),
    ])
  } else {
    const result = await queryGames(filters, childFilter)
    rows  = result.rows
    total = result.total
  }

  const totalPages  = Math.ceil(total / PAGE_SIZE)
  const currentPage = filters.page ?? 1

  const activeFilterCount = [
    filters.age,
    ...filters.genres,
    ...filters.platforms,
    ...filters.benefits,
    ...filters.compliance,
    filters.risk,
    filters.time,
    filters.price,
    filters.rep,
    filters.noProp,
    filters.bechdel,
  ].filter(Boolean).length

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* ── Search bar — always visible ────────────────────────────────── */}
        <div className="mb-4 sm:mb-6">
          <Suspense>
            <SearchBar variant="editorial" />
          </Suspense>
        </div>

        {/* ── Shelf mode ─────────────────────────────────────────────────── */}
        {isShelfMode ? (
          <div className="max-w-6xl mx-auto overflow-x-hidden">

            {/* Pickers + child affordance */}
            <div className="space-y-3 text-center mb-6">
              {!uid && (
                <Link
                  href={`/${locale}/account`}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-ink text-ink text-kicker uppercase font-semibold hover:bg-ink hover:text-paper transition-colors"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {t('tellAboutKid' as any)}
                  <span aria-hidden>→</span>
                </Link>
              )}
              {uid && profiles.length === 0 && (
                <Link
                  href={`/${locale}/account`}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-ink text-ink text-kicker uppercase font-semibold hover:bg-ink hover:text-paper transition-colors"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {t('addFirstKid' as any)}
                  <span aria-hidden>→</span>
                </Link>
              )}
              {uid && profiles.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="text-kicker uppercase text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>{t('forChild')}</span>
                  <a
                    href={`/${locale}/browse?${new URLSearchParams(
                      Object.entries(sp as Record<string, string>)
                        .filter(([k]) => k !== 'child' && k !== 'page')
                    ).toString()}`}
                    className={`text-xs px-3 min-h-[44px] inline-flex items-center font-medium border transition-colors ${
                      !selectedChild
                        ? 'bg-ink border-ink text-paper'
                        : 'border-rule text-ink hover:border-ink hover:text-accent'
                    }`}
                  >
                    {t('forEveryone')}
                  </a>
                  {profiles.map(p => {
                    const age = calcAge(p.birthDate, p.birthYear)
                    const params = new URLSearchParams(
                      Object.entries(sp as Record<string, string>)
                        .filter(([k]) => k !== 'child' && k !== 'page')
                    )
                    params.set('child', String(p.id))
                    return (
                      <a
                        key={p.id}
                        href={`/${locale}/browse?${params.toString()}`}
                        className={`text-xs px-3 min-h-[44px] inline-flex items-center font-medium border transition-colors ${
                          selectedChild?.id === p.id
                            ? 'bg-accent border-accent text-paper'
                            : 'border-rule text-ink hover:border-ink hover:text-accent'
                        }`}
                      >
                        {p.name} <span className="opacity-70">({age})</span>
                      </a>
                    )
                  })}
                </div>
              )}
              <Suspense>
                <AgePicker current={shelfAge} />
              </Suspense>
              <Suspense>
                <PlatformPicker current={shelfPlatforms} />
              </Suspense>
              <p className="text-xs text-muted flex items-center justify-center gap-x-4 gap-y-1 flex-wrap">
                <Link href={`/${locale}/age`} className="text-accent hover:underline font-medium">
                  {t('byAgeLink')}
                </Link>
                <Link href={`/${locale}/discover`} className="text-accent hover:underline font-medium">
                  {t('findPicks')}
                </Link>
              </p>
              {(filters.platforms.length > 0 || filters.age !== undefined) && (
                <a href={`/${locale}/browse`} className="inline-block text-kicker uppercase text-muted hover:text-accent transition-colors" style={{ fontVariantCaps: 'all-small-caps' }}>
                  {t('clearFiltersShort')}
                </a>
              )}
            </div>

            {/* Roblox — top of shelf, most parents arrive for this */}
            <RobloxCarouselRow experiences={robloxExperiences as ExperienceSummary[]} />

            {/* Fortnite Creative */}
            <FortniteCarouselRow experiences={fortniteExperiences as ExperienceSummary[]} />

            {/* Curated carousels */}
            {carousels.length > 0 && (
              <div className="pb-10">
                {carousels.map((row, i) => (
                  <CarouselRow
                    key={row.id}
                    index={i}
                    iconName={row.iconName}
                    title={row.title}
                    browseHref={row.browseHref}
                    games={row.games}
                    featured={i === 0}
                  />
                ))}
              </div>
            )}

          </div>
        ) : (

        <div className="lg:flex gap-6 xl:gap-8">

          {/* Filters sidebar */}
          <Suspense>
            <BrowseFilters
              active={filters}
              totalCount={total}
              childId={selectedChild?.id}
              childName={selectedChild?.name}
            />
          </Suspense>

          {/* Main content */}
          <main className="flex-1 min-w-0">

            {/* Child selector pills */}
            {profiles.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {/* FIX: "For:" översatt */}
                <span className="text-kicker uppercase text-muted" style={{ fontVariantCaps: 'all-small-caps' }}>{t('forChild')}</span>
                {/* FIX: "Everyone" översatt */}
                <a
                  href={`/${locale}/browse?${new URLSearchParams(
                    Object.entries(sp as Record<string, string>)
                      .filter(([k]) => k !== 'child' && k !== 'page')
                  ).toString()}`}
                  className={`text-xs px-3 min-h-[44px] inline-flex items-center font-medium border transition-colors ${
                    !selectedChild
                      ? 'bg-ink border-ink text-paper'
                      : 'border-rule text-ink hover:border-ink hover:text-accent'
                  }`}
                >
                  {t('forEveryone')}
                </a>
                {profiles.map(p => {
                  const age = calcAge(p.birthDate, p.birthYear)
                  const childParams = new URLSearchParams(
                    Object.entries(sp as Record<string, string>)
                      .filter(([k]) => k !== 'child' && k !== 'page')
                  )
                  childParams.set('child', String(p.id))
                  return (
                    <a
                      key={p.id}
                      href={`/${locale}/browse?${childParams.toString()}`}
                      className={`text-xs px-3 min-h-[44px] inline-flex items-center font-medium border transition-colors ${
                        selectedChild?.id === p.id
                          ? 'bg-accent border-accent text-paper'
                          : 'border-rule text-ink hover:border-ink hover:text-accent'
                      }`}
                    >
                      {p.name} <span className="opacity-70">({age})</span>
                    </a>
                  )
                })}
              </div>
            )}

            {/* Back to browse */}
            <div className="mb-3">
              <Link href={`/${locale}/browse`} className="text-kicker uppercase text-muted hover:text-accent transition-colors" style={{ fontVariantCaps: 'all-small-caps' }}>
                ← {t('backToBrowse')}
              </Link>
            </div>

            {/* Header row */}
            <div className="flex items-center justify-between mb-4 gap-3">
              <div>
                <h1 className="font-serif text-xl sm:text-2xl text-ink">
                  {t('title')}
                </h1>
                <p className="text-xs sm:text-sm text-muted mt-0.5">
                  {t('gamesCount', { count: total })}
                  {activeFilterCount > 0 && ` · ${t('filtersActive', { count: activeFilterCount })}`}
                  {totalPages > 1 && ` · ${t('pageOf', { current: currentPage, total: totalPages })}`}
                </p>
              </div>
              <ViewToggle
                view={filters.view ?? 'list'}
                listHref={pageUrl({ ...filters, view: 'list' }, 1, locale, childIdParam ?? undefined)}
                gridHref={pageUrl({ ...filters, view: 'grid' }, 1, locale, childIdParam ?? undefined)}
              />
            </div>

            {/* Browse by UGC platform */}
            {ugcPlatforms.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="text-kicker uppercase text-muted shrink-0" style={{ fontVariantCaps: 'all-small-caps' }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {t('alsoOn' as any)}
                </span>
                {ugcPlatforms.map(p => (
                  <Link
                    key={p.slug}
                    href={`/${locale}/platform/${DB_TO_URL[p.slug] ?? p.slug}`}
                    className="text-xs px-3 py-1.5 font-medium border border-rule text-ink hover:border-ink hover:text-accent transition-colors"
                  >
                    {p.title}
                  </Link>
                ))}
              </div>
            )}

            {rows.length === 0 ? (
              <div className="text-center py-16 sm:py-20 border border-rule">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-serif text-lg text-ink">{t('noGames')}</p>
                <p className="text-sm text-muted mt-1 max-w-xs mx-auto px-4">
                  {t('noGamesSub')}
                  {(filters.risk || filters.time || filters.benefits.length > 0) && (
                    <> {t('noGamesRisk')}</>
                  )}
                </p>
                <Link
                  href={`/${locale}/browse`}
                  className="mt-4 inline-block text-kicker uppercase font-semibold text-accent hover:underline"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  {t('clearAllFilters')}
                </Link>
              </div>
            ) : filters.view === 'grid' ? (
              /* ── Grid view ──────────────────────────────────────────────── */
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                {rows.map(row => (
                  <GameCompactCard
                    key={row.slug}
                    game={{
                      slug:                      row.slug,
                      title:                     row.title,
                      developer:                 row.developer,
                      genres:                    (row.genres as string[]) ?? [],
                      esrbRating:                row.esrbRating,
                      backgroundImage:           row.backgroundImage,
                      metacriticScore:           row.metacriticScore,
                      timeRecommendationMinutes: row.timeRecommendationMinutes,
                      timeRecommendationColor:   row.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
                      curascore:                 row.curascore,
                      bds:                       row.bds,
                      ris:                       row.ris,
                      hasMicrotransactions:      row.hasMicrotransactions ?? false,
                      hasLootBoxes:              row.hasLootBoxes ?? false,
                    }}
                  />
                ))}
              </div>
            ) : (
              /* ── List view ──────────────────────────────────────────────── */
              <ol className="divide-y divide-rule/60">
                {rows.map(row => {
                  const score    = row.curascore
                  return (
                    <li key={row.slug}>
                      <Link
                        href={`/${locale}/game/${row.slug}`}
                        className="flex items-center gap-3 sm:gap-4 py-2.5 sm:py-3 px-1 sm:px-2 hover:translate-x-0.5 transition-transform group"
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 overflow-hidden shrink-0 bg-rule/30">
                          {row.backgroundImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.backgroundImage}
                              alt={row.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-rule/40">
                              <span className="text-xs font-serif text-muted">
                                {row.title.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-serif text-sm text-ink truncate group-hover:text-accent transition-colors">
                            {row.title}
                          </p>
                          <p className="text-xs text-muted truncate mt-0.5">
                            {(row.genres as string[])[0] ?? row.developer ?? ''}
                            {row.esrbRating && (
                              <span className="ml-2 text-muted">
                                {row.esrbRating}
                              </span>
                            )}
                          </p>
                        </div>
                        {/* FIX: "min/day" hämtas nu från i18n */}
                        {row.timeRecommendationMinutes != null && (
                          <span className="text-xs text-muted shrink-0 hidden sm:block">
                            {row.timeRecommendationMinutes} {tg('minDay')}
                          </span>
                        )}
                        <span className={`text-center font-serif text-base font-semibold tabular-nums shrink-0 ${curascoreTextEditorial(score)}`}>
                          {score != null ? <>{score}<span className="text-[9px] text-muted ml-0.5">/100</span></> : '—'}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            )}

            {/* ── Pagination ───────────────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-6 sm:mt-8 flex-wrap">
                {currentPage > 1 && (
                  <Link
                    href={pageUrl(filters, currentPage - 1, locale, childIdParam ?? undefined)}
                    className="px-3 sm:px-4 min-h-[44px] inline-flex items-center text-kicker uppercase font-semibold text-ink border border-rule hover:border-ink hover:text-accent transition-colors"
                    style={{ fontVariantCaps: 'all-small-caps' }}
                  >
                    ← {t('prevPage')}
                  </Link>
                )}

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, idx) =>
                    p === '…' ? (
                      <span key={`ellipsis-${idx}`} className="px-1.5 sm:px-2 text-muted text-xs sm:text-sm">…</span>
                    ) : (
                      <Link
                        key={p}
                        href={pageUrl(filters, p as number, locale, childIdParam ?? undefined)}
                        className={`w-11 h-11 flex items-center justify-center text-xs sm:text-sm font-semibold border transition-colors ${
                          p === currentPage
                            ? 'bg-ink border-ink text-paper'
                            : 'border-rule text-ink hover:border-ink hover:text-accent'
                        }`}
                      >
                        {p}
                      </Link>
                    )
                  )
                }

                {currentPage < totalPages && (
                  <Link
                    href={pageUrl(filters, currentPage + 1, locale, childIdParam ?? undefined)}
                    className="px-3 sm:px-4 min-h-[44px] inline-flex items-center text-kicker uppercase font-semibold text-ink border border-rule hover:border-ink hover:text-accent transition-colors"
                    style={{ fontVariantCaps: 'all-small-caps' }}
                  >
                    {t('nextPage')} →
                  </Link>
                )}
              </div>
            )}

          </main>
        </div>

        )} {/* end filter mode */}

      </div>
    </div>
  )
}
