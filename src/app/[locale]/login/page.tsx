'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Guard against open redirect — only allow relative paths on this origin
  const rawCallback = searchParams.get('callbackUrl') ?? '/review'
  const callbackUrl = rawCallback.startsWith('/') && !rawCallback.startsWith('//') ? rawCallback : '/review'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Invalid email or password.')
    } else {
      router.push(callbackUrl)
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <a href="/" className="font-serif text-3xl text-ink">LumiKin</a>
          <p className="font-serif italic text-muted mt-1 text-sm">Reviewer sign-in</p>
        </div>

        <div className="border border-rule p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-kicker uppercase font-semibold text-muted mb-1" style={{ fontVariantCaps: 'all-small-caps' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 border border-rule bg-paper text-ink text-sm
                  placeholder:text-muted
                  focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink"
              />
            </div>

            <div>
              <label className="block text-kicker uppercase font-semibold text-muted mb-1" style={{ fontVariantCaps: 'all-small-caps' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 border border-rule bg-paper text-ink text-sm
                  placeholder:text-muted
                  focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink"
              />
            </div>

            {error && (
              <p className="text-sm text-accent border border-accent px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-ink hover:bg-accent text-paper text-kicker uppercase font-semibold
                transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-kicker uppercase text-muted mt-4" style={{ fontVariantCaps: 'all-small-caps' }}>
          <a href="/" className="hover:text-accent transition-colors">← Back to LumiKin</a>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
