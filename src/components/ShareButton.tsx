'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

type Props = {
  title: string
  url?: string
  /** Optional descriptive text carried into the native share sheet (e.g. the LumiScore hook). */
  shareText?: string
}

export default function ShareButton({ title, url, shareText }: Props) {
  const t = useTranslations('shareButton')
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
      await navigator.share({ title, text: shareText, url: getUrl() }).catch(() => {})
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Copy link */}
      <button
        onClick={copyLink}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-kicker uppercase font-semibold border transition-all ${
          copied
            ? 'border-ivy text-ivy'
            : 'border-rule text-ink hover:border-ink hover:text-accent'
        }`}
        style={{ fontVariantCaps: 'all-small-caps' }}
        title={t('copyLink')}
      >
        {copied ? `✓ ${t('copied')}` : `🔗 ${t('copyLink')}`}
      </button>

      {/* Native share — only shown after mount on devices that support it */}
      {hasNativeShare && (
        <button
          onClick={nativeShare}
          className="flex items-center gap-1.5 px-3 py-1.5 text-kicker uppercase font-semibold border border-rule text-ink hover:border-ink hover:text-accent transition-all"
          style={{ fontVariantCaps: 'all-small-caps' }}
          title={t('share')}
        >
          ↗ {t('share')}
        </button>
      )}
    </div>
  )
}
