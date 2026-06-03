'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'

function AgePickerInner({ current }: { current?: string }) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const t            = useTranslations('age')

  const AGE_SEGMENTS = [
    { value: 'E',   label: t('earlyYears'),      sub: t('earlyYearsSub')      },
    { value: 'E10', label: t('middleChildhood'),  sub: t('middleChildhoodSub') },
    { value: 'T',   label: t('earlyTeens'),       sub: t('earlyTeensSub')      },
    { value: 'M',   label: t('olderTeens'),       sub: t('olderTeensSub')      },
  ]

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === current) {
      params.delete('age')
    } else {
      params.set('age', value)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const activeIndex = AGE_SEGMENTS.findIndex(s => s.value === current)

  return (
    <div className="border border-rule p-1.5 grid grid-cols-2 sm:flex gap-1">
      {AGE_SEGMENTS.map((seg, i) => {
        const isActive = current === seg.value
        const isPast   = activeIndex >= 0 && i < activeIndex

        return (
          <button
            key={seg.value}
            onClick={() => select(seg.value)}
            // FIX: min-h-[44px] för att uppfylla Apples riktlinje för touch-targets
            className={`flex-1 flex flex-col items-center justify-center min-h-[44px] py-2 px-1 text-center transition-all duration-200 ${
              isActive
                ? 'bg-ink text-paper'
                : isPast
                ? 'text-accent hover:bg-ink/[0.04]'
                : 'text-muted hover:text-ink hover:bg-ink/[0.03]'
            }`}
          >
            <span className="font-serif text-xs sm:text-sm tracking-tight leading-none">
              {seg.label}
            </span>
            <span className={`text-[10px] mt-0.5 font-medium leading-none ${
              isActive ? 'text-paper/70' : 'text-muted'
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
    <Suspense fallback={<div className="h-14 bg-rule/30 animate-pulse" />}>
      <AgePickerInner current={current} />
    </Suspense>
  )
}
