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
      params.delete('platform')
    } else {
      params.set('platform', next.join(','))
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
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
              active
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:hover:border-indigo-500 dark:hover:text-indigo-400'
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
