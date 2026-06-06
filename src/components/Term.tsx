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
        className="cursor-help underline decoration-dotted decoration-rule underline-offset-[3px] hover:decoration-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
      >
        {children}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 max-w-[calc(100vw-2rem)] border border-ink bg-ink text-paper text-xs leading-relaxed font-normal px-3 py-2 opacity-0 group-hover/term:opacity-100 group-focus-within/term:opacity-100 transition-opacity z-20"
      >
        {def}
      </span>
    </span>
  )
}
