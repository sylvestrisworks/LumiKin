'use client'

import { useState } from 'react'
import { trackGoal } from '@/lib/plausible'

const SAMPLE_REQUEST = `curl -s https://api.lumikin.com/v1/games/minecraft`

const SAMPLE_RESPONSE = `{
  "slug": "minecraft",
  "title": "Minecraft",
  "methodology_version": "playsmart-0.1",
  "scored_at": "2026-04-20T14:33:00Z",
  "score": {
    "curascore": 0.22,
    "time_recommendation_minutes": 90,
    "tier": "extended"
  },
  "benefits": {
    "bds": 0.74,
    "b1_cognitive": 0.88,
    "b2_social_emotional": 0.60,
    "b3_motor": 0.55
  },
  "risks": {
    "ris": 0.18,
    "r1_dopamine_design": 0.10,
    "r2_monetization": 0.12,
    "r3_social_risk": 0.30,
    "r4_content_risk": 0.08
  },
  "content_flags": {
    "has_stranger_chat": true,
    "chat_moderation": "optional_server",
    "has_loot_boxes": false,
    "has_battle_pass": false
  }
}`

export default function ApiSampleBlock() {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(SAMPLE_REQUEST)
      trackGoal('api_sample_copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable — swallow silently
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 flex items-center gap-2">
        <span className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 flex-1">Request</span>
        <button
          onClick={handleCopy}
          className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-2 py-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
          aria-label="Copy request to clipboard"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="px-5 py-4 text-sm font-mono text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-950 overflow-x-auto leading-relaxed">
        <code>{SAMPLE_REQUEST}</code>
      </pre>
      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 flex items-center gap-2">
        <span className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400">Response</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-600">200 OK</span>
      </div>
      <pre className="px-5 py-4 text-sm font-mono text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-950 overflow-x-auto leading-relaxed">
        <code>{SAMPLE_RESPONSE}</code>
      </pre>
    </div>
  )
}
