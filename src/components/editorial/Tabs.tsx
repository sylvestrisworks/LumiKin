'use client'

import { useState, type ReactNode } from 'react'

// Editorial tab strip — hairline rule below; active tab has a 2px ink
// top-border raised one pixel so it reads as a single continuous mark.
// Horizontal scroll on narrow viewports preserves the typographic strip.
//
// Behaves as a toggle group: pass `defaultActiveId={null}` (or omit) for the
// strip to start with nothing selected. Clicking a tab opens its panel;
// clicking the active tab again closes it back to the empty state. The
// render-prop receives `string | null` so consumers can render nothing for
// the collapsed state.

export type EditorialTab = {
  id: string
  label: string
  count?: number
}

export function EditorialTabs({
  tabs,
  defaultActiveId = null,
  children,
}: {
  tabs: EditorialTab[]
  defaultActiveId?: string | null
  children: (activeTabId: string | null) => ReactNode
}) {
  const [active, setActive] = useState<string | null>(defaultActiveId)

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
                onClick={() => setActive((prev) => (prev === tab.id ? null : tab.id))}
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
      {active != null && <div className="mt-8">{children(active)}</div>}
    </div>
  )
}
