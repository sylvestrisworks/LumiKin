'use client'

import { useState } from 'react'

type Props = {
  title: string
  url?: string // defaults to window.location.href
}

export default function ShareButton({ title, url }: Props) {
  const [copied, setCopied] = useState(false)

  function getUrl() {
    return url ?? (typeof window !== 'undefined' ? window.location.href : '')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(getUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers without clipboard API
      const input = document.createElement('input')
      input.value = getUrl()
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      await navigator.share({ title, url: getUrl() }).catch(() => {})
    }
  }

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  return (
    <div className="flex items-center gap-1.5">
      {/* Copy link */}
      <button
        onClick={copyLink}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
          copied
            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800'
        }`}
        title="Copy link"
      >
        {copied ? '✓ Copied' : '🔗 Copy link'}
      </button>

      {/* Native share — only shown on devices that support it (mobile) */}
      {hasNativeShare && (
        <button
          onClick={nativeShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border bg-white border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800 transition-all"
          title="Share"
        >
          ↗ Share
        </button>
      )}
    </div>
  )
}
