export const revalidate = 86400

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — LumiKin',
  description: 'How LumiKin collects, uses, and protects your personal data.',
}

export default function PrivacyPage() {
  const updated = '14 April 2026'
  const contact = 'privacy@goodgameparent.com'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Privacy Policy</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Last updated: {updated}</p>
        </div>

        <section className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed space-y-6">

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">1. Who we are</h2>
            <p className="text-slate-600 dark:text-slate-400">
              LumiKin is a game rating service for parents.
              We help parents understand how video games may affect their children&apos;s development,
              and recommend appropriate daily screen time limits. We are the data controller for personal
              data processed through this service.
            </p>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Contact: <a href={`mailto:${contact}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">{contact}</a>
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">2. Who this service is for</h2>
            <p className="text-slate-600 dark:text-slate-400">
              LumiKin is intended for adults — specifically parents and guardians. You must be at least
              18 years old to create an account. We do not knowingly collect personal data from children
              under 13, and children should not register for or use this service directly.
            </p>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Child profile data (name and birth year) that you enter about your own children is entered
              by you, as their parent or guardian, solely to personalize game recommendations. We treat
              this information with particular care and do not use it for any purpose beyond providing
              your requested features.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">3. What data we collect</h2>
            <div className="space-y-3 text-slate-600 dark:text-slate-400">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Account data (when you sign in with Google)</p>
                <p>Your email address, display name, and profile picture as provided by Google. We do not receive or store your Google password.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Child profiles (optional, entered by you)</p>
                <p>First name and birth year for each child profile you create. These are used to filter game recommendations by age and are never shared with third parties.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Game lists</p>
                <p>Games you mark as owned or added to your wishlist.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Community tips</p>
                <p>Tips you submit on game pages, including the optional author name and tip content.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Anonymous feedback</p>
                <p>Rating feedback submitted on game pages is not linked to your account.</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">4. What we do NOT collect</h2>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
              <li>No advertising tracking or third-party analytics</li>
              <li>No payment information (we have no paid features)</li>
              <li>No location data</li>
              <li>No device fingerprinting</li>
              <li>We do not sell or share your data with advertisers</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">5. Cookies</h2>
            <p className="text-slate-600 dark:text-slate-400">
              We use a single session cookie to keep you signed in. This cookie is strictly necessary for
              the service to function and does not require your consent under GDPR or ePrivacy rules.
              We do not use advertising, analytics, or tracking cookies.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">6. Legal basis for processing (GDPR)</h2>
            <div className="space-y-2 text-slate-600 dark:text-slate-400">
              <p><span className="font-medium text-slate-700 dark:text-slate-300">Contract performance</span> — processing your account data, game lists, and child profiles to provide the features you signed up for.</p>
              <p><span className="font-medium text-slate-700 dark:text-slate-300">Legitimate interest</span> — maintaining security, preventing abuse, and improving the rating service.</p>
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">7. Data retention</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Your data is retained for as long as your account is active. When you delete your account,
              all associated data — including child profiles, game lists, and community tips — is
              permanently deleted within 30 days. Anonymous game feedback is retained indefinitely as it
              is not linked to your identity.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">8. Your rights</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-2">Under GDPR you have the right to:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
              <li><span className="font-medium text-slate-700 dark:text-slate-300">Access</span> — request a copy of your personal data</li>
              <li><span className="font-medium text-slate-700 dark:text-slate-300">Rectification</span> — correct inaccurate data</li>
              <li><span className="font-medium text-slate-700 dark:text-slate-300">Erasure</span> — delete your account and all associated data via <Link href="/account" className="text-indigo-600 dark:text-indigo-400 hover:underline">Account settings</Link></li>
              <li><span className="font-medium text-slate-700 dark:text-slate-300">Portability</span> — receive your data in a machine-readable format</li>
              <li><span className="font-medium text-slate-700 dark:text-slate-300">Object</span> — object to processing based on legitimate interest</li>
            </ul>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              To exercise any of these rights, contact us at{' '}
              <a href={`mailto:${contact}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">{contact}</a>.
              We will respond within 30 days. You also have the right to lodge a complaint with your national
              data protection authority.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">9. Data transfers</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Your data is stored in the EU (Neon PostgreSQL on AWS eu-west). Our AI evaluation pipeline
              uses AWS Bedrock (us-east-1). Transfers to the US are covered by the EU-US Data Privacy
              Framework and standard contractual clauses.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">10. Changes to this policy</h2>
            <p className="text-slate-600 dark:text-slate-400">
              We will notify registered users by email if we make material changes to this policy.
              Minor changes will be reflected with an updated &ldquo;Last updated&rdquo; date above.
            </p>
          </div>

        </section>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex gap-4 text-sm">
          <Link href="/terms" className="text-indigo-600 dark:text-indigo-400 hover:underline">Terms of Service</Link>
          <Link href="/account" className="text-indigo-600 dark:text-indigo-400 hover:underline">Delete my account</Link>
        </div>

      </main>
    </div>
  )
}
