'use client'

import { useEffect, useState } from 'react'
import type { TocEntry } from '@/lib/methodology'

type Props = {
  entries: TocEntry[]
}

export default function TableOfContents({ entries }: Props) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const headings = entries.map(e => document.getElementById(e.id)).filter(Boolean) as HTMLElement[]

    const observer = new IntersectionObserver(
      (observedEntries) => {
        const visible = observedEntries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    )

    headings.forEach(h => observer.observe(h))
    return () => observer.disconnect()
  }, [entries])

  return (
    <nav aria-label="Table of contents" className="text-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-4">
        Contents
      </p>
      <ol className="space-y-1">
        {entries.map(entry => (
          <li key={entry.id} style={{ paddingLeft: entry.level === 3 ? '0.75rem' : undefined }}>
            <a
              href={`#${entry.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(entry.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                history.pushState(null, '', `#${entry.id}`)
              }}
              className={[
                'block py-1 leading-snug transition-colors',
                activeId === entry.id
                  ? 'text-zinc-900 dark:text-zinc-100 font-medium'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
              ].join(' ')}
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
