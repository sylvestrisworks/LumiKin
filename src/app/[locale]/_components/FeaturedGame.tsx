import Link from 'next/link'
import { eq, and, isNotNull, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { curascoreBg, esrbToAge, ageBadgeColor } from '@/lib/ui'

const SHORTLIST = [
  'minecraft',
  'stardew-valley',
  'the-legend-of-zelda-breath-of-the-wild',
  'mario-kart-8-deluxe',
  'roblox',
  'celeste',
  'animal-crossing-new-horizons',
]

function pickSlug(): string {
  const d = new Date()
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((d.getTime() - start) / 86_400_000)
  return SHORTLIST[dayOfYear % SHORTLIST.length]
}

type Row = {
  slug: string
  title: string
  developer: string | null
  genres: unknown
  esrbRating: string | null
  backgroundImage: string | null
  curascore: number | null
  timeRecommendationMinutes: number | null
  bds: number | null
  topBenefits: unknown
}

async function fetchFeatured(): Promise<Row | null> {
  const preferred = pickSlug()

  const seen = new Set<string>()
  const ranked: string[] = []
  for (const s of [preferred, ...SHORTLIST]) {
    if (!seen.has(s)) { seen.add(s); ranked.push(s) }
  }

  const ordered = sql`CASE ${games.slug}
    ${sql.join(
      ranked.map((s, i) => sql`WHEN ${s} THEN ${i}`),
      sql` `,
    )}
    ELSE 999 END`

  const rows = await db
    .select({
      slug:                      games.slug,
      title:                     games.title,
      developer:                 games.developer,
      genres:                    games.genres,
      esrbRating:                games.esrbRating,
      backgroundImage:           games.backgroundImage,
      curascore:                 gameScores.curascore,
      timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
      bds:                       gameScores.bds,
      topBenefits:               gameScores.topBenefits,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(inArray(games.slug, SHORTLIST), isNotNull(gameScores.curascore)))
    .orderBy(ordered)
    .limit(1)

  return (rows[0] as Row) ?? null
}

export default async function FeaturedGame({ locale }: { locale: string }) {
  const game = await fetchFeatured()
  if (!game) return null

  const benefits = Array.isArray(game.topBenefits)
    ? (game.topBenefits as Array<{ skill: string }>).slice(0, 3).map(b => b.skill)
    : []

  return (
    <section className="border-y border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6">
          Here&rsquo;s what a LumiKin rating looks like
        </p>

        <Link
          href={`/${locale}/game/${game.slug}`}
          className="group flex flex-col sm:flex-row gap-6 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all"
        >
          <div className="relative w-full sm:w-64 h-44 sm:h-auto shrink-0 bg-slate-100 dark:bg-slate-900">
            {game.backgroundImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={game.backgroundImage}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-2xl font-black text-slate-300 dark:text-slate-700">
                  {game.title.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            {game.curascore != null && (
              <div className={`absolute top-3 right-3 ${curascoreBg(game.curascore)} text-white text-sm font-black px-2.5 py-1 rounded-full`}>
                {game.curascore}
              </div>
            )}
            {game.esrbRating && (
              <div className={`absolute bottom-3 left-3 ${ageBadgeColor(game.esrbRating)} text-white text-xs font-black px-2 py-1 rounded-full leading-none`}>
                {esrbToAge(game.esrbRating)}
              </div>
            )}
          </div>

          <div className="flex-1 px-5 sm:pl-0 sm:pr-6 pb-5 sm:py-5 flex flex-col gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight group-hover:underline underline-offset-4">
                {game.title}
              </h3>
              {game.developer && (
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{game.developer}</p>
              )}
            </div>

            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">LumiScore</dt>
                <dd className="font-black text-lg text-slate-900 dark:text-slate-100 tabular-nums">
                  {game.curascore != null ? <>{game.curascore}<span className="text-sm font-bold text-slate-500 dark:text-slate-400">/100</span></> : '—'}
                </dd>
              </div>
              <div>
                <dt
                  className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  title="Recommended daily play time"
                >
                  Per day
                </dt>
                <dd className="font-black text-lg text-slate-900 dark:text-slate-100 tabular-nums">
                  {game.timeRecommendationMinutes != null ? <>{game.timeRecommendationMinutes}<span className="text-sm font-bold text-slate-500 dark:text-slate-400"> min</span></> : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Benefits</dt>
                <dd className="font-black text-lg text-slate-900 dark:text-slate-100 tabular-nums">
                  {game.bds != null ? <>{Math.round(game.bds * 100)}<span className="text-sm font-bold text-slate-500 dark:text-slate-400">/100</span></> : '—'}
                </dd>
              </div>
            </dl>

            {benefits.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {benefits.map(b => (
                  <span key={b} className="text-xs px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {b}
                  </span>
                ))}
              </div>
            )}

            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-auto">
              See the full rating →
            </span>
          </div>
        </Link>
      </div>
    </section>
  )
}
