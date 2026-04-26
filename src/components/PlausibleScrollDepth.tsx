'use client'

import { useEffect, useRef } from 'react'
import { trackGoal, type PlausibleGoal } from '@/lib/plausible'

type Props = {
  goal: PlausibleGoal
  /** Percentage of page height to cross before firing (0–100). Default: 50 */
  threshold?: number
}

export default function PlausibleScrollDepth({ goal, threshold = 50 }: Props) {
  const fired = useRef(false)

  useEffect(() => {
    function check() {
      if (fired.current) return
      const scrolled = window.scrollY + window.innerHeight
      const total    = document.documentElement.scrollHeight
      if (total > 0 && (scrolled / total) * 100 >= threshold) {
        trackGoal(goal)
        fired.current = true
        window.removeEventListener('scroll', check)
      }
    }
    // Check on mount (in case the page is short and already past threshold)
    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
