import { Link } from '@/navigation'
import { curascoreTextEditorial, esrbToAge } from '@/lib/ui'
import type { RelatedGame } from '@/lib/related-games'

type Props = { game: RelatedGame }

export function RelatedGameCard({ game }: Props) {
  return (
    <Link
      href={`/game/${game.slug}`}
      className="group flex items-center justify-between gap-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <p className="font-serif text-[15px] text-ink leading-snug line-clamp-2 group-hover:text-accent transition-colors">
          {game.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {game.platforms.slice(0, 2).map(p => (
            <span
              key={p}
              className="text-kicker uppercase text-muted"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {p}
            </span>
          ))}
          {game.esrbRating && (
            <span
              className="text-kicker uppercase text-muted"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {esrbToAge(game.esrbRating)}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right leading-none">
        <span className={`font-serif text-[28px] font-semibold tabular-nums ${curascoreTextEditorial(game.curascore)}`}>
          {game.curascore}
        </span>
        <p className="text-[10px] text-muted mt-0.5">/100</p>
      </div>
    </Link>
  )
}
