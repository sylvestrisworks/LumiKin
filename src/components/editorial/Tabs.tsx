'use client'

import { useState, type ReactNode } from 'react'

// Editorial tab strip — hairline rule below; active tab has a 2px ink
// top-border raised one pixel so it reads as a single continuous mark.
// Horizontal scroll on narrow viewports preserves the typographic strip.

export type EditorialTab = {
  id: string
  label: string
  count?: number
}

export function EditorialTabs({
  tabs,
  defaultTabId,
  children,
}: {
  tabs: EditorialTab[]
  defaultTabId?: string
  children: (activeTabId: string) => ReactNode
}) {
  const [active, setActive] = useState<string>(defaultTabId ?? tabs[0]?.id ?? '')

  return (
    <div>
      <div className="border-t border-ink -mx-8 md:mx-0 overflow-x-auto">
        <div className="flex gap-6 md:gap-8 -mt-px px-8 md:px-0 whitespace-nowrap">
          {tabs.map((tab) => {
            const isActive = tab.id === active
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                aria-pressed={isActive}
                className={
                  'font-sans text-kicker uppercase py-4 transition-colors ' +
                  (isActive
                    ? 'font-semibold border-t-2 border-ink -mt-px text-ink'
                    : 'text-muted hover:text-ink')
                }
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {tab.label}
                {tab.count != null && (
                  <span className="ml-2 text-muted normal-case tracking-normal">
                    ({tab.count})
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-8">{children(active)}</div>
    </div>
  )
}
