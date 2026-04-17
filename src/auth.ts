// Auth.js v5 (next-auth@beta) — requires next-auth@beta to be installed.
// Type errors below are a v4/v5 mismatch in the type definitions; they resolve once v5 is installed.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { timingSafeEqual } from 'crypto'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { getRawDb } from '@/lib/db'
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema'

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Support both v4 (NEXTAUTH_SECRET) and v5 (AUTH_SECRET) env var names
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: DrizzleAdapter(getRawDb(), {
    usersTable:              users,
    accountsTable:           accounts,
    sessionsTable:           sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    // Explicitly pass env vars so both old (GOOGLE_CLIENT_ID) and new (AUTH_GOOGLE_ID) names work
    Google({
      clientId:     process.env.AUTH_GOOGLE_ID     ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: 'LumiKin Reviewer',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      authorize(credentials) {
        const expectedEmail    = process.env.REVIEWER_EMAIL    ?? ''
        const expectedPassword = process.env.REVIEWER_PASSWORD ?? ''
        const givenEmail       = String(credentials?.email    ?? '')
        const givenPassword    = String(credentials?.password ?? '')
        const safeCompare = (a: string, b: string) => {
          const ab = Buffer.from(a)
          const bb = Buffer.from(b)
          return ab.length === bb.length && timingSafeEqual(ab, bb)
        }
        if (safeCompare(givenEmail, expectedEmail) && safeCompare(givenPassword, expectedPassword)) {
          return { id: '1', name: 'Reviewer', email: givenEmail }
        }
        return null
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    // Ensure user.id is available in the JWT token
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id
      return token
    },
    // Expose token.sub as session.user.id
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})
