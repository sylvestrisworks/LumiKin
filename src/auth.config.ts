// Edge-compatible auth config — no Node.js-only dependencies (no DB adapter, no bcrypt)
// Used by middleware.ts which runs in the Edge Runtime.
// The full auth.ts (with DrizzleAdapter) is used everywhere else.

import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'

export const authConfig = {
  providers: [
    Google,
    Credentials({
      name: 'LumiKin Reviewer',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      authorize(credentials) {
        const expectedEmail    = process.env.REVIEWER_EMAIL
        const expectedPassword = process.env.REVIEWER_PASSWORD
        if (!expectedEmail || !expectedPassword) return null
        if (
          credentials?.email    === expectedEmail &&
          credentials?.password === expectedPassword
        ) {
          return { id: '1', name: 'Reviewer', email: String(credentials.email) }
        }
        return null
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
} satisfies NextAuthConfig
