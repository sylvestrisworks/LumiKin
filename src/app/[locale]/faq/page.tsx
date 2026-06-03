export const revalidate = 86400

import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { RUBRIC_DIMENSION_COUNT } from '@/lib/methodology'
import { sanityClient } from '@/sanity/lib/client'
import { faqsQuery } from '@/sanity/lib/queries'
import PortableTextRenderer from '@/components/PortableTextRenderer'
import type { PortableTextBlock } from '@portabletext/react'

// ─── Sanity types ────────────────────────────────────────────────────────────

type SanityFaqItem = {
  _id: string
  question: string
  answer: PortableTextBlock[]
  category?: string | null
}

// Walk a portable-text block array, returning a single plain-text string. Used
// for FAQPage JSON-LD answer text. Drops mark metadata and image blocks; keeps
// paragraph/list spacing as single spaces.
function portableToPlain(blocks: PortableTextBlock[] | undefined): string {
  if (!blocks?.length) return ''
  const parts: string[] = []
  for (const block of blocks) {
    if (!block || block._type !== 'block') continue
    const children = (block as PortableTextBlock & { children?: Array<{ text?: string }> }).children
    if (!children) continue
    parts.push(children.map((c) => c.text ?? '').join(''))
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

// Categories shown above the hardcoded methodology sections. 'lumiscore' Q&As
// in Sanity are folded into the methodology block instead (or skipped — the
// hardcoded LumiScore section is more detailed than what fits portable text).
const PARENT_INTENT_CATEGORIES = ['general', 'screen-time', 'game-safety']

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'faq' })
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return {
    title:       t('metaTitle' as any),
    description: t('metaDescription' as any),
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

// ─── Data ─────────────────────────────────────────────────────────────────────

type QA = { q: string; a: React.ReactNode }
type ResearchLink = { label: string; authors: string; url: string }
type Section = { id: string; headingKey: string; items: QA[]; research: ResearchLink[] }

const SECTIONS: Section[] = [
  {
    id: 'curascore',
    headingKey: 'sectionLumiScore',
    items: [
      {
        q: 'What is the LumiScore?',
        a: (
          <>
            The LumiScore is a single 0–100 number that summarises how well a game works for a
            developing child. It is the harmonic mean of two independent scores — the{' '}
            <strong>Benefit Density Score (BDS)</strong> and a safety score derived from the{' '}
            <strong>Risk Intensity Score (RIS)</strong>. Using the harmonic mean means a game
            can&apos;t hide a very low score on one side behind a very high score on the other.
          </>
        ),
      },
      {
        q: 'How is the LumiScore calculated?',
        a: (
          <>
            <code className="bg-ink/5 text-ink px-1.5 py-0.5 text-sm font-mono">
              LumiScore = 100 × (2 × BDS × Safety) / (BDS + Safety)
            </code>
            <br />
            <br />
            where <strong>Safety = 1 − RIS</strong>. A game with excellent developmental value
            (BDS 0.80) but very high manipulation risk (RIS 0.80, Safety 0.20) scores only 32 —
            reflecting the real tension between what the game teaches and how it keeps kids playing.
          </>
        ),
      },
      {
        q: 'What do the score ranges mean?',
        a: (
          <ul className="space-y-1.5">
            <li><span className="inline-block w-3 h-3 rounded-full bg-ivy mr-2" />
              <strong>70–100 — Recommended.</strong> Strong developmental value, low manipulation design.</li>
            <li><span className="inline-block w-3 h-3 rounded-full bg-warm mr-2" />
              <strong>40–69 — Play with awareness.</strong> Worthwhile but has notable risk factors to manage.</li>
            <li><span className="inline-block w-3 h-3 rounded-full bg-accent mr-2" />
              <strong>0–39 — Use caution.</strong> High risk relative to developmental benefit. Keep sessions short.</li>
          </ul>
        ),
      },
      {
        q: "Why isn't the ESRB rating enough?",
        a: `ESRB rates content (violence, language, sexual themes) — not design. A game can be rated E
            for Everyone and still use slot-machine reward loops, aggressive push notifications, or
            unlimited in-app purchases targeting children. The LumiScore captures those design
            decisions, which are invisible to ESRB but highly relevant to parents.`,
      },
    ],
    research: [
      {
        label: 'The Benefits of Playing Video Games',
        authors: 'Granic, Lobel & Engels — American Psychologist, APA (2014)',
        url: 'https://www.apa.org/pubs/journals/releases/amp-a0034857.pdf',
      },
      {
        label: 'Development of the SHARP-G Scale: An International Delphi Study',
        authors: 'Saini & Hodgins et al. — PMC (2024)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11220801/',
      },
      {
        label: 'Association of Video Gaming With Cognitive Performance Among Children',
        authors: 'Chaarani et al. — JAMA Network Open / PMC (2022)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9593235/',
      },
    ],
  },
  {
    id: 'bds',
    headingKey: 'sectionBds',
    items: [
      {
        q: 'What does the BDS measure?',
        a: `The BDS (0.00–1.00) reflects how much genuine developmental value a game provides across
            three categories: cognitive skills, social-emotional skills, and physical/motor skills.
            A high BDS means the game actively builds skills that transfer outside the game.`,
      },
      {
        q: 'What are the three benefit categories?',
        a: (
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-ink">B1 · Cognitive development (50% of BDS)</p>
              <p className="text-muted text-sm mt-0.5">
                Problem solving, spatial awareness, strategic thinking, critical thinking, memory,
                creativity, reading, math/systems thinking, real-world learning transfer, and
                adaptive challenge. Scored across 10 dimensions (0–5 each, max 50 points).
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink">B2 · Social &amp; emotional development (30% of BDS)</p>
              <p className="text-muted text-sm mt-0.5">
                Teamwork, communication, empathy, emotional regulation, ethical reasoning, and
                quality of social interaction. Scored across 6 dimensions (max 30 points).
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink">B3 · Physical &amp; motor development (20% of BDS)</p>
              <p className="text-muted text-sm mt-0.5">
                Hand-eye coordination, fine motor skills, reaction time, and physical activity
                (VR/motion). Scored across 4 dimensions (max 20 points).
              </p>
            </div>
          </div>
        ),
      },
      {
        q: 'Can a casual or simple game score well on BDS?',
        a: `Yes, if it genuinely develops skills. Tetris scores well on spatial awareness and
            reaction time. Stardew Valley scores well on planning and emotional regulation. A game
            doesn't need to be complex — it needs to build real skills rather than just provide
            passive stimulation.`,
      },
    ],
    research: [
      {
        label: 'The impact of digital media on children\'s intelligence',
        authors: 'Sauce et al. — Scientific Reports / Nature (2022)',
        url: 'https://www.nature.com/articles/s41598-022-11341-2',
      },
      {
        label: 'Video games as virtual teachers: prosocial use associated with empathy',
        authors: 'Prot et al. — Computers in Human Behavior (2014)',
        url: 'https://www.sciencedirect.com/science/article/abs/pii/S0747563216303892',
      },
      {
        label: 'Neural correlates of video game empathy training in adolescents',
        authors: 'Szymanski et al. — npj Science of Learning / PMC (2018)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6220300/',
      },
      {
        label: 'Game-based social-emotional learning for youth: a school-based analysis',
        authors: 'Lamb et al. — PMC (2025)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12289224/',
      },
    ],
  },
  {
    id: 'ris',
    headingKey: 'sectionRis',
    items: [
      {
        q: 'What does the RIS measure?',
        a: `The RIS (0.00–1.00) captures how aggressively a game uses design patterns that
            can manipulate behaviour — especially in developing minds. It does not measure content
            (violence, language) — that is captured separately as Content Risk.`,
      },
      {
        q: 'What are the three risk categories?',
        a: (
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-ink">R1 · Dopamine manipulation design (45% of RIS)</p>
              <p className="text-muted text-sm mt-0.5">
                Variable-ratio reward loops, streak mechanics, loss aversion, FOMO events,
                artificial stopping barriers (energy systems), re-engagement notifications,
                near-miss mechanics, infinite scroll design, escalating commitment, and
                variable reward frequency. Scored 0–3 each across 10 factors (max 30 points).
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink">R2 · Monetization pressure (30% of RIS)</p>
              <p className="text-muted text-sm mt-0.5">
                Spending ceiling, pay-to-win mechanics, currency obfuscation (gem → coin → credit),
                in-game spending prompts, child-targeting design, ad pressure, subscription pressure,
                and social spending dynamics. Scored 0–3 each across 8 factors (max 24 points).
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink">R3 · Social &amp; emotional risk (25% of RIS)</p>
              <p className="text-muted text-sm mt-0.5">
                Social obligations (guild events, daily team commitments), competitive toxicity,
                stranger interaction risk, social comparison mechanics, identity/self-worth tied
                to in-game status, and privacy risk. Scored 0–3 each across 6 factors (max 18 points).
              </p>
            </div>
          </div>
        ),
      },
      {
        q: 'What about violence, language, and other content?',
        a: `Content risk (R4) is tracked separately and is NOT included in the RIS or LumiScore.
            It covers violence level, sexual content, language, substance references, and horror
            intensity — aligned with existing ESRB/PEGI categories. We display it alongside the
            score as a parental judgment call, not a formula input. A game can be perfectly safe
            by design (low RIS) but still carry content that is inappropriate for younger children.`,
      },
      {
        q: 'Can a game have a high RIS and a high BDS at the same time?',
        a: `Yes — and this is an important nuance. Genshin Impact is a good example: it has
            genuine exploration value, team-based combat, and world-building (moderate BDS),
            but it also uses gacha mechanics, daily streaks, FOMO banners, and unlimited spending
            (high RIS). The LumiScore reflects this tension honestly. High-benefit, high-risk
            games get a special note recommending shorter sessions and a conversation with your
            child about why the game is designed the way it is.`,
      },
    ],
    research: [
      {
        label: 'Engineered highs: Reward variability as a prerequisite of behavioural addiction',
        authors: 'Newall et al. — Drug and Alcohol Dependence / PMC (2023)',
        url: 'https://www.sciencedirect.com/science/article/pii/S0306460323000217',
      },
      {
        label: 'Loot boxes, gambling, and problem gambling among young people',
        authors: 'Zendle et al. — PMC (2021)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8064953/',
      },
      {
        label: 'Prevalence and characteristics of manipulative design in apps used by children',
        authors: 'Frik et al. — JMIR mHealth / PMC (2022)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9206186/',
      },
      {
        label: 'The role of microtransactions in Internet Gaming Disorder: a systematic review',
        authors: 'Kristiansen & Severin — PMC (2022)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9006671/',
      },
    ],
  },
  {
    id: 'time',
    headingKey: 'sectionTime',
    items: [
      {
        q: 'How is the daily time recommendation calculated?',
        a: (
          <>
            The base recommendation comes from the RIS:
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-y-2 border-ink text-ink">
                    <th className="text-left px-3 py-2 text-kicker uppercase font-semibold" style={{ fontVariantCaps: 'all-small-caps' }}>RIS range</th>
                    <th className="text-left px-3 py-2 text-kicker uppercase font-semibold" style={{ fontVariantCaps: 'all-small-caps' }}>Base recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/60">
                  {[
                    ['0.00 – 0.15', 'Up to 120 min'],
                    ['0.16 – 0.30', 'Up to 90 min'],
                    ['0.31 – 0.50', 'Up to 60 min'],
                    ['0.51 – 0.70', 'Up to 30 min'],
                    ['0.71 – 1.00', '15 min or not recommended'],
                  ].map(([range, rec]) => (
                    <tr key={range}>
                      <td className="px-3 py-2 font-mono text-xs text-muted">{range}</td>
                      <td className="px-3 py-2 text-ink/80">{rec}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ),
      },
      {
        q: 'Does a high BDS change the time recommendation?',
        a: (
          <>
            Yes — but only under specific conditions:
            <ul className="mt-2 space-y-1.5 list-disc list-inside text-ink/80">
              <li>
                If <strong>BDS ≥ 0.60</strong> (substantial developmental value), the recommendation
                extends one tier — unless RIS &gt; 0.70, where high risk overrides the benefit extension.
              </li>
              <li>
                If <strong>BDS &lt; 0.20</strong> AND <strong>RIS &gt; 0.30</strong> (low value, moderate
                risk), the recommendation drops one tier.
              </li>
            </ul>
            <p className="mt-2 text-ink/80">
              This asymmetry is intentional: benefits can earn a little more time, but they
              cannot override a very high-risk design.
            </p>
          </>
        ),
      },
      {
        q: "Does the recommendation account for the child's age?",
        a: (
          <div className="space-y-1.5">
            <p>Age adjustments are applied on top of the formula-based recommendation:</p>
            <ul className="mt-2 space-y-1.5 list-disc list-inside text-ink/80">
              <li><strong>Under 6:</strong> Recommendation is halved and capped at 30 min.</li>
              <li><strong>6–9:</strong> Applied as-is.</li>
              <li><strong>10–12:</strong> As-is, with notes on where co-play is advised vs. independent.</li>
              <li><strong>13–17:</strong> Extended one tier for age-appropriate content — teens benefit from autonomy with guardrails.</li>
            </ul>
          </div>
        ),
      },
    ],
    research: [
      {
        label: 'WHO guidelines on physical activity, sedentary behaviour and sleep for children under 5',
        authors: 'World Health Organization (2019)',
        url: 'https://www.who.int/news/item/24-04-2019-to-grow-up-healthy-children-need-to-sit-less-and-play-more',
      },
      {
        label: 'AAP screen time guidelines — Center of Excellence on Social Media and Youth Mental Health',
        authors: 'American Academy of Pediatrics',
        url: 'https://www.aap.org/en/patient-care/media-and-children/center-of-excellence-on-social-media-and-youth-mental-health/qa-portal/qa-portal-library/qa-portal-library-questions/screen-time-guidelines/',
      },
      {
        label: 'Media and Young Minds',
        authors: 'AAP Council on Communications and Media — Pediatrics (2016)',
        url: 'https://publications.aap.org/pediatrics/article/138/5/e20162591/60503/Media-and-Young-Minds',
      },
    ],
  },
  {
    id: 'reviews',
    headingKey: 'sectionReviews',
    items: [
      {
        q: 'Who reviews the games?',
        a: (
          <>
            <p>
              Currently, all scores are generated by an AI model (Google Gemini Flash 2.5) working
              through the full LumiKin rubric — the same rubric documented on this page. The model
              is given structured game metadata (genre, platform, pricing, monetization flags, ESRB
              rating) and a set of calibration examples, then asked to score each of the {RUBRIC_DIMENSION_COUNT} rubric
              dimensions and write the parent narratives.
            </p>
            <p className="mt-2">
              We are not a team of clinical psychologists reviewing games by hand. We are a small
              project using a transparent, publicly documented rubric applied consistently at scale.
              The rubric methodology is grounded in peer-reviewed research (cited in each section),
              but the individual game scores reflect an AI&apos;s interpretation of that rubric —
              not a human expert&apos;s. Treat them as a structured starting point, not a clinical
              assessment.
            </p>
            <p className="mt-2">
              Human expert review is a goal for the most-played games. If you are a game developer,
              researcher, or parent who spots a meaningful scoring error, please use the feedback
              link on any game page.
            </p>
          </>
        ),
      },
      {
        q: 'What data does the AI use to score a game?',
        a: (
          <ul className="space-y-1.5 list-disc list-inside text-ink/80">
            <li>Game title, developer, publisher, description, and genre from RAWG</li>
            <li>Platform availability, ESRB/PEGI rating, Metacritic score</li>
            <li>Monetization flags: whether the game has microtransactions, loot boxes, a battle pass, or a subscription</li>
            <li>Multiplayer flags: whether stranger chat is possible and what moderation exists</li>
            <li>Price and internet requirement</li>
            <li>The full LumiKin rubric, with calibration examples (Minecraft, Fortnite, Brawl Stars)</li>
          </ul>
        ),
      },
      {
        q: 'How often are scores updated?',
        a: `Each score includes a "last reviewed" date. Scores are refreshed when a major update
            changes monetization mechanics, a new season launches, or community feedback flags a
            meaningful change. Live-service games are prioritised for more frequent re-scoring.
            Because the AI re-reads the same rubric each time, scores are consistent across runs —
            small variations (±2–3 LumiScore points) can occur between model versions.`,
      },
      {
        q: 'What if I disagree with a score?',
        a: `Every game page has a feedback link. Flagged games are re-examined, and if community
            feedback reveals a systematic rubric error it feeds into the next methodology version.
            All rubric weights and thresholds are publicly documented. If a score feels wrong,
            tell us — the rubric is designed to be transparent and correctable.`,
      },
    ],
    research: [
      {
        label: 'Development of the SHARP-G Scale (the framework our rubric extends)',
        authors: 'Saini & Hodgins et al. — PMC (2024)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11220801/',
      },
      {
        label: 'Adolescents and loot boxes: links with problem gambling and motivations for purchase',
        authors: 'Zendle et al. — Royal Society Open Science / PMC (2019)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6599795/',
      },
      {
        label: 'Understanding the interplay between video game design features and dysregulated gaming',
        authors: 'King et al. — PMC (2025)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12033933/',
      },
    ],
  },
  {
    id: 'context',
    headingKey: 'sectionContext',
    items: [
      {
        q: 'What is the Representation score?',
        a: (
          <>
            <p>
              Each game is assessed on two representation dimensions — <strong>gender balance</strong> and{' '}
              <strong>ethnic &amp; cultural diversity</strong> — scored 0–3 each, where higher is better.
              This is purely informational: it tells you something about the world the game presents,
              not about how risky the game is. Neither dimension affects the LumiScore or time
              recommendation.
            </p>
            <p className="mt-2">
              A score of 0 means characters are all one gender or ethnicity, or rely heavily on
              stereotypes. A 3 means the game features authentic, diverse representation across both
              dimensions. Historical games set in genuinely homogeneous contexts are not penalised —
              context matters.
            </p>
          </>
        ),
      },
      {
        q: 'What is the Ideological content flag?',
        a: (
          <>
            <p>
              Some games carry a political, nationalist, or religious perspective that parents may
              want to know about before their child plays. The propaganda/ideology level is scored
              0–3:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-ink/80">
              <li><strong>0 — Neutral.</strong> No discernible ideological framing (most puzzle, sports, sandbox games).</li>
              <li><strong>1 — Mild.</strong> Common in historical games with a national perspective. Unlikely to concern most parents.</li>
              <li><strong>2 — Notable.</strong> Clear political, nationalist, or religious lens. Worth a conversation.</li>
              <li><strong>3 — Heavy.</strong> Game is primarily a vehicle for ideology or factually distorted content.</li>
            </ul>
            <p className="mt-2">
              This field does not affect the time recommendation or LumiScore. Where level ≥ 1,
              a short note explains what type of content and where it appears.
            </p>
          </>
        ),
      },
      {
        q: 'Does LumiKin cover VR games?',
        a: `Yes. VR games are included in the catalogue alongside standard titles. The rubric
            handles VR natively — B3.4 (Physical activity) scores highly for motion-based games
            like Beat Saber, Ring Fit Adventure, and Superhot VR, which is one reason those games
            often receive extended time recommendations. VR-specific risks (motion sickness,
            immersion intensity) are captured through the standard content and design risk fields
            rather than a separate VR category.`,
      },
    ],
    research: [
      {
        label: 'Representation of gender in video games: A content analysis',
        authors: 'Downs & Smith — Sex Roles (2010)',
        url: 'https://link.springer.com/article/10.1007/s11199-009-9609-x',
      },
      {
        label: 'Race and ethnicity in video games: a review of research',
        authors: 'Williams et al. — New Media & Society (2009)',
        url: 'https://journals.sagepub.com/doi/10.1177/1461444809105354',
      },
      {
        label: 'VR in children: physical activity, cognition, and safety — a systematic review',
        authors: 'Gao et al. — PMC (2023)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10522390/',
      },
    ],
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'faq' })

  // Fetch parent-intent Q&As authored in Sanity Studio. Empty array when none
  // are published yet — the section just doesn't render. EN-only filter
  // happens via the query's $locale parameter (faqsQuery in queries.ts).
  const sanityFaqs: SanityFaqItem[] =
    (await sanityClient?.fetch(faqsQuery, { locale }).catch(() => null)) ?? []
  const parentIntentFaqs = sanityFaqs.filter(
    (f) => f.category && PARENT_INTENT_CATEGORIES.includes(f.category),
  )

  // FAQPage JSON-LD: combine Sanity Q&As + the methodology Q&As that have
  // plain-string answers (the React-bodied ones can't safely flatten to text).
  const hardcodedTextEntries: Array<{ q: string; a: string }> = []
  for (const section of SECTIONS) {
    for (const item of section.items) {
      if (typeof item.a === 'string') {
        hardcodedTextEntries.push({
          q: item.q,
          a: item.a.replace(/\s+/g, ' ').trim(),
        })
      }
    }
  }

  const faqLdEntries = [
    ...parentIntentFaqs.map((f) => ({
      q: f.question,
      a: portableToPlain(f.answer).slice(0, 800),
    })),
    ...hardcodedTextEntries,
  ].filter((e) => e.a.length > 20)

  const faqLd = faqLdEntries.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqLdEntries.map((e) => ({
          '@type': 'Question',
          name: e.q,
          acceptedAnswer: { '@type': 'Answer', text: e.a },
        })),
      }
    : null

  return (
    <div className="min-h-screen bg-paper text-ink">
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqLd)
              .replace(/</g, '\\u003c')
              .replace(/>/g, '\\u003e')
              .replace(/&/g, '\\u0026'),
          }}
        />
      )}
      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10 border-b border-ink pb-6">
          <p
            className="text-kicker uppercase font-semibold text-accent mb-2"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('methodology')}
          </p>
          <h1 className="font-serif text-display-sm md:text-display text-ink mb-3">{t('title')}</h1>
          <p className="font-serif italic text-muted text-lg leading-relaxed">
            {t('subtitle')}
          </p>

          {/* Jump links */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-6">
            {SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-kicker uppercase font-semibold text-ink hover:text-accent transition-colors"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {t(s.headingKey as Parameters<typeof t>[0])}
              </a>
            ))}
          </div>
        </div>

        {/* Parent-intent Q&As (Sanity-authored) */}
        {parentIntentFaqs.length > 0 && (
          <section id="parents-ask" className="mb-12">
            <h2 className="font-serif text-xl text-ink mb-5 pb-2 border-b border-ink">
              {t('parentsAskHeading')}
            </h2>
            <div className="divide-y divide-rule/60">
              {parentIntentFaqs.map((f) => (
                <details key={f._id} className="group py-4 open:pb-5">
                  <summary className="flex items-start justify-between gap-4 cursor-pointer list-none">
                    <span className="font-serif text-ink group-open:text-accent transition-colors">
                      {f.question}
                    </span>
                    <span className="shrink-0 mt-0.5 text-muted group-open:rotate-45 transition-transform text-lg leading-none">
                      +
                    </span>
                  </summary>
                  <div className="mt-3 text-ink/80 leading-relaxed text-sm">
                    <PortableTextRenderer value={f.answer} />
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Sections */}
        <div className="space-y-12">
          {SECTIONS.map(section => (
            <section key={section.id} id={section.id}>
              <h2 className="font-serif text-xl text-ink mb-5 pb-2 border-b border-ink">
                {t(section.headingKey as Parameters<typeof t>[0])}
              </h2>

              {/* Q&A accordion */}
              <div className="divide-y divide-rule/60">
                {section.items.map(item => (
                  <details key={item.q} className="group py-4 open:pb-5">
                    <summary className="flex items-start justify-between gap-4 cursor-pointer list-none">
                      <span className="font-serif text-ink group-open:text-accent transition-colors">
                        {item.q}
                      </span>
                      <span className="shrink-0 mt-0.5 text-muted group-open:rotate-45 transition-transform text-lg leading-none">
                        +
                      </span>
                    </summary>
                    <div className="mt-3 text-ink/80 leading-relaxed text-sm">
                      {item.a}
                    </div>
                  </details>
                ))}
              </div>

              {/* Research links */}
              <div className="mt-5 pt-4 border-t border-dashed border-rule">
                <p
                  className="text-kicker uppercase font-semibold text-muted mb-3"
                  style={{ fontVariantCaps: 'all-small-caps' }}
                >
                  {t('research')}
                </p>
                <ul className="space-y-2">
                  {section.research.map(r => (
                    <li key={r.url} className="flex items-start gap-2">
                      <span className="text-accent mt-0.5 shrink-0">↗</span>
                      <span className="text-sm">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline font-medium"
                        >
                          {r.label}
                        </a>
                        <span className="text-muted ml-1.5">{r.authors}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-14 border-2 border-ink p-8 text-center">
          <p
            className="text-kicker uppercase font-semibold text-accent mb-2"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {t('readyToFind')}
          </p>
          <p className="font-serif italic text-ink/80 text-lg mb-5">
            {t('readyToFindSub')}
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href={`/${locale}/browse`}
              className="px-5 py-2 bg-ink text-paper text-kicker uppercase font-semibold hover:bg-accent transition-colors"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {t('browseGames')}
            </Link>
            <Link
              href={`/${locale}/discover`}
              className="px-5 py-2 text-ink text-kicker uppercase font-semibold border border-rule hover:border-ink hover:text-accent transition-colors"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              {t('getRecommendations')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
