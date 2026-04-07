'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const AGE_SEGMENTS = [
  { value: 'E',   label: 'Early Years',     sub: 'Ages 5–7'   },
  { value: 'E10', label: 'Middle Childhood', sub: 'Ages 8–12'  },
  { value: 'T',   label: 'Early Teens',      sub: 'Ages 13–15' },
  { value: 'M',   label: 'Older Teens',      sub: 'Ages 16+'   },
]

function AgePickerInner({ current }: { current?: string }) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === current) {
      params.delete('age')
    } else {
      params.set('age', value)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const activeIndex = AGE_SEGMENTS.findIndex(s => s.value === current)

  return (
    <div className="bg-slate-100 rounded-2xl p-1.5 flex gap-1">
      {AGE_SEGMENTS.map((seg, i) => {
        const isActive = current === seg.value
        const isPast   = activeIndex >= 0 && i < activeIndex

        return (
          <button
            key={seg.value}
            onClick={() => select(seg.value)}
            className={`flex-1 flex flex-col items-center py-2 px-1 rounded-xl text-center transition-all duration-200 ${
              isActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : isPast
                ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
            }`}
          >
            <span className={`text-xs sm:text-sm font-black tracking-tight leading-none ${isActive ? 'text-white' : ''}`}>
              {seg.label}
            </span>
            <span className={`hidden sm:block text-[10px] mt-0.5 font-medium leading-none ${
              isActive ? 'text-indigo-200' : 'text-slate-400'
            }`}>
              {seg.sub}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function AgePicker({ current }: { current?: string }) {
  return (
    <Suspense fallback={<div className="h-14 bg-slate-100 rounded-2xl animate-pulse" />}>
      <AgePickerInner current={current} />
    </Suspense>
  )
}
