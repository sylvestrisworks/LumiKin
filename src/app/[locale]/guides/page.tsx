import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { sanityClient } from '@/sanity/lib/client'
import { guidesQuery } from '@/sanity/lib/queries'
import { urlFor } from '@/sanity/lib/image'
import { BookOpen } from 'lucide-react'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Parental Guides — Screen Time, Game Safety & More | LumiKin',
  description: 'In-depth guides for parents on screen time limits, game safety, age-appropriate gaming, and building healthy habits around video games.',
}

const CATEGORY_COLORS: Record<string, string> = {
  'screen-time':    'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'game-safety':    'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  'age-guide':      'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  'parenting-tips': 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
}

type LearnT = Awaited<ReturnType<typeof getTranslations<'learn'>>>

const CATEGORY_KEY: Record<string, Parameters<LearnT>[0]> = {
  'screen-time':    'catScreenTime',
  'game-safety':    'catGameSafety',
  'age-guide':      'catAgeGuide',
  'parenting-tips': 'catParentingTips',
}

type SanityGuide = {
  _id: string
  title: string
  slug: { current: string }
  excerpt?: string
  coverImage?: { asset: { _ref: string }; alt?: string }
  category?: string
  publishedAt?: string
}

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function GuidesPage() {
  const [locale, t, tLearn] = await Promise.all([
    getLocale(),
    getTranslations('guides'),
    getTranslations('learn'),
  ])
  const guides: SanityGuide[] = await sanityClient
    ?.fetch(guidesQuery, { locale })
    .catch(() => []) ?? []

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-12">

        <div className="mb-8">
          <nav className="text-xs text-slate-400 dark:text-slate-500 mb-3">
            <Link href={`/${locale}/learn`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t('breadcrumbLearn')}</Link>
            {' / '}
            <span>{t('breadcrumbCurrent')}</span>
          </nav>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('subtitle')}</p>
        </div>

        {guides.length === 0 ? (
          <div className="text-center py-24 text-slate-400 dark:text-slate-600">
            <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">{t('comingSoon')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {guides.map((guide) => (
              <Link key={guide._id} href={`/${locale}/guides/${guide.slug.current}`} className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all">
                {guide.coverImage?.asset ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urlFor(guide.coverImage)!.width(600).height(300).auto('format').url()}
                    alt={guide.coverImage.alt ?? guide.title}
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 flex items-center justify-center">
                    <BookOpen size={28} className="text-indigo-300 dark:text-indigo-700" />
                  </div>
                )}
                <div className="p-5">
                  {guide.category && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mb-2 ${CATEGORY_COLORS[guide.category] ?? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                      {CATEGORY_KEY[guide.category] ? tLearn(CATEGORY_KEY[guide.category]) : guide.category}
                    </span>
                  )}
                  <h2 className="font-bold text-slate-900 dark:text-white leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                    {guide.title}
                  </h2>
                  {guide.excerpt && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{guide.excerpt}</p>
                  )}
                  {guide.publishedAt && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">{formatDate(guide.publishedAt)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
