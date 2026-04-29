import { Info } from 'lucide-react'

export function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex items-center ml-1" tabIndex={0}>
      <span className="w-5 h-5 -m-0.5 p-0.5 rounded-full flex items-center justify-center cursor-help hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
        <Info size={13} className="text-slate-400 dark:text-slate-500" />
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-xl bg-slate-800 dark:bg-slate-700 px-3 py-2 text-xs text-white leading-snug opacity-0 group-hover/tip:opacity-100 group-focus/tip:opacity-100 transition-opacity z-50 text-center shadow-lg">
        {text}
      </span>
    </span>
  )
}
