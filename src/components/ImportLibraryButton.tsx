'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'

const ImportModal = dynamic(() => import('./ImportModal'), { ssr: false })

export default function ImportLibraryButton() {
  const t = useTranslations('library')
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-kicker uppercase font-semibold border border-rule text-ink hover:border-ink hover:text-accent transition-colors"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        ↓ {t('importButton')}
      </button>
      {open && <ImportModal onClose={() => setOpen(false)} />}
    </>
  )
}
