'use client'

import { useState, useEffect } from 'react'

type Props = {
  title: string
  url?: string
}

export default function ShareButton({ title, url }: Props) {
  const [copied, setCopied] = useState(false)
  const [hasNativeShare, setHasNativeShare] = useState(false)

  // Detect native share support after mount to avoid hydration mismatch
  useEffect(() => {
    setHasNativeShare(typeof navigator !== 'undefined' && !!navigator.share)
  }, [])

  function getUrl() {
    return url ?? (typeof window !== 'undefined' ? window.location.href : '')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(getUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
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

  return (
    <div className="flex items-center gap-1.5">
      {/* Copy link */}
      <button
        onClick={copyLink}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
          copied
            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400 hover:text-slate-800 dark:hover:border-slate-500 dark:hover:text-slate-100'
        }`}
        title="Copy link"
      >
        {copied ? '✓ Copied' : '🔗 Copy link'}
      </button>

      {/* Native share — only shown after mount on devices that support it */}
      {hasNativeShare && (
        <button
          onClick={nativeShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400 hover:text-slate-800 dark:hover:border-slate-500 dark:hover:text-slate-100 transition-all"
          title="Share"
        >
          ↗ Share
        </button>
      )}
    </div>
  )
}
