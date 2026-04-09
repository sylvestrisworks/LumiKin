import { auth, signIn, signOut } from '@/auth'

// Server actions must be declared before any conditional branching
async function handleSignOut() {
  'use server'
  await signOut({ redirectTo: '/' })
}

async function handleSignIn() {
  'use server'
  await signIn('google')
}

export default async function NavAuthButton() {
  const session = await auth()

  if (session?.user) {
    return (
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-xs text-slate-500 hidden lg:block truncate max-w-[120px]">
          {session.user.name ?? session.user.email}
        </span>
        <form action={handleSignOut}>
          <button
            type="submit"
            className="text-xs font-semibold text-slate-500 hover:text-red-600 px-3 py-1.5
              rounded-lg border border-slate-200 hover:border-red-200 transition-colors"
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
