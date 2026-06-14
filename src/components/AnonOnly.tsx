'use client'

import { useEffect, useState, type ReactNode } from 'react'

// Renders its children for signed-out visitors only. Children are server-rendered
// (so they're in the static HTML for anonymous traffic + SEO); once mounted we
// confirm the session via NextAuth's session endpoint and hide them if signed in.
// This lets us put a sign-in pitch on statically-cached pages without calling
// auth() server-side (which would opt the page into dynamic rendering).
export default function AnonOnly({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(s => { if (active && s?.user) setAuthed(true) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  if (authed) return null
  return <>{children}</>
}
