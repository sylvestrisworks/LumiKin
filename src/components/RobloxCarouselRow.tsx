'use client'

import { useLocale, useTranslations } from 'next-intl'
import { CONFIDENCE_THRESHOLD } from '@/lib/scoring/experience-risk'
import type { ExperienceSummary } from '@/components/ExperienceCard'
import CarouselRail, { CarouselTile } from '@/components/CarouselRail'

const SMALL_CAPS = { fontVariantCaps: 'all-small-caps' as const }

function formatCount(n: number | null): string {
  if (n == null) return ''
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function RobloxCarouselRow({ experiences }: { experiences: ExperienceSummary[] }) {
  const locale  = useLocale()
  const t       = useTranslations('roblox')
  const tCommon = useTranslations('common')

  if (experiences.length === 0) return null

  return (
    <section className="pt-10">
      <CarouselRail kicker={t('carouselTitle')} seeAllHref={`/${locale}/game/roblox`} iconName="roblox">
        {experiences.map((exp, i) => {
          const pending = (exp.inputConfidence ?? 0) < CONFIDENCE_THRESHOLD
          return (
            <CarouselTile
              key={exp.slug}
              index={i + 1}
              href={`/${locale}/game/roblox/${exp.slug}`}
              image={exp.thumbnailUrl}
              title={exp.title}
              score={exp.curascore}
              ageLabel={exp.recommendedMinAge != null ? `${exp.recommendedMinAge}+` : null}
              ageTitle={exp.recommendedMinAge != null ? `Recommended age ${exp.recommendedMinAge}+` : undefined}
              footer={pending ? tCommon('notEnoughInfo') : (exp.creatorName ?? null)}
              pending={pending}
              meta={
                exp.activePlayers != null && exp.activePlayers > 0 ? (
                  <span className="text-kicker uppercase text-ivy tabular-nums flex items-center gap-1" style={SMALL_CAPS}>
                    <span className="w-1.5 h-1.5 rounded-full bg-ivy inline-block shrink-0" aria-hidden="true" />
                    {t('activePlayers', { count: formatCount(exp.activePlayers) })}
                  </span>
                ) : null
              }
            />
          )
        })}
      </CarouselRail>
    </section>
  )
}
