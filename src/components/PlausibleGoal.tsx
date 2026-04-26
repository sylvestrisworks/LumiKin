'use client'

import { useEffect } from 'react'
import { trackGoal, type PlausibleGoal } from '@/lib/plausible'

export default function PlausibleGoal({ goal }: { goal: PlausibleGoal }) {
  useEffect(() => {
    trackGoal(goal)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
