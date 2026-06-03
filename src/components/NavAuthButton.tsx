import { auth, signIn, signOut } from '@/auth'
import { getLocale } from 'next-intl/server'

// Server actions must be declared before any conditional branching
async function handleSignOut() {
  'use server'
  await signOut({ redirectTo: '/' })
}

async function handleSignIn() {
  'use server'
  await signIn('google')
}

function Initials({ name, email }: { name?: string | null; email?: string | null }) {
  const src = name ?? email ?? '?'
  const initials = src
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span className="w-8 h-8 rounded-full bg-ink text-paper text-xs font-bold
      flex items-center justify-center select-none shrink-0 ring-1 ring-rule hover:ring-ink transition-all">
      {initials}
    </span>
  )
}

export default async function NavAuthButton() {
  const [session, locale] = await Promise.all([auth(), getLocale()])

  if (session?.user) {
    const { name, email, image } = session.user
    return (
      <div className="flex items-center gap-2 shrink-0">
        {/* Clickable avatar → account settings */}
        <a href={`/${locale}/account`} title="Account settings">
          {image ? (
            <img
              src={image}
              alt={name ?? email ?? 'User'}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-rule hover:ring-ink transition-all"
            />
          ) : (
            <Initials name={name} email={email} />
          )}
        </a>

        {/* Sign out */}
        <form action={handleSignOut}>
          <button
            type="submit"
            className="text-kicker uppercase font-semibold text-muted hover:text-accent transition-colors"
            style={{ fontVariantCaps: 'all-small-caps' }}
            title="Sign out"
          >
            Sign out
          </button>
        </form>
      </div>
    )
  }

  return (
    <form action={handleSignIn}>
      <button
        type="submit"
        className="text-kicker uppercase font-semibold text-ink
          px-3 py-1.5 border border-rule hover:border-ink
          hover:text-accent transition-colors shrink-0"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        Sign in
      </button>
    </form>
  )
}
