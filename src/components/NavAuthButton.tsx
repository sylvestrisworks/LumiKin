import { auth, signIn } from '@/auth'
import { getLocale, getTranslations } from 'next-intl/server'
import AccountMenu from './AccountMenu'

async function handleSignIn() {
  'use server'
  await signIn('google')
}

export default async function NavAuthButton() {
  const [session, t] = await Promise.all([auth(), getTranslations('nav')])

  if (session?.user) {
    const { name, email, image } = session.user
    return <AccountMenu name={name} email={email} image={image} />
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
        {t('signIn')}
      </button>
    </form>
  )
}
