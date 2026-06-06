'use client'

import { useLocale, useTranslations } from 'next-intl'
import { CONFIDENCE_THRESHOLD } from '@/lib/scoring/experience-risk'
import type { ExperienceSummary } from '@/components/ExperienceCard'
import CarouselRail, { CarouselTile } from '@/components/CarouselRail'

export default function FortniteCarouselRow({ experiences }: { experiences: ExperienceSummary[] }) {
  const locale  = useLocale()
  const t       = useTranslations('fortnite')
  const tCommon = useTranslations('common')

  if (experiences.length === 0) return null

  return (
    <section className="pt-10">
      <CarouselRail kicker={t('carouselTitle')} seeAllHref={`/${locale}/game/fortnite-creative`} iconName="fortnite">
        {experiences.map((exp, i) => {
          const pending = (exp.inputConfidence ?? 0) < CONFIDENCE_THRESHOLD
          return (
            <CarouselTile
              key={exp.slug}
              index={i + 1}
              href={`/${locale}/game/fortnite-creative/${exp.slug}`}
              image={exp.thumbnailUrl}
              title={exp.title}
              score={exp.curascore}
              ageLabel={exp.recommendedMinAge != null ? `${exp.recommendedMinAge}+` : null}
              ageTitle={exp.recommendedMinAge != null ? `Recommended age ${exp.recommendedMinAge}+` : undefined}
              footer={pending ? tCommon('notEnoughInfo') : (exp.creatorName ?? null)}
              pending={pending}
            />
          )
        })}
      </CarouselRail>
    </section>
  )
}
