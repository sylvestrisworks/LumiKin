/**
 * GET /api/cron/fetch-fortnite-maps
 *
 * Upserts curated Fortnite Creative map metadata into platform_experiences,
 * then seeds experience_scores for each map.
 *
 * To add a new map:
 *   1. Find the island code in-game or on fortnite.gg
 *   2. Add an entry to CURATED_MAPS below (with scores)
 *   3. The next cron run (or a manual trigger) will insert it
 *
 * Runs every 24h via GitHub Actions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformExperiences, games, experienceScores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const maxDuration = 60

// ─── Types ────────────────────────────────────────────────────────────────────

type MapScores = {
  curascore:                 number
  dopamineTrapScore:         number  // 0-3
  toxicityScore:             number  // 0-3
  ugcContentRisk:            number  // 0-3
  strangerRisk:              number  // 0-3
  monetizationScore:         number  // 0-3
  privacyRisk:               number  // 0-3
  creativityScore:           number  // 0-3
  socialScore:               number  // 0-3
  learningScore:             number  // 0-3
  riskScore:                 number  // 0-1 composite
  benefitScore:              number  // 0-1 composite
  timeRecommendationMinutes: number
  timeRecommendationLabel:   string
  timeRecommendationColor:   string  // green | amber | red
  recommendedMinAge:         number
  summary:                   string
  benefitsNarrative:         string
  risksNarrative:            string
  parentTip:                 string
}

type CuratedMap = {
  code:         string
  title:        string
  description:  string | null
  creatorName:  string | null
  genre:        string | null
  thumbnailUrl: string | null
  scores:       MapScores
}

// ─── Curated map list ─────────────────────────────────────────────────────────

const CURATED_MAPS: CuratedMap[] = [
  {
    code:         '2778-3253-4171',
    title:        'Cizzorz Deathrun 4.0',
    description:  'A punishing obstacle course with 30 increasingly difficult levels. Requires precise movement and patience — no combat, pure skill.',
    creatorName:  'Cizzorz',
    genre:        'Deathrun',
    thumbnailUrl: 'https://img2.fortnitemaps.com/2778-3253-4171_1.jpg',
    scores: {
      curascore:                 75,
      dopamineTrapScore:         1,
      toxicityScore:             0,
      ugcContentRisk:            0,
      strangerRisk:              0,
      monetizationScore:         0,
      privacyRisk:               0,
      creativityScore:           0,
      socialScore:               0,
      learningScore:             3,
      riskScore:                 0.08,
      benefitScore:              0.60,
      timeRecommendationMinutes: 60,
      timeRecommendationLabel:   '60 min / day',
      timeRecommendationColor:   'green',
      recommendedMinAge:         8,
      summary:                   'A solo obstacle course that rewards persistence and spatial reasoning. No violence, no chat, no spending — just skill.',
      benefitsNarrative:         'Cizzorz Deathrun 4.0 is one of the best-designed skill maps in Fortnite Creative. Its 30 escalating levels teach children to analyse failure, retry with adjusted strategy, and maintain focus under pressure — all without a single opponent or dollar spent.',
      risksNarrative:            'The extreme difficulty can create frustration loops for younger or less patient players. There is no chat, no strangers, and no monetization, so risk is minimal.',
      parentTip:                 'If your child rages at a hard level, encourage them to take a break and come back. Completing even five levels is a genuine achievement worth recognizing.',
    },
  },
  {
    code:         '7813-7316-9735',
    title:        '100 Level Default Deathrun',
    description:  'One hundred progressively harder obstacle levels using default Fortnite assets. A popular starting point for players new to deathrun maps.',
    creatorName:  null,
    genre:        'Deathrun',
    thumbnailUrl: 'https://img2.fortnitemaps.com/7813-7316-9735_1.jpg',
    scores: {
      curascore:                 70,
      dopamineTrapScore:         1,
      toxicityScore:             0,
      ugcContentRisk:            0,
      strangerRisk:              0,
      monetizationScore:         0,
      privacyRisk:               0,
      creativityScore:           0,
      socialScore:               0,
      learningScore:             2,
      riskScore:                 0.08,
      benefitScore:              0.45,
      timeRecommendationMinutes: 60,
      timeRecommendationLabel:   '60 min / day',
      timeRecommendationColor:   'green',
      recommendedMinAge:         8,
      summary:                   'A gentle introduction to deathrun maps. Familiar assets keep it accessible while the 100-level format gives a satisfying sense of progress.',
      benefitsNarrative:         'The sheer length of this map encourages sustained focus and incremental progress. Using default Fortnite assets removes visual chaos, making it easier for younger players to read the environment and plan their jumps.',
      risksNarrative:            'Minimal. The extreme length can occasionally feel monotonous, and later levels may cause frustration for younger players. No social features, spending, or inappropriate content.',
      parentTip:                 'This is a great first deathrun for children new to Fortnite. Let them set their own level targets rather than pushing to complete all 100 in one session.',
    },
  },
  {
    code:         '3936-5272-9537',
    title:        'The Pit (Zone Wars)',
    description:  'A fast-paced Zone Wars map where a shrinking storm forces constant close-range combat. Builds competitive build and edit skills.',
    creatorName:  'Enigma',
    genre:        'Zone Wars',
    thumbnailUrl: 'https://img2.fortnitemaps.com/3936-5272-9537_1.jpg',
    scores: {
      curascore:                 62,
      dopamineTrapScore:         2,
      toxicityScore:             2,
      ugcContentRisk:            0,
      strangerRisk:              1,
      monetizationScore:         0,
      privacyRisk:               0,
      creativityScore:           1,
      socialScore:               1,
      learningScore:             3,
      riskScore:                 0.37,
      benefitScore:              0.58,
      timeRecommendationMinutes: 30,
      timeRecommendationLabel:   '30 min / day',
      timeRecommendationColor:   'amber',
      recommendedMinAge:         12,
      summary:                   'A high-intensity competitive mode that sharpens Fortnite mechanics fast. Best suited to older children who handle competitive losses well.',
      benefitsNarrative:         'Zone Wars is one of the fastest ways to develop genuine Fortnite skills — quick decision-making, building under pressure, and reading opponents. Players who want to improve at the main game often use The Pit as a dedicated training ground.',
      risksNarrative:            'The high-speed competitive format can amplify frustration and bring out toxic chat behaviour from other players. Younger or more sensitive players may find the intensity overwhelming or discouraging.',
      parentTip:                 'Check whether voice chat is enabled and consider turning it off for under-13s. Brief daily sessions (30 min) will improve skills without the burnout that longer grinding sessions can cause.',
    },
  },
  {
    code:         '6562-8953-6567',
    title:        'Pandvil Box Fight',
    description:  'A close-quarters box fighting practice map. Players spawn in small enclosed structures and fight for control — heavy emphasis on editing speed.',
    creatorName:  'Pandvil',
    genre:        'Box Fight',
    thumbnailUrl: 'https://assets.fortnitecreativehq.com/wp-content/uploads/2024/08/09061018/landscape_comp-1961-370x208.jpeg',
    scores: {
      curascore:                 60,
      dopamineTrapScore:         2,
      toxicityScore:             2,
      ugcContentRisk:            0,
      strangerRisk:              1,
      monetizationScore:         0,
      privacyRisk:               0,
      creativityScore:           1,
      socialScore:               1,
      learningScore:             3,
      riskScore:                 0.38,
      benefitScore:              0.55,
      timeRecommendationMinutes: 30,
      timeRecommendationLabel:   '30 min / day',
      timeRecommendationColor:   'amber',
      recommendedMinAge:         12,
      summary:                   'An intense 1v1 mechanics trainer. Excellent for skill development, but the highly competitive format is best suited to older players with resilient attitudes toward losing.',
      benefitsNarrative:         'Box fighting is a core Fortnite skill, and Pandvil\'s map is among the cleanest implementations. Regular practice measurably improves editing speed, spatial awareness, and combat decision-making.',
      risksNarrative:            'Repeated 1v1 losses with strangers can be demoralising. The intensity of the format makes it prone to heated reactions and poor sportsmanship. Younger players should play with friends rather than randoms.',
      parentTip:                 'Ask your child to play with friends they know rather than random matchmaking. Framing practice sessions around personal improvement ("beat your edit speed from yesterday") reduces the frustration of losses.',
    },
  },
  {
    code:         '6631-1688-2734',
    title:        'Prop Hunt',
    description:  'Hide and seek with a twist — one team disguises as objects while the other hunts them down. Lighthearted, low-violence, and great for groups.',
    creatorName:  null,
    genre:        'Party',
    thumbnailUrl: 'https://img2.fortnitemaps.com/6631-1688-2734_1.jpg',
    scores: {
      curascore:                 74,
      dopamineTrapScore:         1,
      toxicityScore:             1,
      ugcContentRisk:            0,
      strangerRisk:              2,
      monetizationScore:         0,
      privacyRisk:               0,
      creativityScore:           1,
      socialScore:               3,
      learningScore:             1,
      riskScore:                 0.25,
      benefitScore:              0.65,
      timeRecommendationMinutes: 60,
      timeRecommendationLabel:   '60 min / day',
      timeRecommendationColor:   'green',
      recommendedMinAge:         9,
      summary:                   'A lighthearted hide-and-seek mode with minimal violence and strong social appeal. An excellent choice for playing with friends or siblings.',
      benefitsNarrative:         'Prop Hunt develops creative problem-solving (choosing the right object to hide as), observational skills, and social play. Playing with familiar friends makes it one of the most genuinely fun cooperative experiences in Fortnite Creative.',
      risksNarrative:            'Voice chat with strangers carries the standard risks for this age group. The mode itself has no combat rewards, minimal frustration loops, and no spending pressure.',
      parentTip:                 'This is an ideal mode for playing together as a family. Join a session with your child to get a feel for the community, then let them play with their own friends.',
    },
  },
  {
    code:         '0726-3548-3933',
    title:        'Murder Mystery',
    description:  'A social deduction map where one hidden murderer hunts down innocents. Players must identify the killer before time runs out.',
    creatorName:  null,
    genre:        'Party',
    thumbnailUrl: 'https://img2.fortnitemaps.com/0726-3548-3933_1.jpg',
    scores: {
      curascore:                 65,
      dopamineTrapScore:         2,
      toxicityScore:             1,
      ugcContentRisk:            0,
      strangerRisk:              2,
      monetizationScore:         0,
      privacyRisk:               0,
      creativityScore:           1,
      socialScore:               3,
      learningScore:             2,
      riskScore:                 0.30,
      benefitScore:              0.60,
      timeRecommendationMinutes: 60,
      timeRecommendationLabel:   '60 min / day',
      timeRecommendationColor:   'amber',
      recommendedMinAge:         10,
      summary:                   'A social deduction game that encourages logical thinking and reading people. The murder theme is cartoonish, but stranger interaction warrants a look for younger players.',
      benefitsNarrative:         'Murder Mystery builds deductive reasoning, communication skills, and the ability to bluff or detect deception — skills that transfer to board games, maths logic puzzles, and social situations. The cooperative pressure-cooker moment when the detective calls out the murderer creates genuine shared excitement.',
      risksNarrative:            'The game\'s theme involves cartoonish killing, which is low-risk for most children over 10 but worth previewing for sensitive younger players. Voice chat with strangers adds the standard unsupervised social risk.',
      parentTip:                 'Watch one round to gauge the community on the server your child joins. Playing with a pre-made group of known friends eliminates most of the stranger interaction risk.',
    },
  },
  {
    code:         '6006-1872-8972',
    title:        'Strucid',
    description:  'A third-person build-battle arena inspired by Roblox Strucid. Players build towers and fight from the high ground — great for practicing construction mechanics.',
    creatorName:  null,
    genre:        'Build Battle',
    thumbnailUrl: 'https://img2.fortnitemaps.com/6006-1872-8972_1.jpg',
    scores: {
      curascore:                 61,
      dopamineTrapScore:         2,
      toxicityScore:             2,
      ugcContentRisk:            0,
      strangerRisk:              1,
      monetizationScore:         0,
      privacyRisk:               0,
      creativityScore:           2,
      socialScore:               1,
      learningScore:             2,
      riskScore:                 0.37,
      benefitScore:              0.50,
      timeRecommendationMinutes: 30,
      timeRecommendationLabel:   '30 min / day',
      timeRecommendationColor:   'amber',
      recommendedMinAge:         12,
      summary:                   'A competitive build-battle mode that develops construction and combat skills simultaneously. Intensity suits older players comfortable with competitive losses.',
      benefitsNarrative:         'Strucid demands fast thinking about both building and fighting at once — a genuine dual-track cognitive workout. Players develop spatial reasoning, resource management instincts, and quick tactical decision-making.',
      risksNarrative:            'Competitive build battles can frustrate younger players who feel outclassed. The format is fast-paced and loss-heavy for beginners, which can erode confidence if sessions run too long.',
      parentTip:                 'Best in short bursts. Encourage your child to focus on one improvement goal per session ("build to high ground in every fight") rather than winning or losing overall.',
    },
  },
  {
    code:         '4044-8022-1843',
    title:        'The Dropper',
    description:  'Players free-fall through increasingly complex obstacle courses and must land safely at the bottom. No combat — pure spatial awareness and timing.',
    creatorName:  null,
    genre:        'Dropper',
    thumbnailUrl: 'https://img2.fortnitemaps.com/4044-8022-1843_1.jpg',
    scores: {
      curascore:                 73,
      dopamineTrapScore:         1,
      toxicityScore:             0,
      ugcContentRisk:            0,
      strangerRisk:              1,
      monetizationScore:         0,
      privacyRisk:               0,
      creativityScore:           0,
      socialScore:               1,
      learningScore:             2,
      riskScore:                 0.12,
      benefitScore:              0.50,
      timeRecommendationMinutes: 60,
      timeRecommendationLabel:   '60 min / day',
      timeRecommendationColor:   'green',
      recommendedMinAge:         8,
      summary:                   'A relaxed reflex and timing challenge with no combat or spending. A great cool-down game after more intense sessions.',
      benefitsNarrative:         'The Dropper trains spatial awareness, reaction timing, and calm focus under visual complexity. Because it resets quickly on failure, it teaches resilience without the sting of losing to another player.',
      risksNarrative:            'Very low risk overall. Repeated failures on hard levels may frustrate younger players, but the absence of opponents, chat, or spending keeps the environment clean and calm.',
      parentTip:                 'This is a great "wind-down" game for the last few minutes of screen time. The lack of competition makes it easy to stop at a natural breaking point.',
    },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 255)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    return await handler()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[fetch-fortnite] Unhandled error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handler(): Promise<NextResponse> {
  const [fortnitePlatform] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, 'fortnite-creative'))
    .limit(1)

  if (!fortnitePlatform) {
    return NextResponse.json({
      error: 'fortnite-creative platform row not found. Run: npx tsx scripts/seed-fortnite.ts',
    }, { status: 500 })
  }

  const existing = await db
    .select({ id: platformExperiences.id, placeId: platformExperiences.placeId, title: platformExperiences.title, description: platformExperiences.description })
    .from(platformExperiences)
    .where(eq(platformExperiences.platformId, fortnitePlatform.id))

  const existingByCode = new Map(existing.map(e => [e.placeId, e]))
  const inserted:  string[] = []
  const refreshed: string[] = []
  const scored:    string[] = []

  for (const map of CURATED_MAPS) {
    const existing_ = existingByCode.get(map.code)
    let experienceId: number

    if (existing_) {
      const contentChanged = existing_.title !== map.title || existing_.description !== (map.description ?? null)
      await db.update(platformExperiences).set({
        title:        map.title,
        description:  map.description,
        creatorName:  map.creatorName,
        thumbnailUrl: map.thumbnailUrl,
        genre:        map.genre,
        ...(contentChanged ? { needsRescore: true } : {}),
        updatedAt:    new Date(),
      }).where(eq(platformExperiences.id, existing_.id))

      experienceId = existing_.id
      refreshed.push(map.title)
    } else {
      let slug = slugify(map.title)
      const [collision] = await db
        .select({ id: platformExperiences.id })
        .from(platformExperiences)
        .where(eq(platformExperiences.slug, slug))
        .limit(1)
      if (collision) slug = `${slug}-${map.code.replace(/-/g, '').slice(0, 8)}`

      const [inserted_] = await db.insert(platformExperiences).values({
        slug,
        platformId:    fortnitePlatform.id,
        placeId:       map.code,
        universeId:    null,
        title:         map.title,
        description:   map.description,
        creatorName:   map.creatorName,
        thumbnailUrl:  map.thumbnailUrl,
        genre:         map.genre,
        isPublic:      true,
        lastFetchedAt: new Date(),
      }).returning({ id: platformExperiences.id })

      experienceId = inserted_.id
      inserted.push(map.title)
      console.log(`[fetch-fortnite] Inserted: ${map.title} (${map.code})`)
    }

    // Upsert experience_scores
    const s = map.scores
    await db.insert(experienceScores).values({
      experienceId,
      curascore:                 s.curascore,
      dopamineTrapScore:         s.dopamineTrapScore,
      toxicityScore:             s.toxicityScore,
      ugcContentRisk:            s.ugcContentRisk,
      strangerRisk:              s.strangerRisk,
      monetizationScore:         s.monetizationScore,
      privacyRisk:               s.privacyRisk,
      creativityScore:           s.creativityScore,
      socialScore:               s.socialScore,
      learningScore:             s.learningScore,
      riskScore:                 s.riskScore,
      benefitScore:              s.benefitScore,
      timeRecommendationMinutes: s.timeRecommendationMinutes,
      timeRecommendationLabel:   s.timeRecommendationLabel,
      timeRecommendationColor:   s.timeRecommendationColor,
      recommendedMinAge:         s.recommendedMinAge,
      summary:                   s.summary,
      benefitsNarrative:         s.benefitsNarrative,
      risksNarrative:            s.risksNarrative,
      parentTip:                 s.parentTip,
      calculatedAt:              new Date(),
      updatedAt:                 new Date(),
    }).onConflictDoUpdate({
      target: experienceScores.experienceId,
      set: {
        curascore:                 s.curascore,
        dopamineTrapScore:         s.dopamineTrapScore,
        toxicityScore:             s.toxicityScore,
        ugcContentRisk:            s.ugcContentRisk,
        strangerRisk:              s.strangerRisk,
        monetizationScore:         s.monetizationScore,
        privacyRisk:               s.privacyRisk,
        creativityScore:           s.creativityScore,
        socialScore:               s.socialScore,
        learningScore:             s.learningScore,
        riskScore:                 s.riskScore,
        benefitScore:              s.benefitScore,
        timeRecommendationMinutes: s.timeRecommendationMinutes,
        timeRecommendationLabel:   s.timeRecommendationLabel,
        timeRecommendationColor:   s.timeRecommendationColor,
        recommendedMinAge:         s.recommendedMinAge,
        summary:                   s.summary,
        benefitsNarrative:         s.benefitsNarrative,
        risksNarrative:            s.risksNarrative,
        parentTip:                 s.parentTip,
        updatedAt:                 new Date(),
      },
    })
    scored.push(map.title)
  }

  return NextResponse.json({ ok: true, inserted: inserted.length, refreshed: refreshed.length, scored: scored.length, insertedMaps: inserted })
}
