'use client'

import { useRouter, usePathname } from 'next/navigation'

const PLATFORMS = [
  { value: 'PC',          label: 'PC',        emoji: '🖥️' },
  { value: 'PlayStation', label: 'PlayStation', emoji: '🎮' },
  { value: 'Xbox',        label: 'Xbox',       emoji: '🟢' },
  { value: 'Switch',      label: 'Switch',     emoji: '🕹️' },
  { value: 'iOS',         label: 'iOS',        emoji: '📱' },
  { value: 'Android',     label: 'Android',    emoji: '🤖' },
]

export default function PlatformPicker({ current }: { current?: string }) {
  const router   = useRouter()
  const pathname = usePathname()

  function select(value: string) {
    const params = new URLSearchParams()
    if (value !== current) params.set('platform', value)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORMS.map(p => (
        <button
          key={p.value}
          onClick={() => select(p.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
            current === p.value
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
          }`}
        >
          <span>{p.emoji}</span>
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  )
}
