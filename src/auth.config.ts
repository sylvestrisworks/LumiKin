// Edge-compatible auth config — no Node.js-only dependencies (no DB adapter, no bcrypt)
// Used by middleware.ts which runs in the Edge Runtime.
// The full auth.ts (with DrizzleAdapter) is used everywhere else.

import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'

export const authConfig = {
  providers: [
    Google,
    // Epic — minimal config for edge middleware (no fetch calls)
    { id: 'epic', name: 'Epic Games', type: 'oauth' },
    Credentials({
      name: 'LumiKin Reviewer',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      authorize(credentials) {
        if (
          credentials?.email    === process.env.REVIEWER_EMAIL &&
          credentials?.password === process.env.REVIEWER_PASSWORD
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
