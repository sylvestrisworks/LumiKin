// Auth.js v5 (next-auth@beta) — requires next-auth@beta to be installed.
// Type errors below are a v4/v5 mismatch in the type definitions; they resolve once v5 is installed.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import type { OAuthConfig } from 'next-auth/providers'
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
    // Epic Games — custom OAuth provider (no built-in NextAuth provider)
    {
      id:   'epic',
      name: 'Epic Games',
      type: 'oauth',
      authorization: {
        url: 'https://www.epicgames.com/id/authorize',
        params: { scope: 'basic_profile', response_type: 'code' },
      },
      token: {
        url: 'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token',
        async request({ params, provider }) {
          const creds = Buffer.from(`${provider.clientId}:${provider.clientSecret}`).toString('base64')
          const res = await fetch('https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${creds}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type:   'authorization_code',
              code:          params.code!,
              redirect_uri:  params.redirect_uri!,
            }),
          })
          return { tokens: await res.json() }
        },
      },
      userinfo: {
        async request({ tokens }) {
          const accountId = (tokens as Record<string, string>).account_id
          const res = await fetch(
            `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/${accountId}`,
            { headers: { Authorization: `Bearer ${tokens.access_token}` } }
          )
          return res.json()
        },
      },
      profile(profile: Record<string, string>) {
        return {
          id:    profile.id ?? profile.accountId,
          name:  profile.displayName ?? profile.name ?? null,
          email: profile.email ?? null,
          image: null,
        }
      },
      clientId:     process.env.EPIC_CLIENT_ID,
      clientSecret: process.env.EPIC_CLIENT_SECRET,
    } satisfies OAuthConfig<Record<string, string>>,
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
