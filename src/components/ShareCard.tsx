'use client'

import { useState, useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Share2, X, Check, Download, Link } from 'lucide-react'
import type { GameCardProps } from '@/types/game'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(minutes: number | null | undefined): string {
  if (!minutes) return '—'
  if (minutes >= 120) return '2+ Hrs / Day'
  if (minutes === 90) return '1.5 Hrs / Day'
  if (minutes === 60) return '1 Hr / Day'
  return `${minutes} Min / Day`
}

function risInfo(ris: number | null | undefined): { label: string; color: string; sub: string } {
  const v = ris ?? 0
  if (v < 0.3) return { label: 'Low',      color: 'text-green-500',  sub: 'Minimal Pressure' }
  if (v < 0.6) return { label: 'Moderate', color: 'text-yellow-500', sub: 'Some Pressure'    }
  return              { label: 'High',     color: 'text-red-500',    sub: 'High Pressure'    }
}

function DotRow({ filled }: { filled: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`w-3.5 h-3.5 rounded-full ${i < filled ? 'bg-black' : 'border-2 border-black'}`} />
      ))}
    </div>
  )
}

// ─── Nutrition Label ──────────────────────────────────────────────────────────

function NutritionLabel({ data, labelRef }: { data: GameCardProps; labelRef: RefObject<HTMLDivElement | null> }) {
  const { game, scores, review } = data
  const curascore   = scores?.curascore ?? null
  const topBenefits = scores?.topBenefits ?? []
  const risk        = risInfo(scores?.ris)

  const enrichmentLabel =
    curascore == null ? '' :
    curascore >= 70   ? 'High Cognitive Enrichment' :
    curascore >= 40   ? 'Moderate Enrichment' :
                        'Low Enrichment'

  const topSkills = topBenefits.slice(0, 5).map(b => ({
    label: b.skill,
    dots:  Math.min(Math.round((b.score / b.maxScore) * 5), 5),
  }))

  return (
    <div
      ref={labelRef as RefObject<HTMLDivElement>}
      className="bg-white max-w-sm w-full p-4 md:p-5"
      style={{
        border: '2px solid black',
        boxShadow: '8px 8px 0px rgba(0,0,0,0.1)',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      {/* Header */}
      <header className="mb-3">
        <h1 className="text-3xl font-black uppercase leading-none tracking-tight mb-0.5">{game.title}</h1>
        {game.developer && (
          <h2 className="text-sm font-bold text-gray-600 mb-2">{game.developer.toUpperCase()}</h2>
        )}
        <div className="flex flex-wrap gap-1.5">
          {game.genres.slice(0, 3).map(g => (
            <span key={g} className="border-2 border-black rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">{g}</span>
          ))}
        </div>
      </header>

      {/* Serving */}
      <div className="border-t-[10px] border-black pt-2 pb-2 flex justify-between items-end">
        <h3 className="text-sm font-black uppercase">Recommended Serving</h3>
        <span className="text-sm font-black text-green-600 uppercase">{formatTime(scores?.timeRecommendationMinutes)}</span>
      </div>

      {/* Curascore + Risk */}
      <div className="border-t-4 border-black border-b-[6px] border-b-black py-3 grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center justify-center text-center border-r-2 border-black px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Growth Value</span>
          <div className="text-5xl font-black text-blue-600 tracking-tighter">
            {curascore ?? '—'}<span className="text-xl text-black">/100</span>
          </div>
          <span className="text-[10px] font-semibold uppercase mt-1 text-gray-700">{enrichmentLabel}</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Addictive Hooks</span>
          <div className={`text-4xl font-black uppercase tracking-tighter ${risk.color}`}>{risk.label}</div>
          <span className="text-[10px] font-semibold uppercase mt-1 text-gray-700">{risk.sub}</span>
        </div>
      </div>

      {/* % Daily Dev Value */}
      {topSkills.length > 0 && (
        <div className="py-2">
          <h3 className="text-[10px] font-black uppercase text-right mb-1.5 border-b-2 border-black pb-1">% Daily Dev Value *</h3>
          {topSkills.map(s => (
            <div key={s.label} className="flex justify-between items-center py-1 border-b border-gray-200 last:border-0">
              <span className="font-bold text-gray-800 text-sm">{s.label}</span>
              <DotRow filled={s.dots} />
            </div>
          ))}
        </div>
      )}

      {/* Active Ingredients */}
      {(review?.benefitsNarrative || topBenefits.length > 0) && (
        <div className="border-t-[6px] border-black pt-2 mt-1">
          <h3 className="text-[10px] font-black uppercase mb-1.5">Active Ingredients</h3>
          <p className="text-xs text-gray-800 leading-snug">
            {review?.benefitsNarrative ?? `Contains: ${topBenefits.slice(0, 3).map(b => b.skill).join(', ')}.`}
          </p>
        </div>
      )}

      {/* Parent Pro-Tip */}
      {review?.parentTip && (
        <div className="mt-3 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-md">
          <h4 className="font-bold text-yellow-800 text-[10px] uppercase tracking-wide mb-1">Parent Pro-Tip</h4>
          <p className="text-xs text-yellow-900 leading-snug">{review.parentTip}</p>
        </div>
      )}

      <p className="text-[9px] text-gray-400 text-center mt-3 uppercase tracking-widest">
        Curascore by Good Game Parent · curascore.com
      </p>
    </div>
  )
}

// ─── Share Button + Modal ─────────────────────────────────────────────────────

export default function ShareButton({ data }: { data: GameCardProps }) {
  const [open,      setOpen]      = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [mounted,   setMounted]   = useState(false)
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
      navigator.share({ title: `${data.game.title} — Curascore`, url }).catch(() => {})
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
        backgroundColor: '#ffffff',
      })
      const link = document.createElement('a')
      link.download = `${data.game.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-curascore.png`
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
        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
      >
        <Share2 size={15} strokeWidth={2.5} />
        Share with a parent
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="font-bold text-slate-800">Share with a parent</h2>
                <p className="text-xs text-slate-500 mt-0.5">{data.game.title}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Label preview */}
            <div className="px-5 py-5 flex justify-center">
              <NutritionLabel data={data} labelRef={labelRef} />
            </div>

            {/* Action bar */}
            <div className="border-t border-slate-100 px-5 py-4 shrink-0 mt-auto flex flex-col gap-2">
              <button
                onClick={handleSaveImage}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all"
              >
                <Download size={16} />
                {saving ? 'Saving…' : 'Save as image'}
              </button>
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-all"
              >
                {copied
                  ? <><Check size={16} className="text-green-600" /> Link copied!</>
                  : <><Link size={16} /> Copy page link</>
                }
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                Save as image to share via WhatsApp, iMessage, or email
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
