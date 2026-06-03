// Editorial line-art icon set used in heads-up rows and inline annotations.
// 1.5px stroke, no fill, currentColor — inverts cleanly under `.evening`.

export type EditorialIconName =
  | 'marketplace'
  | 'chat'
  | 'subscription'
  | 'lootBox'
  | 'timePressure'
  | 'dataCollection'

export function EditorialIcon({
  name,
  size = 18,
}: {
  name: EditorialIconName
  size?: number
}) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'marketplace':
      return (
        <svg {...props}>
          <path d="M3 9l1.5-4h15L21 9" />
          <path d="M4 9v11h16V9" />
          <path d="M10 20v-5h4v5" />
          <path d="M3 9h18" />
        </svg>
      )
    case 'chat':
      return (
        <svg {...props}>
          <path d="M3 6h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3v-3H3z" />
          <path d="M9 19v1l2-1h6a2 2 0 0 0 2-2v-4" />
        </svg>
      )
    case 'subscription':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="1" />
          <path d="M3 10h18M8 3v4M16 3v4" />
          <circle cx="12" cy="15" r="2.5" />
        </svg>
      )
    case 'lootBox':
      return (
        <svg {...props}>
          <rect x="3" y="7" width="18" height="13" rx="1" />
          <path d="M3 11h18M12 7v13" />
          <path d="M8 7c0-2 2-3.5 4-3.5S16 5 16 7" />
        </svg>
      )
    case 'timePressure':
      return (
        <svg {...props}>
          <path d="M6 3h12M6 21h12" />
          <path d="M7 3c0 5 5 6 5 9s-5 4-5 9" />
          <path d="M17 3c0 5-5 6-5 9s5 4 5 9" />
          <path d="M9 12h6" strokeDasharray="2 2" />
        </svg>
      )
    case 'dataCollection':
      return (
        <svg {...props}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="2.5" />
          <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      )
  }
}
