import { getTranslations } from 'next-intl/server'

export type GameFAQProps = {
  title: string
  score: number
  recommendedMinAge: number | null
  timeRecommendationLabel: string | null
  risksNarrative: string | null
  // Catalog games: optional ESRB/PEGI string joined like "ESRB E · PEGI 7"
  ageRatingLine?: string | null
  // UGC pages pass the platform context ("Roblox" / "Fortnite Creative") so
  // questions read naturally and don't pretend a Roblox map is a standalone game.
  platformContext?: string | null
  locale: string
}

type VerdictKey = 'verdictGreat' | 'verdictGood' | 'verdictCaution' | 'verdictAvoid'

function verdictKeyFor(score: number): VerdictKey {
  if (score >= 70) return 'verdictGreat'
  if (score >= 50) return 'verdictGood'
  if (score >= 35) return 'verdictCaution'
  return 'verdictAvoid'
}

function squash(s: string, max = 400): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

export default async function GameFAQ(props: GameFAQProps) {
  const t = await getTranslations({ locale: props.locale, namespace: 'gameFaq' })
  const { title, score, recommendedMinAge, timeRecommendationLabel, risksNarrative, ageRatingLine, platformContext } = props

  const verdict = t(verdictKeyFor(score))
  const isUgc = !!platformContext

  // Build Q&As. Each entry is { q, a } strings; undefined entries are dropped.
  const qa: Array<{ q: string; a: string }> = []

  // Q1 — safe for kids? Always present.
  qa.push({
    q: t('q1', { title }),
    a: recommendedMinAge != null
      ? t('a1WithAge', { title, score, age: recommendedMinAge, verdict })
      : t('a1', { title, score, verdict }),
  })

  // Q2 — what age. Only when we have a recommended min age.
  if (recommendedMinAge != null) {
    qa.push({
      q: t('q2', { title }),
      a: isUgc
        ? t('a2Ugc', { title, age: recommendedMinAge, platform: platformContext! })
        : ageRatingLine
          ? t('a2WithRatings', { title, age: recommendedMinAge, ratings: ageRatingLine })
          : t('a2', { title, age: recommendedMinAge }),
    })
  }

  // Q3 — how long. Only when we have a time recommendation label.
  if (timeRecommendationLabel) {
    qa.push({
      q: t('q3', { title }),
      a: isUgc
        ? t('a3Ugc', { title, time: timeRecommendationLabel })
        : t('a3', { title, time: timeRecommendationLabel }),
    })
  }

  // Q4 — risks. Only when we have a risks narrative (already localized by the
  // page via game_translations / experience_translations overlay).
  if (risksNarrative && risksNarrative.trim().length > 20) {
    qa.push({
      q: t('q4', { title }),
      a: squash(risksNarrative, 400),
    })
  }

  if (qa.length === 0) return null

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const ldJson = JSON.stringify(faqLd)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson }} />
      <section
        aria-labelledby="game-faq-heading"
        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5"
      >
        <h2
          id="game-faq-heading"
          className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3"
        >
          {t('heading')}
        </h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {qa.map(({ q, a }, i) => (
            <details key={q} className="group py-3 open:pb-4" open={i === 0}>
              <summary className="flex items-start justify-between gap-3 cursor-pointer list-none">
                <span className="font-medium text-sm text-slate-800 dark:text-slate-100 group-open:text-indigo-600 dark:group-open:text-indigo-400 transition-colors">
                  {q}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 mt-0.5 text-slate-400 dark:text-slate-500 group-open:rotate-45 transition-transform text-lg leading-none"
                >
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  )
}
