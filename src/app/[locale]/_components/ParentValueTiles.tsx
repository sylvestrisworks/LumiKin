import { Sparkles, Clock, ClipboardCheck, type LucideIcon } from 'lucide-react'

const TILES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Sparkles,
    title: 'Benefits first, not warnings',
    body:
      'We’re a gaming-positive site. Every rating leads with what a game actually builds — problem solving, teamwork, creativity — before any risks.',
  },
  {
    icon: Clock,
    title: 'A healthy time per session',
    body:
      'Each game gets a recommended session length, derived from how the game is built — not a generic screen-time rule.',
  },
  {
    icon: ClipboardCheck,
    title: 'Evidence, not vibes',
    body:
      'Scores come from a public rubric covering 60 sub-dimensions. You can read exactly why a game got the rating it did.',
  },
]

export default function ParentValueTiles() {
  return (
    <section className="border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-8">
          What you’ll see
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {TILES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5" aria-hidden />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
