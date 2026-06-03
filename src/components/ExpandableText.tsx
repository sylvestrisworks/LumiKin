'use client'

import { useState } from 'react'

export default function ExpandableText({ text, lines = 4 }: { text: string; lines?: number }) {
  const [expanded, setExpanded] = useState(false)

  // Rough heuristic: ~80 chars/line
  const threshold = lines * 80
  const needsToggle = text.length > threshold

  return (
    <div>
      <p
        className={`text-sm text-ink/80 leading-relaxed ${!expanded && needsToggle ? (
          lines === 2 ? 'line-clamp-2' :
          lines === 3 ? 'line-clamp-3' :
          lines === 5 ? 'line-clamp-5' :
          lines === 6 ? 'line-clamp-6' :
          'line-clamp-4'
        ) : ''}`}
      >
        {text}
      </p>
      {needsToggle && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-1.5 text-kicker uppercase font-semibold text-accent hover:underline transition-colors"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}
