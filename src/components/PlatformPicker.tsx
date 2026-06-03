'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Icon, { type IconName } from '@/components/Icon'

const PLATFORMS: { value: string; label: string; iconName: IconName }[] = [
  { value: 'PC',          label: 'PC',          iconName: 'pc'          },
  { value: 'PlayStation', label: 'PlayStation', iconName: 'playstation' },
  { value: 'Xbox',        label: 'Xbox',        iconName: 'xbox'        },
  { value: 'Switch',      label: 'Switch',      iconName: 'switch'      },
  { value: 'iOS',         label: 'iOS',         iconName: 'ios'         },
  { value: 'Android',     label: 'Android',     iconName: 'android'     },
]

function PlatformPickerInner({ current }: { current: string[] }) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  function toggle(value: string) {
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]

    const params = new URLSearchParams(searchParams.toString())
    if (next.length === 0) {
      params.delete('platforms')
    } else {
      params.set('platforms', next.join(','))
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 justify-center [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {PLATFORMS.map(p => {
        const active = current.includes(p.value)
        return (
          <button
            key={p.value}
            onClick={() => toggle(p.value)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border transition-all ${
              active
                ? 'bg-ink text-paper border-ink'
                : 'text-ink border-rule hover:border-ink hover:text-accent'
            }`}
          >
            <Icon name={p.iconName} size={16} label={p.label} />
            <span>{p.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function PlatformPicker({ current }: { current: string[] }) {
  return (
    <Suspense fallback={<div className="h-9 w-full" />}>
      <PlatformPickerInner current={current} />
    </Suspense>
  )
}
