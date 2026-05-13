type Props = {
  def: string
  children: React.ReactNode
}

export function Term({ def, children }: Props) {
  return (
    <span className="group/term relative inline">
      <span
        tabIndex={0}
        title={def}
        className="cursor-help underline decoration-dotted decoration-slate-400 dark:decoration-slate-500 underline-offset-[3px] hover:decoration-slate-700 dark:hover:decoration-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm"
      >
        {children}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl bg-slate-900 dark:bg-slate-700 text-slate-100 text-xs leading-relaxed font-normal px-3 py-2 shadow-lg opacity-0 group-hover/term:opacity-100 group-focus-within/term:opacity-100 transition-opacity z-20"
      >
        {def}
      </span>
    </span>
  )
}
