'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const ImportModal = dynamic(() => import('./ImportModal'), { ssr: false })

// ─── Platform card ────────────────────────────────────────────────────────────

function PlatformCard({
  logo,
  name,
  description,
  action,
}: {
  logo:        React.ReactNode
  name:        string
  description: string
  action:      React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0">{logo}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{name}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

// ─── Platform logos ───────────────────────────────────────────────────────────

function SteamLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#1b2838" />
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="Arial">S</text>
    </svg>
  )
}

function NintendoLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="12" fill="#e60012" />
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">NSW</text>
    </svg>
  )
}

function EpicLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="12" fill="#2d2d2d" />
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">EGS</text>
    </svg>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
      Coming soon
    </span>
  )
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export default function PlatformConnectionsWidget() {
  const [steamOpen, setSteamOpen] = useState(false)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Steam — fully functional */}
        <PlatformCard
          logo={<SteamLogo />}
          name="Steam"
          description="Import your game library"
          action={
            <button
              onClick={() => setSteamOpen(true)}
              className="text-xs px-3 py-1.5 bg-[#1b2838] hover:bg-[#2a475e] text-white font-semibold rounded-xl transition-colors"
            >
              Import
            </button>
          }
        />

        {/* Nintendo Switch — coming soon */}
        <PlatformCard
          logo={<NintendoLogo />}
          name="Nintendo Switch"
          description="Playtime tracking"
          action={<ComingSoonBadge />}
        />

        {/* Epic Games Store — coming soon */}
        <PlatformCard
          logo={<EpicLogo />}
          name="Epic Games Store"
          description="Library sync"
          action={<ComingSoonBadge />}
        />

      </div>

      {steamOpen && <ImportModal onClose={() => setSteamOpen(false)} />}
    </>
  )
}
