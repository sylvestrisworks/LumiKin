import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { eq, and, lte, isNull, or, gte, desc } from 'drizzle-orm'
import { curascoreBg } from '@/lib/ui'
import { getLocale } from 'next-intl/server'

type Props = {
  birthYear: number
  platforms: string[]
}

export default async function NewForChild({ birthYear, platforms }: Props) {
  const locale = await getLocale()
  const age = new Date().getFullYear() - birthYear

  const since = new Date()
  since.setDate(since.getDate() - 14)

  const rows = await db
    .select({
      slug:           games.slug,
      title:          games.title,
      backgroundImage: games.backgroundImage,
      platforms:      games.platforms,
      curascore:      gameScores.curascore,
      calculatedAt:   gameScores.calculatedAt,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(
      and(
        gte(gameScores.calculatedAt, since),
        or(
          isNull(gameScores.recommendedMinAge),
          lte(gameScores.recommendedMinAge, age),
        ),
      )
    )
    .orderBy(desc(gameScores.calculatedAt))
    .limit(30)

  // Filter by platform if child has preferences
  const filtered = platforms.length > 0
    ? rows.filter(r =>
        (r.platforms as string[]).some(gp =>
          platforms.some(cp => gp.toLowerCase().includes(cp.toLowerCase()))
        )
      )
    : rows

  if (filtered.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">New this week</h3>
        <span className="text-[10px] bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded-full">
          {filtered.length} new
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filtered.slice(0, 10).map(g => (
          <a
            key={g.slug}
            href={`/${locale}/game/${g.slug}`}
            className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-slate-100 hover:ring-2 hover:ring-indigo-400 transition-all"
          >
            {g.backgroundImage
              ? <img src={g.backgroundImage} alt={g.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-xs font-bold text-indigo-300">
                  {g.title.slice(0, 2).toUpperCase()}
                </div>
            }
            {g.curascore != null && (
              <span className={`absolute bottom-1 right-1 text-[9px] font-black text-white px-1 py-0.5 rounded-full ${curascoreBg(g.curascore)}`}>
                {g.curascore}
              </span>
            )}
            {/* "New" dot */}
            <span className="absolute top-1 left-1 w-2 h-2 bg-indigo-500 rounded-full ring-1 ring-white" />
          </a>
        ))}
      </div>
    </div>
  )
}
