'use client'

import { signIn } from 'next-auth/react'

// Sign-in call-to-action. Starts Google OAuth and returns the user to
// `callbackPath` (e.g. their library) when done.
export default function SignInCta({
  callbackPath, label, className,
}: {
  callbackPath: string
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => signIn('google', { callbackUrl: callbackPath })}
      className={className}
      style={{ fontVariantCaps: 'all-small-caps' }}
    >
      {label}
    </button>
  )
}
