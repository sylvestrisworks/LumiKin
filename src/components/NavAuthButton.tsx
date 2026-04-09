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
    <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold
      flex items-center justify-center select-none shrink-0 ring-2 ring-indigo-100 hover:ring-indigo-400 transition-all">
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
        {/* Clickable avatar → dashboard */}
        <a href={`/${locale}/dashboard`} title="Family Dashboard">
          {image ? (
            <img
              src={image}
              alt={name ?? email ?? 'User'}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-indigo-100 hover:ring-indigo-400 transition-all"
            />
          ) : (
            <Initials name={name} email={email} />
          )}
        </a>

        {/* Sign out */}
        <form action={handleSignOut}>
          <button
            type="submit"
            className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors"
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
        className="text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700
          px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300
          hover:text-indigo-700 transition-colors shrink-0"
      >
        Sign in
      </button>
    </form>
  )
}
