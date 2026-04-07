import Link from 'next/link'
import { curascoreBg } from '@/lib/ui'
import type { GameSummary } from '@/types/game'

type Props = {
  game: GameSummary
}

export default function GameCompactCard({ game }: Props) {
  return (
    <Link
      href={`/game/${game.slug}`}
      className="group flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all"
    >
      {/* Thumbnail */}
      <div className="relative h-28 bg-indigo-50 overflow-hidden shrink-0">
        {game.backgroundImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.backgroundImage}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100">
            <span className="text-2xl font-black text-indigo-300 select-none">
              {game.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Curascore chip — top right */}
        {game.curascore != null && (
          <div className={`absolute top-1.5 right-1.5 ${curascoreBg(game.curascore)} text-white text-xs font-black px-1.5 py-0.5 rounded-full`}>
            {game.curascore}
          </div>
        )}

        {/* ESRB — bottom left */}
        {game.esrbRating && (
          <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-xs font-bold px-1.5 py-0.5 rounded">
            {game.esrbRating}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2 group-hover:text-indigo-700 transition-colors">
          {game.title}
        </p>

        <div className="flex items-center gap-1 flex-wrap">
          {game.genres[0] && (
            <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">
              {game.genres[0]}
            </span>
          )}
          {game.esrbRating && (
            <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {game.esrbRating}
            </span>
          )}
        </div>

        {/* Time recommendation */}
        {game.timeRecommendationMinutes != null && (
          <div className="mt-auto pt-1">
            <span className="text-xs text-slate-400">{game.timeRecommendationMinutes} min/day</span>
          </div>
        )}

        {/* Monetization flag */}
        {(game.hasLootBoxes || game.hasMicrotransactions) && (
          <span className="text-xs text-amber-600 mt-auto" title="Has monetization">💰 Monetization</span>
        )}
      </div>
    </Link>
  )
}
