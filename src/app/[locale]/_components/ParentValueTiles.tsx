const TILES = [
  {
    title: 'Benefits first, not warnings',
    body:
      'We’re a gaming-positive site. Every rating leads with what a game actually builds — problem solving, teamwork, creativity — before any risks.',
  },
  {
    title: 'A healthy time per session',
    body:
      'Each game gets a recommended session length, derived from how the game is built — not a generic screen-time rule.',
  },
  {
    title: 'Evidence, not vibes',
    body:
      'Scores come from a public rubric covering 60 sub-dimensions. You can read exactly why a game got the rating it did.',
  },
]

export default function ParentValueTiles() {
  return (
    <section className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-8">
          What you’ll see
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {TILES.map(({ title, body }) => (
            <div key={title} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
