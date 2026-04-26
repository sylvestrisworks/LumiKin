'use client'

import { useEffect } from 'react'
import { trackGoal } from '@/lib/plausible'

const SEARCH_ENGINES = [
  'google.',
  'bing.',
  'yahoo.',
  'duckduckgo.',
  'ecosia.',
  'yandex.',
  'baidu.',
  'naver.',
  'brave.com/search',
]

export default function PlausibleSearchReferrer() {
  useEffect(() => {
    const ref = document.referrer
    if (ref && SEARCH_ENGINES.some((se) => ref.includes(se))) {
      trackGoal('game_page_from_search', { referrer: new URL(ref).hostname })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
