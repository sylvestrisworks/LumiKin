'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const PLATFORMS = [
  { value: 'PC',          label: 'PC',         emoji: '🖥️' },
  { value: 'PlayStation', label: 'PlayStation', emoji: '🎮' },
  { value: 'Xbox',        label: 'Xbox',        emoji: '🟢' },
  { value: 'Switch',      label: 'Switch',      emoji: '🕹️' },
  { value: 'iOS',         label: 'iOS',         emoji: '📱' },
  { value: 'Android',     label: 'Android',     emoji: '🤖' },
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
    router.push(qs ? `${pathname}?${qs}` : pathname)
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
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
            }`}
          >
            <span>{p.emoji}</span>
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
