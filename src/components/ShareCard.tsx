'use client'

import { useState, useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { GameCardProps } from '@/types/game'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(minutes: number | null | undefined): string {
  if (!minutes) return '—'
  if (minutes >= 120) return '2h+ / day'
  if (minutes === 90) return '90 min / day'
  if (minutes === 60) return '60 min / day'
  return `${minutes} min / day`
}

function risLabel(ris: number | null | undefined): { label: string; tone: 'ivy' | 'warm' | 'accent'; sub: string } {
  const v = ris ?? 0
  if (v < 0.3) return { label: 'Low',      tone: 'ivy',    sub: 'Minimal pressure' }
  if (v < 0.6) return { label: 'Moderate', tone: 'warm',   sub: 'Some pressure'    }
  return              { label: 'High',     tone: 'accent', sub: 'High pressure'    }
}

function DotRow({ filled }: { filled: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={
            'w-2.5 h-2.5 rounded-full ' +
            (i < filled ? 'bg-ink' : 'border border-ink')
          }
        />
      ))}
    </div>
  )
}

// ─── Editorial nutrition label ────────────────────────────────────────────────
// Visual lineage: NYT Cooking + Wirecutter spec sheets, not FDA. Paper bg,
// fraunces title, hairline rules, small-caps section labels. Score colors are
// ivy/accent so the label reads consistent with the page it sits on.

function NutritionLabel({ data, labelRef }: { data: GameCardProps; labelRef: RefObject<HTMLDivElement | null> }) {
  const { game, scores, review } = data
  const bds         = scores?.bds ?? null
  const ris         = scores?.ris ?? null
  const topBenefits = scores?.topBenefits ?? []
  const risk        = risLabel(ris)
  const recommendedAge = scores?.recommendedMinAge

  const enrichmentLabel =
    bds == null  ? '' :
    bds >= 0.66  ? 'High cognitive enrichment' :
    bds >= 0.40  ? 'Moderate enrichment' :
                   'Low enrichment'

  const topSkills = topBenefits.slice(0, 5).map((b) => ({
    label: b.skill,
    dots:  Math.min(Math.round((b.score / b.maxScore) * 5), 5),
  }))

  const toneClass =
    risk.tone === 'ivy'    ? 'text-ivy' :
    risk.tone === 'warm'   ? 'text-warm' :
                             'text-accent'

  return (
    <div
      ref={labelRef as RefObject<HTMLDivElement>}
      className="bg-paper text-ink max-w-sm w-full p-6"
      style={{
        border: '1px solid rgb(20 17 15)',
        boxShadow: '4px 4px 0 rgba(20, 17, 15, 0.15)',
      }}
    >
      {/* Masthead — kicker + title + dek */}
      <header className="border-b-2 border-ink pb-3 mb-4">
        <p
          className="text-[10px] uppercase font-semibold text-accent mb-1 tracking-[0.12em]"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          LumiKin · Review
        </p>
        <h1
          className="font-serif text-2xl leading-[1.05] tracking-tight"
          style={{ fontOpticalSizing: 'auto' }}
        >
          {game.title}
        </h1>
        {game.developer && (
          <p className="font-serif italic text-sm text-muted mt-1">{game.developer}</p>
        )}
        {game.genres.length > 0 && (
          <p
            className="text-[10px] uppercase text-muted mt-2 tracking-[0.12em]"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {game.genres.slice(0, 3).join(' · ')}
          </p>
        )}
      </header>

      {/* Recommended daily limit — single line, big numeral, small-caps label */}
      <div className="flex items-baseline justify-between mb-4">
        <span
          className="text-[10px] uppercase font-semibold text-muted tracking-[0.12em]"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          Daily limit
        </span>
        <span className="font-serif text-xl tracking-tight tabular-nums text-ink">
          {formatTime(scores?.timeRecommendationMinutes)}
        </span>
      </div>

      {/* Growth (BDS) + Risk verdict — two cells, hairline rule between */}
      <div className="border-t border-b border-ink py-4 grid grid-cols-2">
        <div className="pr-4">
          <p
            className="text-[10px] uppercase text-muted mb-1 tracking-[0.12em]"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Growth (BDS)
          </p>
          <p className="font-serif text-4xl text-ivy tabular-nums leading-none">
            {bds != null ? Math.round(bds * 100) : '—'}
            <span className="text-base text-muted ml-1">/100</span>
          </p>
          {enrichmentLabel && (
            <p className="text-[10px] uppercase text-muted mt-1 tracking-wider">
              {enrichmentLabel}
            </p>
          )}
        </div>
        <div className="pl-4 border-l border-ink/30">
          <p
            className="text-[10px] uppercase text-muted mb-1 tracking-[0.12em]"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Risk (RIS)
          </p>
          <p className={`font-serif text-4xl ${toneClass} leading-none`}>
            {risk.label}
          </p>
          <p className="text-[10px] uppercase text-muted mt-1 tracking-wider">
            {risk.sub}
          </p>
        </div>
      </div>

      {/* Top skills — sparkline dots per skill */}
      {topSkills.length > 0 && (
        <div className="py-4 border-b border-ink">
          <p
            className="text-[10px] uppercase font-semibold text-muted mb-3 tracking-[0.12em]"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Top skills developed
          </p>
          <ul className="space-y-2">
            {topSkills.map((s) => (
              <li key={s.label} className="flex items-center justify-between">
                <span className="font-serif text-sm text-ink">{s.label}</span>
                <DotRow filled={s.dots} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Editorial summary — narrative or top-benefit list */}
      {(review?.benefitsNarrative || topBenefits.length > 0) && (
        <div className="pt-4">
          <p
            className="text-[10px] uppercase font-semibold text-muted mb-2 tracking-[0.12em]"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            In a nutshell
          </p>
          <p className="font-serif italic text-sm text-ink/90 leading-snug">
            {review?.benefitsNarrative ?? `Builds: ${topBenefits.slice(0, 3).map((b) => b.skill).join(', ')}.`}
          </p>
        </div>
      )}

      {/* Parent tip — handwritten margin treatment for the printable card */}
      {review?.parentTip && (
        <div className="mt-4 pl-3 border-l-2 border-accent">
          <p
            className="text-[10px] uppercase font-semibold text-ink mb-1 tracking-[0.12em]"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            A note from the editors
          </p>
          <p className="font-serif italic text-sm text-ink leading-snug">
            {review.parentTip}
          </p>
        </div>
      )}

      {/* Colophon */}
      <p
        className="text-[9px] uppercase text-muted text-center mt-5 tracking-[0.18em] pt-3 border-t border-ink/30"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        LumiScore · lumikin.org{recommendedAge != null ? ` · Ages ${recommendedAge}+` : ''}
      </p>
    </div>
  )
}

// ─── Share button + modal ─────────────────────────────────────────────────────

export default function ShareButton({ data }: { data: GameCardProps }) {
  const [open,    setOpen]    = useState(false)
  const [copied,  setCopied]  = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [mounted, setMounted] = useState(false)
  const labelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  function handleCopyLink() {
    const url = window.location.href
    if (typeof navigator.share !== 'undefined') {
      navigator.share({ title: `${data.game.title} — LumiScore`, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }).catch(() => {})
    }
  }

  async function handleSaveImage() {
    if (!labelRef.current) return
    setSaving(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(labelRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#F7F1E8', // paper, morning palette — image looks like print
      })
      const link = document.createElement('a')
      link.download = `${data.game.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-lumiscore.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Image export failed:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-kicker uppercase text-muted hover:text-accent transition-colors"
        style={{ fontVariantCaps: 'all-small-caps' }}
        aria-label="Share with a parent"
      >
        Share →
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop — ink-toned semi-opaque, no blur (keeps editorial calm) */}
          <div
            className="absolute inset-0 bg-ink/60"
            onClick={() => setOpen(false)}
          />

          {/* Modal — hairline-bordered paper rectangle, no rounded corners */}
          <div className="relative bg-paper text-ink border border-ink w-full max-w-md max-h-[92vh] overflow-y-auto flex flex-col">
            <div className="flex items-baseline justify-between px-6 py-4 border-b border-ink shrink-0">
              <div>
                <p
                  className="text-kicker uppercase font-semibold text-accent"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  Share with a parent
                </p>
                <p className="font-serif italic text-sm text-muted mt-0.5">{data.game.title}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-kicker uppercase text-muted hover:text-ink transition-colors"
                style={{ fontVariantCaps: 'all-small-caps' }}
                aria-label="Close"
              >
                Close ✕
              </button>
            </div>

            <div className="px-6 py-6 flex justify-center">
              <NutritionLabel data={data} labelRef={labelRef} />
            </div>

            <div className="border-t border-ink px-6 py-4 shrink-0 mt-auto flex flex-col gap-2">
              <button
                onClick={handleSaveImage}
                disabled={saving}
                className="w-full border border-ink bg-ink text-paper hover:bg-paper hover:text-ink active:translate-y-[1px] disabled:opacity-60 transition-colors text-kicker uppercase font-semibold py-3"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {saving ? 'Saving…' : 'Save as image'}
              </button>
              <button
                onClick={handleCopyLink}
                className="w-full border border-ink/40 text-ink hover:border-accent hover:text-accent active:translate-y-[1px] transition-colors text-kicker uppercase py-3"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {copied ? '✓ Link copied' : 'Copy page link'}
              </button>
              <p className="text-[11px] text-muted text-center italic font-serif mt-1">
                Save as image to share via WhatsApp, iMessage, or email.
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
