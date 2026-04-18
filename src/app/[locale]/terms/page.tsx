export const revalidate = 86400

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — LumiKin',
  description: 'Terms governing your use of the LumiKin game rating service.',
}

export default function TermsPage() {
  const updated = '14 April 2026'
  const contact = 'legal@goodgameparent.com'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Terms of Service</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Last updated: {updated}</p>
        </div>

        <section className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed space-y-6">

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">1. About the service</h2>
            <p className="text-slate-600 dark:text-slate-400">
              LumiKin is an independent game rating service for parents.
              We publish AI-assisted evaluations of video games and Roblox experiences to help parents
              make informed decisions about the games their children play.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">2. Eligibility</h2>
            <p className="text-slate-600 dark:text-slate-400">
              You must be at least 18 years old to create an account. By using LumiKin you confirm
              that you meet this requirement. Children should not register for or use this service.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">3. Informational purpose only</h2>
            <p className="text-slate-600 dark:text-slate-400">
              LumiKin ratings and time recommendations are informational only. They reflect our
              independent assessment methodology and are not a substitute for professional child
              development advice, parental supervision, or official age ratings (PEGI, ESRB). Every
              child is different — use our ratings as one input among many.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">4. Accuracy</h2>
            <p className="text-slate-600 dark:text-slate-400">
              We strive to keep ratings up to date, but game content can change after release. Scores
              reflect the game as evaluated at the time of our review. We accept no liability for
              decisions made based on our ratings.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">5. Community tips</h2>
            <p className="text-slate-600 dark:text-slate-400">
              You may submit short tips on game pages. By submitting a tip you confirm that:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600 dark:text-slate-400">
              <li>The content is your own and does not infringe third-party rights</li>
              <li>It does not contain harmful, abusive, or illegal content</li>
              <li>You grant LumiKin a non-exclusive licence to display it on LumiKin</li>
            </ul>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              We reserve the right to remove tips that violate these terms without notice.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">6. Account</h2>
            <p className="text-slate-600 dark:text-slate-400">
              You are responsible for keeping your account secure. You may delete your account at any
              time from <Link href="/account" className="text-indigo-600 dark:text-indigo-400 hover:underline">Account settings</Link>.
              We may suspend or terminate accounts that violate these terms.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">7. Intellectual property</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Game titles, screenshots, and trademarks belong to their respective owners. LumiKin
              scores, methodology, and written content are owned by LumiKin and may not be
              reproduced without permission.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">8. Limitation of liability</h2>
            <p className="text-slate-600 dark:text-slate-400">
              To the maximum extent permitted by law, LumiKin shall not be liable for any
              indirect, incidental, or consequential damages arising from use of this service or
              reliance on our game ratings.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">9. Governing law</h2>
            <p className="text-slate-600 dark:text-slate-400">
              These terms are governed by the laws of Sweden. Disputes will be resolved in Swedish courts,
              without prejudice to your rights as a consumer under applicable EU law.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">10. Contact</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Questions about these terms:{' '}
              <a href={`mailto:${contact}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">{contact}</a>
            </p>
          </div>

        </section>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex gap-4 text-sm">
          <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">Privacy Policy</Link>
          <Link href="/account" className="text-indigo-600 dark:text-indigo-400 hover:underline">Manage account</Link>
        </div>

      </main>
    </div>
  )
}
