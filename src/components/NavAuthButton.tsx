import { auth, signIn } from '@/auth'
import { getLocale, getTranslations } from 'next-intl/server'
import AccountMenu from './AccountMenu'

// Signing in from the nav lands the user on their library — the home for the
// import flow — instead of bouncing back to wherever they happened to be.
async function handleSignIn(locale: string) {
  'use server'
  await signIn('google', { redirectTo: `/${locale}/library` })
}

export default async function NavAuthButton() {
  const [session, t, locale] = await Promise.all([auth(), getTranslations('nav'), getLocale()])

  if (session?.user) {
    const { name, email, image } = session.user
    return <AccountMenu name={name} email={email} image={image} />
  }

  return (
    <form action={handleSignIn.bind(null, locale)}>
      <button
        type="submit"
        className="text-kicker uppercase font-semibold text-ink
          px-3 py-1.5 border border-rule hover:border-ink
          hover:text-accent transition-colors shrink-0"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {t('signIn')}
      </button>
    </form>
  )
}
