/**
 * GET /api/cron/fetch-fortnite-maps
 *
 * Upserts curated Fortnite Creative map metadata into platform_experiences,
 * then seeds experience_scores for each map. Derived scores (RIS, BDS,
 * curascore, time recommendation) are computed from the raw 0–3 dimension
 * inputs at upsert time using the live scoring engine — they are never
 * hardcoded and will automatically reflect any formula changes.
 *
 * To add a new map:
 *   1. Find the island code in-game or on fortnite.gg
 *   2. Add an entry to CURATED_MAPS below with the 0–3 dimension scores
 *   3. The next cron run (or a manual trigger) will insert and score it
 *
 * Runs daily via Vercel cron.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformExperiences, games, experienceScores } from '@/lib/db/schema'
import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { logCronRun } from '@/lib/cron-logger'
import { calculateExperienceRisk, calculateExperienceBenefits } from '@/lib/scoring/experience-risk'
import { deriveTimeRecommendation } from '@/lib/scoring/time'
import { CURRENT_METHODOLOGY_VERSION } from '@/lib/methodology'

export const maxDuration = 60

// ─── Types ────────────────────────────────────────────────────────────────────

type MapScores = {
  // Raw 0–3 dimension inputs (AI/human evaluated per map)
  dopamineTrapScore: number
  toxicityScore:     number
  ugcContentRisk:    number
  strangerRisk:      number
  monetizationScore: number
  privacyRisk:       number
  creativityScore:   number
  socialScore:       number
  learningScore:     number
  // Display/narrative fields
  recommendedMinAge: number
  summary:           string
  benefitsNarrative: string
  risksNarrative:    string
  parentTip:         string
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
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      0,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       0,
      learningScore:     3,
      recommendedMinAge: 8,
      summary:           'A solo obstacle course that rewards persistence and spatial reasoning. No violence, no chat, no spending — just skill.',
      benefitsNarrative: 'Cizzorz Deathrun 4.0 is one of the best-designed skill maps in Fortnite Creative. Its 30 escalating levels teach children to analyse failure, retry with adjusted strategy, and maintain focus under pressure — all without a single opponent or dollar spent.',
      risksNarrative:    'The extreme difficulty can create frustration loops for younger or less patient players. There is no chat, no strangers, and no monetization, so risk is minimal.',
      parentTip:         'If your child rages at a hard level, encourage them to take a break and come back. Completing even five levels is a genuine achievement worth recognizing.',
    },
  },
  {
    code:         '7813-7316-9735',
    title:        '100 Level Default Deathrun',
    description:  'One hundred progressively harder obstacle levels using default Fortnite assets. A popular starting point for players new to deathrun maps.',
    creatorName:  null,
    genre:        'Deathrun',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      0,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       0,
      learningScore:     2,
      recommendedMinAge: 8,
      summary:           'A gentle introduction to deathrun maps. Familiar assets keep it accessible while the 100-level format gives a satisfying sense of progress.',
      benefitsNarrative: 'The sheer length of this map encourages sustained focus and incremental progress. Using default Fortnite assets removes visual chaos, making it easier for younger players to read the environment and plan their jumps.',
      risksNarrative:    'Minimal. The extreme length can occasionally feel monotonous, and later levels may cause frustration for younger players. No social features, spending, or inappropriate content.',
      parentTip:         'This is a great first deathrun for children new to Fortnite. Let them set their own level targets rather than pushing to complete all 100 in one session.',
    },
  },
  {
    code:         '3936-5272-9537',
    title:        'The Pit (Zone Wars)',
    description:  'A fast-paced Zone Wars map where a shrinking storm forces constant close-range combat. Builds competitive build and edit skills.',
    creatorName:  'Enigma',
    genre:        'Zone Wars',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     2,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       1,
      learningScore:     3,
      recommendedMinAge: 12,
      summary:           'A high-intensity competitive mode that sharpens Fortnite mechanics fast. Best suited to older children who handle competitive losses well.',
      benefitsNarrative: 'Zone Wars is one of the fastest ways to develop genuine Fortnite skills — quick decision-making, building under pressure, and reading opponents. Players who want to improve at the main game often use The Pit as a dedicated training ground.',
      risksNarrative:    'The high-speed competitive format can amplify frustration and bring out toxic chat behaviour from other players. Younger or more sensitive players may find the intensity overwhelming or discouraging.',
      parentTip:         'Check whether voice chat is enabled and consider turning it off for under-13s. Brief daily sessions (30 min) will improve skills without the burnout that longer grinding sessions can cause.',
    },
  },
  {
    code:         '6562-8953-6567',
    title:        'Pandvil Box Fight',
    description:  'A close-quarters box fighting practice map. Players spawn in small enclosed structures and fight for control — heavy emphasis on editing speed.',
    creatorName:  'Pandvil',
    genre:        'Box Fight',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     2,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       1,
      learningScore:     3,
      recommendedMinAge: 12,
      summary:           'An intense 1v1 mechanics trainer. Excellent for skill development, but the highly competitive format is best suited to older players with resilient attitudes toward losing.',
      benefitsNarrative: "Box fighting is a core Fortnite skill, and Pandvil's map is among the cleanest implementations. Regular practice measurably improves editing speed, spatial awareness, and combat decision-making.",
      risksNarrative:    'Repeated 1v1 losses with strangers can be demoralising. The intensity of the format makes it prone to heated reactions and poor sportsmanship. Younger players should play with friends rather than randoms.',
      parentTip:         'Ask your child to play with friends they know rather than random matchmaking. Framing practice sessions around personal improvement ("beat your edit speed from yesterday") reduces the frustration of losses.',
    },
  },
  {
    code:         '6631-1688-2734',
    title:        'Prop Hunt',
    description:  'Hide and seek with a twist — one team disguises as objects while the other hunts them down. Lighthearted, low-violence, and great for groups.',
    creatorName:  null,
    genre:        'Party',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     1,
      ugcContentRisk:    0,
      strangerRisk:      2,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       3,
      learningScore:     1,
      recommendedMinAge: 9,
      summary:           'A lighthearted hide-and-seek mode with minimal violence and strong social appeal. An excellent choice for playing with friends or siblings.',
      benefitsNarrative: 'Prop Hunt develops creative problem-solving (choosing the right object to hide as), observational skills, and social play. Playing with familiar friends makes it one of the most genuinely fun cooperative experiences in Fortnite Creative.',
      risksNarrative:    'Voice chat with strangers carries the standard risks for this age group. The mode itself has no combat rewards, minimal frustration loops, and no spending pressure.',
      parentTip:         'This is an ideal mode for playing together as a family. Join a session with your child to get a feel for the community, then let them play with their own friends.',
    },
  },
  {
    code:         '0726-3548-3933',
    title:        'Murder Mystery',
    description:  'A social deduction map where one hidden murderer hunts down innocents. Players must identify the killer before time runs out.',
    creatorName:  null,
    genre:        'Party',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     1,
      ugcContentRisk:    0,
      strangerRisk:      2,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       3,
      learningScore:     2,
      recommendedMinAge: 10,
      summary:           'A social deduction game that encourages logical thinking and reading people. The murder theme is cartoonish, but stranger interaction warrants a look for younger players.',
      benefitsNarrative: "Murder Mystery builds deductive reasoning, communication skills, and the ability to bluff or detect deception — skills that transfer to board games, maths logic puzzles, and social situations. The cooperative pressure-cooker moment when the detective calls out the murderer creates genuine shared excitement.",
      risksNarrative:    "The game's theme involves cartoonish killing, which is low-risk for most children over 10 but worth previewing for sensitive younger players. Voice chat with strangers adds the standard unsupervised social risk.",
      parentTip:         'Watch one round to gauge the community on the server your child joins. Playing with a pre-made group of known friends eliminates most of the stranger interaction risk.',
    },
  },
  {
    code:         '6006-1872-8972',
    title:        'Strucid',
    description:  'A third-person build-battle arena inspired by Roblox Strucid. Players build towers and fight from the high ground — great for practicing construction mechanics.',
    creatorName:  null,
    genre:        'Build Battle',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     2,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   2,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 12,
      summary:           'A competitive build-battle mode that develops construction and combat skills simultaneously. Intensity suits older players comfortable with competitive losses.',
      benefitsNarrative: 'Strucid demands fast thinking about both building and fighting at once — a genuine dual-track cognitive workout. Players develop spatial reasoning, resource management instincts, and quick tactical decision-making.',
      risksNarrative:    'Competitive build battles can frustrate younger players who feel outclassed. The format is fast-paced and loss-heavy for beginners, which can erode confidence if sessions run too long.',
      parentTip:         'Best in short bursts. Encourage your child to focus on one improvement goal per session ("build to high ground in every fight") rather than winning or losing overall.',
    },
  },
  {
    code:         '4044-8022-1843',
    title:        'The Dropper',
    description:  'Players free-fall through increasingly complex obstacle courses and must land safely at the bottom. No combat — pure spatial awareness and timing.',
    creatorName:  null,
    genre:        'Dropper',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 8,
      summary:           'A relaxed reflex and timing challenge with no combat or spending. A great cool-down game after more intense sessions.',
      benefitsNarrative: 'The Dropper trains spatial awareness, reaction timing, and calm focus under visual complexity. Because it resets quickly on failure, it teaches resilience without the sting of losing to another player.',
      risksNarrative:    'Very low risk overall. Repeated failures on hard levels may frustrate younger players, but the absence of opponents, chat, or spending keeps the environment clean and calm.',
      parentTip:         'This is a great "wind-down" game for the last few minutes of screen time. The lack of competition makes it easy to stop at a natural breaking point.',
    },
  },

  // ── Aim & Edit Training ───────────────────────────────────────────────────

  {
    code:         '7775-0535-4528',
    title:        "Raider's Edit Course",
    description:  'One of the most-played edit training maps in Fortnite Creative. Progressive edit challenges across multiple courses — from beginner flicks to advanced 90s. Pure skill, no combat.',
    creatorName:  'Raider464',
    genre:        'Edit Course',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      0,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       0,
      learningScore:     3,
      recommendedMinAge: 8,
      summary:           'The gold standard edit training map. No strangers, no spending, no violence — just repetitive skill practice that directly improves hand-eye coordination and reaction time.',
      benefitsNarrative: "Raider's Edit Course is one of the cleanest skill-development environments in Fortnite Creative. The progressive structure — beginner through elite — keeps children in an optimal challenge zone where they're always improving without being overwhelmed. It builds genuine hand-eye coordination, muscle memory, and the ability to stay focused under time pressure.",
      risksNarrative:    'Essentially risk-free. No other players, no chat, no spending. The main downside is that mastery-focused practice can occasionally feel repetitive for children who prefer varied gameplay.',
      parentTip:         'This is one of the best-value screen time activities in Fortnite. Encourage your child to track their personal bests — improving their own score matters more than any leaderboard position.',
    },
  },

  {
    code:         '6069-9263-9110',
    title:        'Skaavok Aim Training',
    description:  'A comprehensive aim training map with moving and stationary targets, multiple range settings, and warm-up drills. Popular with competitive players at every skill level.',
    creatorName:  'Skaavok',
    genre:        'Aim Training',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      0,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       0,
      learningScore:     2,
      recommendedMinAge: 8,
      summary:           'A focused aim-training environment with no social risk and no spending. Best in short bursts before a play session.',
      benefitsNarrative: 'Skaavok Aim Training builds precise mouse and controller control, reaction time, and the ability to track moving targets — skills that transfer directly to competitive play. The structured drill format makes improvement measurable, which is genuinely motivating for goal-oriented children.',
      risksNarrative:    'Minimal. No opponents, no chat, no purchases. Extended sessions can feel repetitive, but the absence of competitive pressure makes it easy to stop naturally.',
      parentTip:         'Treat this like athletic warm-up drills — a 15-20 minute session before gaming is enough. Children who use aim trainers consistently often feel more confident in competitive modes, which can reduce frustration overall.',
    },
  },

  // ── Tycoon / Relaxed ──────────────────────────────────────────────────────

  {
    code:         '9888-0668-4881',
    title:        'Farmers Market Tycoon',
    description:  'Build and manage a thriving market stall, harvesting crops and selling goods to earn in-game currency. A chill, low-pressure simulation with no combat.',
    creatorName:  null,
    genre:        'Tycoon',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   2,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 7,
      summary:           'A calm, no-combat tycoon experience that teaches basic resource management. A good option for children who find Battle Royale too intense.',
      benefitsNarrative: 'Tycoon maps introduce children to simple economic loops — invest resources, grow output, reinvest — in a consequence-free environment. Farmers Market Tycoon adds a creative angle by letting players customise their stall layout, encouraging spatial thinking alongside resource management.',
      risksNarrative:    'Tycoon maps use variable reward loops (the satisfaction of numbers going up) that can make stopping difficult. The virtual currency mechanic mirrors real-money spending patterns in structure, though no real money changes hands.',
      parentTip:         'Use this as a gentle introduction to Fortnite Creative for younger children who are not ready for combat. Set a clear session timer — the incremental reward loop can make time pass quickly.',
    },
  },

  // ── Escape Room / Puzzle ──────────────────────────────────────────────────

  {
    code:         '7490-9061-0904',
    title:        'Escape the Maze',
    description:  'Navigate a series of increasingly complex mazes using logic, memory, and spatial reasoning. Single-player and co-op modes available. No combat, no chat.',
    creatorName:  null,
    genre:        'Puzzle',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      0,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       1,
      learningScore:     3,
      recommendedMinAge: 7,
      summary:           'A calm puzzle experience with strong spatial and logical development value. One of the safest Creative maps for younger children.',
      benefitsNarrative: 'Maze navigation builds spatial memory, pattern recognition, and methodical problem-solving — children must hold a mental map of where they have been and reason about where to go next. The co-op mode adds collaborative communication when played with a sibling or friend.',
      risksNarrative:    'Negligible risk. No opponents, no chat with strangers, no spending. Some mazes may cause mild frustration on harder levels, but the non-competitive format keeps it low stakes.',
      parentTip:         'This is an excellent choice for playing alongside your child. Work through mazes together on the co-op mode — it turns gaming into a genuine collaborative thinking activity.',
    },
  },

  // ── Parkour ───────────────────────────────────────────────────────────────

  {
    code:         '0837-4964-4051',
    title:        'Parkour Paradise',
    description:  'A multi-stage parkour map with over 50 checkpointed levels ranging from beginner jumps to expert precision platforming. Bright, colourful visuals with no violence.',
    creatorName:  null,
    genre:        'Parkour',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 7,
      summary:           'A bright, checkpoint-based platformer with no combat or spending. A safe starting point for children new to Fortnite Creative.',
      benefitsNarrative: 'Parkour maps develop spatial awareness, precise movement control, and the persistence to retry after failure — all in a colourful, non-violent setting. Checkpoint systems mean children never lose significant progress, keeping frustration low and motivation high.',
      risksNarrative:    'Very low risk. Some lobbies allow multiple players which introduces basic stranger contact, but there is no voice chat requirement and no competitive pressure. Later levels can be frustrating for younger players.',
      parentTip:         'Parkour maps are great for children who enjoy platformer games like Mario. The Fortnite character controls feel different at first — give them a session or two to adjust before judging whether they enjoy it.',
    },
  },

  // ── Racing ────────────────────────────────────────────────────────────────

  {
    code:         '1449-0533-0881',
    title:        'Creative Kart Racing',
    description:  'A kart-racing map with multiple circuits of increasing difficulty. Up to 16 players race simultaneously — no weapons, no building, just racing lines and timing.',
    creatorName:  null,
    genre:        'Racing',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     1,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       2,
      learningScore:     1,
      recommendedMinAge: 7,
      summary:           'A clean competitive racing experience with no weapons or building. Low-stakes fun that is easy to pick up for all ages.',
      benefitsNarrative: 'Racing games develop reaction time, racing-line intuition, and the ability to manage competitive pressure in a low-stakes environment. The multi-player format introduces healthy competition without the toxicity common in combat modes.',
      risksNarrative:    'Multiplayer lobbies can occasionally include poor sportsmanship, though the racing format limits meaningful interaction. The competitive loop can make it difficult to stop after a loss ("just one more race"). No voice chat, no spending.',
      parentTip:         'Racing maps are a great bridge for children interested in games like Mario Kart. The "just one more race" effect is real — agree on a race count before starting rather than a time limit.',
    },
  },

  // ── Zone Wars (additional) ────────────────────────────────────────────────

  {
    code:         '8319-7479-9938',
    title:        'World Cup Zone Wars',
    description:  'A competitive Zone Wars map recreating high-level tournament conditions. Designed for players who want to train at a World Cup level of intensity.',
    creatorName:  null,
    genre:        'Zone Wars',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     2,
      ugcContentRisk:    0,
      strangerRisk:      2,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       1,
      learningScore:     3,
      recommendedMinAge: 13,
      summary:           'A high-skill Zone Wars map modelled on tournament play. Exceptional for mechanical development but demanding in intensity — best for teens with competitive gaming goals.',
      benefitsNarrative: 'World Cup Zone Wars replicates the kind of high-pressure decision-making that top competitive players train with. The format pushes rapid building, editing, and positioning — skills with genuine transferable value for players pursuing competitive Fortnite seriously.',
      risksNarrative:    'Tournament-intensity competition brings out the worst in some players. Voice chat and text chat can become toxic under pressure, and repeated losses in a high-standards environment can be demoralising for players who are not yet at that level.',
      parentTip:         'This map is genuinely for older, experienced players with a competitive interest. If your teen is struggling emotionally after sessions here, consider alternating with lower-stakes practice maps to maintain enjoyment alongside development.',
    },
  },
  {
    code:         '9901-1043-2391',
    title:        'Silo Zone Wars',
    description:  'A Zone Wars map set in and around industrial silos. The vertical layout and confined spaces create a distinctive playstyle focused on height control and quick rotations.',
    creatorName:  null,
    genre:        'Zone Wars',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     2,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       1,
      learningScore:     3,
      recommendedMinAge: 12,
      summary:           'A distinctive Zone Wars variant that trains height-control and rotation mechanics. Competitive intensity warrants parental awareness for under-13s.',
      benefitsNarrative: 'The silo environment forces players to think vertically — gaining and holding high ground under storm pressure develops spatial reasoning and rapid tactical decision-making. The unique layout means players cannot rely on memorised patterns and must adapt in real time.',
      risksNarrative:    'Like all Zone Wars, competitive pressure can lead to frustration and occasional poor sportsmanship from other players. The match format ends quickly after elimination, which creates a replay loop that can extend sessions unintentionally.',
      parentTip:         'The short match length is a double-edged sword — each game is quick, but "one more game" adds up fast. Agree on a number of rounds before starting rather than watching the clock.',
    },
  },

  // ── 1v1 / Build Fights (additional) ──────────────────────────────────────

  {
    code:         '5599-2269-6015',
    title:        '1v1 Build Fights',
    description:  'A classic 1v1 map where two players build and battle against each other with unlimited materials. The purest test of individual Fortnite mechanics.',
    creatorName:  null,
    genre:        '1v1',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     2,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       1,
      learningScore:     3,
      recommendedMinAge: 12,
      summary:           'The definitive 1v1 practice format. Unlimited materials eliminate resource pressure so the contest is purely about mechanical skill — excellent for development, intense by design.',
      benefitsNarrative: '1v1 Build Fights strips away every distraction and isolates the mechanical core of Fortnite. Players who train here develop faster building reflexes, better editing under pressure, and sharper combat intuition — all directly applicable to the main game.',
      risksNarrative:    'Losing repeatedly to a significantly better player can be demoralising. The intensity of 1v1 combat also brings out poor sportsmanship more readily than team modes, and taunting after wins is common.',
      parentTip:         'Encourage your child to play 1v1 with friends first, then gradually branch into matchmaking against strangers. Framing it as "practice" rather than "competition" sets healthier expectations around losing.',
    },
  },
  {
    code:         '3843-8268-1811',
    title:        'Turtle Wars',
    description:  'A defensive mechanics trainer where players practice building and maintaining protective structures while under sustained attack. Focuses on the "turtle" defensive playstyle.',
    creatorName:  null,
    genre:        'Build Battle',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     2,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       1,
      learningScore:     3,
      recommendedMinAge: 12,
      summary:           'A mechanics trainer focused on defensive building. Less chaotic than open Zone Wars, but still competitive and best suited to players with some Fortnite experience.',
      benefitsNarrative: 'Turtle Wars develops the defensive half of Fortnite mechanics — managing structure under pressure, reading attack patterns, and conserving resources. Players who master turtling are harder to eliminate in the main game, which builds genuine confidence.',
      risksNarrative:    'Competitive intensity can produce frustration and taunting from opponents. The format rewards patience over explosive action, which can feel unrewarding for younger or more impulsive players.',
      parentTip:         'This is a good intermediate step between casual play and full Zone Wars. If your child is finding Zone Wars overwhelming, turtle practice can build confidence before stepping back into that format.',
    },
  },

  // ── Deathrun (additional) ─────────────────────────────────────────────────

  {
    code:         '8088-7001-1131',
    title:        'Rainbow Deathrun',
    description:  'A bright, colourful deathrun with 50 levels designed for younger players. Every stage uses vivid colour-coded platforms to signal safe routes — deliberately beginner-friendly.',
    creatorName:  null,
    genre:        'Deathrun',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      0,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 7,
      summary:           'A welcoming, visually clear deathrun ideal for children new to Fortnite Creative. Low stakes, no violence, no strangers — pure movement fun.',
      benefitsNarrative: 'The colour-coded design teaches children to read visual cues and plan movement before acting — a core skill that extends beyond gaming. The 50-level structure provides a satisfying sense of incremental progress without requiring the reflexes of harder deathrun maps.',
      risksNarrative:    'Minimal. Some lobbies allow multiple players which introduces brief stranger contact, but there is no voice chat and no competitive pressure. Later levels may cause mild frustration for very young players.',
      parentTip:         'This is one of the best starting points for children aged 7–9 who are curious about Fortnite but not ready for combat. The rainbow aesthetic also makes it immediately appealing — an easy "first Fortnite game" to share.',
    },
  },
  {
    code:         '4530-1451-0330',
    title:        '50 Levels Easy Deathrun',
    description:  'Fifty beginner-accessible deathrun levels designed to build foundational movement skills without the extreme difficulty spikes of competitive maps. Clear layouts and generous checkpoints.',
    creatorName:  null,
    genre:        'Deathrun',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      0,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       0,
      learningScore:     2,
      recommendedMinAge: 7,
      summary:           'A gentle, solo-focused deathrun for new players. Generous checkpoints keep frustration low while 50 levels provide a satisfying arc of progression.',
      benefitsNarrative: 'The deliberate beginner-friendly design keeps children in a productive learning zone — challenging enough to require genuine skill development, forgiving enough that frustration stays manageable. Completing the full 50 levels builds a genuine sense of accomplishment.',
      risksNarrative:    'Essentially risk-free. No other players, no chat, no spending. The biggest risk is boredom for more experienced players who outgrow it quickly.',
      parentTip:         'A great map to complete alongside your child as an introduction to Fortnite Creative. Once they finish it, Cizzorz Deathrun 4.0 or Raider\'s Edit Course are natural next steps up in challenge.',
    },
  },
  {
    code:         '5472-4152-0162',
    title:        "Jesgran's Deathrun",
    description:  'A highly regarded intermediate deathrun with 25 handcrafted levels. Known for creative level design that requires spatial problem-solving as much as raw movement skill.',
    creatorName:  'Jesgran',
    genre:        'Deathrun',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      0,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       0,
      learningScore:     3,
      recommendedMinAge: 9,
      summary:           'A thoughtfully designed intermediate deathrun that rewards spatial reasoning alongside reflexes. Solo, safe, and genuinely satisfying to complete.',
      benefitsNarrative: "Jesgran's levels are unusual in requiring players to understand the level geometry before attempting it — reading the space, planning a route, then executing. This thinking-before-acting pattern is a valuable habit that transfers to real-world problem-solving. The handcrafted quality also means each level feels intentional rather than repetitive.",
      risksNarrative:    'Very low. A solo map with no opponents, no chat, and no spending. Some levels are genuinely difficult and may cause frustration for younger players — but the absence of competitive pressure keeps the stakes appropriately low.',
      parentTip:         'If your child finishes the easier deathrun maps, this is a natural and satisfying progression. The creative level design often sparks conversations about how games are made — a gateway into game design thinking.',
    },
  },
  {
    code:         '1944-5826-7382',
    title:        'Carnival Deathrun',
    description:  'A carnival-themed deathrun with colourful, whimsical level design. 30 obstacle stages set in a vibrant fairground environment — more visually entertaining than standard deathrun maps.',
    creatorName:  null,
    genre:        'Deathrun',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 8,
      summary:           'A charming themed deathrun that keeps younger players engaged through visual variety. Low risk, no violence, and genuinely fun to look at.',
      benefitsNarrative: 'The carnival theme adds environmental storytelling to obstacle-course navigation — children are not just jumping between platforms but interpreting a visually rich scene. The moderate difficulty keeps children challenged without the punishing spikes of harder deathrun maps.',
      risksNarrative:    'Very low. Some sessions may include other players which introduces brief stranger contact, but no voice chat is required and the map has no competitive element. A small number of later levels may be frustrating for younger children.',
      parentTip:         'The bright theme makes this a great shared experience — watch your child play a few levels and ask them to explain the obstacles. Describing what they see and plan develops communication and spatial vocabulary.',
    },
  },

  // ── Edit Training (additional) ────────────────────────────────────────────

  {
    code:         '9340-0571-3839',
    title:        'TK_Sway Edit Course',
    description:  'A beginner-to-intermediate edit course designed by TK_Sway. Clear progression through edit patterns with a focus on building the muscle memory needed for in-game editing.',
    creatorName:  'TK_Sway',
    genre:        'Edit Course',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      0,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       0,
      learningScore:     2,
      recommendedMinAge: 8,
      summary:           'A clean beginner edit course with clear progression. A good on-ramp before more demanding courses like Raider\'s.',
      benefitsNarrative: "TK_Sway's course is designed to build muscle memory through deliberate repetition of core edit patterns. The gentle difficulty curve makes it less intimidating than elite edit courses while still producing measurable improvement in editing speed over time.",
      risksNarrative:    'Minimal. No other players, no chat, no spending. The repetitive nature can feel tedious for children who prefer varied gameplay — short sessions of 15-20 minutes are more effective than marathon practice anyway.',
      parentTip:         'Treat this like a musical scale exercise — 15 minutes of focused edit practice before a longer play session is more effective than hours of grinding. Encourage your child to measure their time on specific patterns rather than just "practising".',
    },
  },

  // ── Party & Social (additional) ───────────────────────────────────────────

  {
    code:         '1300-5319-2596',
    title:        'Among Us Fortnite',
    description:  "A Fortnite Creative recreation of Among Us. Players complete tasks while crewmates attempt to identify impostors — the full social deduction experience built inside Fortnite's engine.",
    creatorName:  null,
    genre:        'Social Deduction',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     1,
      ugcContentRisk:    0,
      strangerRisk:      2,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       3,
      learningScore:     2,
      recommendedMinAge: 10,
      summary:           'A faithful Among Us experience inside Fortnite. Strong social and logical thinking development — great with friends, more caution needed with strangers.',
      benefitsNarrative: 'Among Us-style gameplay builds deductive reasoning, persuasive communication, and the ability to evaluate competing claims under social pressure — genuinely valuable thinking skills. The group discussion mechanic also develops confidence in articulating an argument and listening to others.',
      risksNarrative:    'Accusing and being accused (the core mechanic) can feel personal for younger or more sensitive players. Sessions with strangers introduce unsupervised voice chat, which requires monitoring for under-12s. Some players use the format to bully or exclude others.',
      parentTip:         'This is one of the best maps to play in a private lobby with a group of friends your child knows. Organise a session where the whole group is on voice chat together — it becomes a genuinely fun shared experience rather than an unsupervised stranger interaction.',
    },
  },
  {
    code:         '3937-4366-7175',
    title:        'Floor is Lava',
    description:  'The classic playground game recreated in Fortnite — rising lava forces players to constantly find higher ground. Fast, chaotic fun with minimal violence.',
    creatorName:  null,
    genre:        'Party',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     1,
      ugcContentRisk:    0,
      strangerRisk:      2,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       2,
      learningScore:     1,
      recommendedMinAge: 8,
      summary:           'A lighthearted survival race with minimal violence and broad age appeal. Great for a mixed group of players with varying skill levels.',
      benefitsNarrative: 'Floor is Lava encourages quick spatial decision-making and builds the movement fluency to find and reach safe ground rapidly. The shared challenge format creates natural moments of cooperation and shared hilarity — excellent for social bonding.',
      risksNarrative:    'Multiplayer lobbies with strangers carry standard social risks, though the frantic nature of the game limits meaningful interaction. The match loop is short, creating a replay pull. Losing to the lava is not competitive in a personal way, which keeps frustration low.',
      parentTip:         'A great option for playing with siblings or a mixed-age group of friends. The accessible concept (floor is lava — everyone knows it) means no explanation needed and everyone can participate equally from the first round.',
    },
  },
  {
    code:         '4090-8579-8990',
    title:        'Giant Hide and Seek',
    description:  'A large-scale hide and seek map where seekers hunt hiders across an oversized environment. Players must stay still and blend in to survive — patience and observation are key.',
    creatorName:  null,
    genre:        'Party',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     1,
      ugcContentRisk:    0,
      strangerRisk:      2,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       3,
      learningScore:     1,
      recommendedMinAge: 8,
      summary:           'A social, low-violence hide and seek experience that rewards patience and observation. Good for playing with friends or family.',
      benefitsNarrative: 'Giant Hide and Seek develops spatial memory, the patience to stay still and wait, and the observational skills to spot discrepancies in the environment — all valuable real-world skills. The slow pace makes it one of the calmest multiplayer experiences in Fortnite Creative.',
      risksNarrative:    'Multiplayer lobbies introduce stranger interaction, though the calm nature of the game limits the opportunity for toxic behaviour. Voice chat with unknown players remains the primary risk for younger children.',
      parentTip:         'This is one of the most family-friendly multiplayer maps in Fortnite. Consider joining a session with your child to see the community firsthand — the relaxed pace makes it easy to observe while they play.',
    },
  },
  {
    code:         '7686-9929-0641',
    title:        'Sharks vs Divers',
    description:  'A team-based game where sharks hunt divers in an underwater-themed map. Divers must complete objectives while sharks eliminate them — asymmetric roles create interesting strategic depth.',
    creatorName:  null,
    genre:        'Team Game',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     1,
      ugcContentRisk:    0,
      strangerRisk:      2,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       2,
      learningScore:     1,
      recommendedMinAge: 9,
      summary:           'A creative asymmetric team game with ocean theming and no building. The role-switching mechanic keeps it fresh and makes losing less frustrating.',
      benefitsNarrative: 'Playing both sides of an asymmetric game (predator and prey across rounds) builds perspective-taking and adaptive strategy — players must think about what the other team can see and do. The team format also develops communication and basic coordination.',
      risksNarrative:    'Multiplayer with strangers introduces standard social risks. The competitive format can occasionally produce poor sportsmanship, though the team structure dilutes individual-focused toxicity. The hunting theme involves light violence consistent with Fortnite\'s overall rating.',
      parentTip:         'The role swap between rounds is built-in frustration management — being the shark after being hunted as a diver resets the emotional state naturally. A good map to use when your child needs something social but less intense than Zone Wars.',
    },
  },

  // ── Roleplay ──────────────────────────────────────────────────────────────

  {
    code:         '6523-7421-5562',
    title:        'City Life RP',
    description:  'An open urban roleplay map with jobs, vehicles, and social spaces. Players create their own stories within a simulated city environment — police, civilian, and criminal roles available.',
    creatorName:  null,
    genre:        'Roleplay',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     1,
      ugcContentRisk:    1,
      strangerRisk:      3,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   3,
      socialScore:       3,
      learningScore:     1,
      recommendedMinAge: 12,
      summary:           'A creative social sandbox with strong narrative and imagination value. The open format and stranger interaction require parental awareness — unstructured roleplays can go in unexpected directions.',
      benefitsNarrative: 'City Life RP encourages creative narrative construction, perspective-taking through different roles, and improvised social collaboration. Children who play this kind of roleplay develop storytelling ability, empathy through character embodiment, and negotiation skills within the game\'s social dynamics.',
      risksNarrative:    'Open roleplay servers with strangers are the hardest environment to preview. Players can introduce mature themes, inappropriate roleplay, or target younger participants for in-game drama. The "criminal" roles are a draw for older players who may push the content toward uncomfortable territory.',
      parentTip:         'Check that your child is playing in a private server with known friends rather than open matchmaking. If they are on public servers, periodic check-ins on who they are roleplaying with are worthwhile. This is a case where co-play or a brief watch is genuinely useful.',
    },
  },
  {
    code:         '7735-0513-9914',
    title:        'High School RP',
    description:  'A high school social roleplay where players take on student roles, attend classes, and navigate hallway social dynamics. One of the most popular roleplay maps in Fortnite Creative.',
    creatorName:  null,
    genre:        'Roleplay',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     2,
      ugcContentRisk:    1,
      strangerRisk:      3,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   2,
      socialScore:       3,
      learningScore:     1,
      recommendedMinAge: 13,
      summary:           'A popular social roleplay with significant stranger interaction. The school setting mirrors real-world social dynamics — including cliques, drama, and exclusion — which warrants close parental attention for younger teens.',
      benefitsNarrative: 'High School RP gives players a safe space to experiment with social identities and roles. For teens navigating actual school social dynamics, the game environment can be a lower-stakes practice ground for social skills and self-expression.',
      risksNarrative:    'The social dynamics of this format can replicate real-world bullying, cliques, and exclusion. Open servers include strangers across a wide age range, and unmoderated voice chat can expose younger players to mature language or inappropriate roleplay scenarios. The emotional intensity of social drama can affect mood after sessions.',
      parentTip:         'Ask your teen who they are playing with and what their character does. High School RP is less about gameplay and more about social performance — the conversations happening in-game are the thing worth understanding. Private lobbies with known friends are meaningfully safer.',
    },
  },
  {
    code:         '5765-1942-6099',
    title:        'Island Life RP',
    description:  'A tropical island roleplay with houses, shops, jobs, and social spaces. A more relaxed alternative to city roleplays — the resort setting encourages creative, low-pressure storytelling.',
    creatorName:  null,
    genre:        'Roleplay',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     1,
      ugcContentRisk:    1,
      strangerRisk:      3,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   2,
      socialScore:       3,
      learningScore:     1,
      recommendedMinAge: 12,
      summary:           'A calmer roleplay with a relaxed tropical setting. Creativity and social play are the strengths — stranger interaction remains the primary area for parental awareness.',
      benefitsNarrative: "The island setting naturally encourages less conflict-driven roleplay than city or school maps. Players build social narratives around exploration, friendship, and daily life rather than drama or crime — a gentler version of the roleplay genre that better suits younger players' developmental needs.",
      risksNarrative:    'Open server stranger interaction remains the main risk, as with all public roleplay maps. The relaxed theme attracts a broader age range than high school or city maps, but adult players on public servers can still introduce inappropriate content.',
      parentTip:         'For players interested in roleplay but not ready for the more intense social dynamics of City Life or High School RP, this is a gentler starting point. A private server with two or three friends is the ideal setup.',
    },
  },

  // ── Horror & Escape ───────────────────────────────────────────────────────

  {
    code:         '3587-8489-5413',
    title:        'The Backrooms',
    description:  'A horror exploration map based on the internet-famous "Backrooms" liminal spaces. Players navigate endless yellow corridors and unusual environments — atmospheric and unsettling, no jump scares.',
    creatorName:  null,
    genre:        'Horror',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       1,
      learningScore:     1,
      recommendedMinAge: 12,
      summary:           'An atmospheric liminal horror experience with no combat or jump scares. The unsettling tone requires age-checking — otherwise one of the safer Creative horror maps.',
      benefitsNarrative: 'The Backrooms engages players in environmental storytelling and sustained atmospheric tension — building the ability to sit with uncertainty and explore rather than act impulsively. The internet culture reference point also sparks genuine interest in creative media, game design, and horror as an artistic genre.',
      risksNarrative:    'The atmospheric dread is intentional and can be genuinely disturbing for sensitive children or those under 12. The liminal spaces concept (familiar places made wrong) is psychologically potent. While there are no jump scares or graphic content, the sustained unease is not appropriate for all temperaments.',
      parentTip:         'Preview this map yourself before letting children under 12 play. The content is not graphic, but the emotional tone is genuinely unsettling. For older teens who enjoy horror, this is one of the most artistically interesting maps in Fortnite Creative.',
    },
  },
  {
    code:         '8136-0902-6650',
    title:        'Escape Room: The Lab',
    description:  'A science-themed escape room with puzzles involving logic, pattern recognition, and in-game mechanics. Players must solve a series of challenges to escape a mysterious laboratory.',
    creatorName:  null,
    genre:        'Escape Room',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       1,
      learningScore:     3,
      recommendedMinAge: 9,
      summary:           'A thoughtfully designed puzzle escape room with strong logic and deduction value. Low risk, high cognitive engagement — one of the most educationally rich Creative formats.',
      benefitsNarrative: 'Escape rooms develop systematic problem-solving, pattern recognition, and the ability to combine observations into a solution — skills directly linked to mathematical and scientific reasoning. The "lab" setting adds light STEM theming that can spark curiosity about real science.',
      risksNarrative:    'Very low risk. The occasional multiplayer session introduces brief stranger contact, but the puzzle-focused nature means social interaction is minimal and purposeful. Some puzzles may be frustrating for younger players, though hints are typically available.',
      parentTip:         'Play this alongside your child to turn it into a shared puzzle-solving activity. Escape rooms in Fortnite Creative are genuinely collaborative when played co-op — two people talking through clues is more effective and more fun than solo play.',
    },
  },
  {
    code:         '5767-6524-0140',
    title:        'Haunted Mansion Escape',
    description:  'A gothic haunted house where players solve puzzles to find the exit. The horror atmosphere is spooky rather than graphic — closer to Halloween than survival horror.',
    creatorName:  null,
    genre:        'Escape Room',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 10,
      summary:           'A spooky-but-not-scary escape room with Halloween-style atmosphere. Puzzle-focused and solo-friendly — a good option for children who enjoy mystery and exploration.',
      benefitsNarrative: 'Haunted Mansion Escape blends puzzle-solving with environmental exploration — players must read their surroundings carefully to find hidden clues. The spooky setting adds emotional stakes that make solving each puzzle feel more rewarding than in neutral environments.',
      risksNarrative:    'Low risk. The haunted aesthetic is spooky rather than disturbing — appropriate for most children over 10. No graphic content, no combat, and minimal stranger interaction. Sensitive children who are genuinely frightened by ghost imagery should skip this one.',
      parentTip:         'A great Halloween-season map to play with your child. The co-op puzzle format means you can contribute meaningfully even if you are not a Fortnite player — finding clues and reasoning through solutions does not require mechanical game skill.',
    },
  },

  // ── Combat & Sports ───────────────────────────────────────────────────────

  {
    code:         '6775-7900-3099',
    title:        'Gun Game FFA',
    description:  "A free-for-all mode where players cycle through every weapon in the game, one kill at a time. First to complete all weapons wins. No building — pure gunfighting mechanics.",
    creatorName:  null,
    genre:        'Gun Game',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     2,
      ugcContentRisk:    0,
      strangerRisk:      2,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 12,
      summary:           'A no-build gunfighting mode that develops aim and weapon familiarity. The format is competitive and occasionally toxic — best for players comfortable with losing.',
      benefitsNarrative: "Gun Game forces players to adapt their playstyle to completely different weapons in rapid succession — an excellent way to build broad combat competency and reduce over-reliance on a single preferred weapon. The no-build format rewards pure aiming skill, making improvement measurable and satisfying.",
      risksNarrative:    'Free-for-all competitive modes with strangers are among the more toxic Fortnite Creative environments. The rapid loss-and-respawn cycle can be frustrating for players who are falling behind, and taunting is common from leading players.',
      parentTip:         'Check whether text chat and voice chat are enabled. If your child is competitive by nature and handles losses well, this is excellent aim training. If they tend toward frustration or take losses personally, consider solo aim training maps first.',
    },
  },
  {
    code:         '0098-0150-3900',
    title:        'One Shot Sniper',
    description:  'A sniper-only mode where players have one shot per round. Patience, positioning, and precise aim are everything — a stark contrast to the usual fast-paced Fortnite format.',
    creatorName:  null,
    genre:        'Sniper',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     1,
      ugcContentRisk:    0,
      strangerRisk:      2,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 12,
      summary:           'A slow, tactical shooting mode that develops patience and precision. Significantly calmer than Zone Wars — a good introduction to competitive play for measured players.',
      benefitsNarrative: "One Shot Sniper rewards the opposite qualities to typical Fortnite play — patience, stillness, and reading the environment rather than rapid building and editing. Children who struggle with the hectic pace of Zone Wars often find this format more approachable while still developing genuine mechanical skills.",
      risksNarrative:    'The competitive format with strangers carries standard toxicity risks, though the slow pace limits most negative interaction to post-round chat. The tension of the one-shot format can be nerve-wracking for anxious players.',
      parentTip:         'If your child wants to try competitive play but finds Zone Wars overwhelming, One Shot Sniper is a useful intermediate step. The slower pace gives more thinking time and makes each decision meaningful rather than reactive.',
    },
  },
  {
    code:         '6061-1054-7638',
    title:        'Capture the Flag',
    description:  'A team-based Capture the Flag mode where teams compete to steal and return the opposing flag. Strategy, communication, and coordination matter more than individual skill.',
    creatorName:  null,
    genre:        'Team Game',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     1,
      ugcContentRisk:    0,
      strangerRisk:      2,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       2,
      learningScore:     2,
      recommendedMinAge: 10,
      summary:           'A team strategy mode that develops communication and coordination. Lower individual pressure than 1v1 modes — a good entry point into competitive team play.',
      benefitsNarrative: 'Capture the Flag develops team strategy, spatial awareness of an entire map, and communication under pressure — skills that transfer to sports and collaborative real-world contexts. The objective-based format means individual losses feel less personal than in deathmatch modes.',
      risksNarrative:    'Team competitive play with strangers can produce blame-shifting and frustration when teammates underperform. The objective focus limits pure toxicity, but losing a flag at the last second can trigger strong emotional reactions.',
      parentTip:         'If possible, organise a private server with your child\'s friend group split into teams. The coordination element becomes genuinely strategic and social when you know your teammates — a much better experience than playing with strangers.',
    },
  },

  // ── Tycoon (additional) ───────────────────────────────────────────────────

  {
    code:         '7246-0512-3987',
    title:        'Restaurant Tycoon',
    description:  'Manage and grow a restaurant empire — seat customers, cook food, hire staff, and expand. A satisfying management sim with no combat and clear progression loops.',
    creatorName:  null,
    genre:        'Tycoon',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   2,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 7,
      summary:           'A calm management sim with light economic and planning concepts. Relaxed and creative — a strong alternative for children who find combat modes too intense.',
      benefitsNarrative: "Restaurant Tycoon introduces children to planning, prioritisation, and basic supply-and-demand thinking through an engaging simulation. The 'grow your restaurant' loop provides satisfying progress without any competitive pressure — children set their own goals and work toward them at their own pace.",
      risksNarrative:    'The incremental number-growing loop is engaging but can make stopping difficult — sessions can extend unintentionally. There is no real-money spending, but the virtual currency accumulation mirrors real economic reward patterns. Some players in shared sessions may disrupt others\' progress.',
      parentTip:         'Set a session timer rather than a game goal — tycoon games are designed to always have one more thing to upgrade. 30-45 minutes is typically enough for a satisfying play session without the "just one more expansion" trap running long.',
    },
  },
  {
    code:         '4839-2741-0951',
    title:        'Zoo Tycoon',
    description:  'Design and manage a zoo — place animal enclosures, manage visitor happiness, and expand your park. A kid-friendly tycoon with animal care and environmental theming.',
    creatorName:  null,
    genre:        'Tycoon',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   2,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 7,
      summary:           'An animal-themed tycoon with creative and nurturing appeal. One of the most age-appropriate Fortnite Creative maps for younger children.',
      benefitsNarrative: 'Zoo Tycoon wraps economic simulation in an animal care context that many children find intrinsically motivating. Managing habitat conditions, animal happiness, and visitor flow introduces systems thinking — understanding how multiple variables interact — in an accessible, visually rewarding package.',
      risksNarrative:    'The incremental growth loop can extend sessions beyond planned time. Otherwise very low risk — no violence, no competition, no stranger interaction required. A safe environment even for very young children with adult setup.',
      parentTip:         "A great map for animal-loving children who are not yet interested in combat games. If your child loves Minecraft's animal husbandry or pet care apps, Zoo Tycoon in Fortnite Creative is a natural bridge into the platform.",
    },
  },

  // ── Team Survival ─────────────────────────────────────────────────────────

  {
    code:         '0110-3316-2391',
    title:        'Bed Wars Fortnite',
    description:  'A Fortnite Creative recreation of the popular Bed Wars game mode. Teams protect their bed while trying to destroy others — strategic resource collection, base defence, and combat.',
    creatorName:  null,
    genre:        'Team Strategy',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     2,
      ugcContentRisk:    0,
      strangerRisk:      2,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   1,
      socialScore:       2,
      learningScore:     2,
      recommendedMinAge: 10,
      summary:           'A strategic team mode with strong resource management and collaboration skills. More complex than most Creative modes — and more prone to toxicity when teamwork breaks down.',
      benefitsNarrative: 'Bed Wars develops multi-layered strategic thinking: resource collection, defensive construction, coordinated attacks, and prioritising objectives over individual kills. Players must communicate, adapt to opponents\' strategies, and balance offensive and defensive resource allocation — genuinely sophisticated teamwork skills.',
      risksNarrative:    'When a team loses their bed, emotional responses can be intense and blame-shifting between teammates is common. Competitive Bed Wars communities include older players with high expectations, which can be discouraging for younger or less experienced players on a public team.',
      parentTip:         'Bed Wars is most enjoyable and least toxic when played with a full team of known friends. Organise a session where your child\'s friend group forms a private team — the cooperative coordination becomes a social highlight rather than a source of frustration.',
    },
  },
  {
    code:         '6016-8000-2657',
    title:        'Skywars Fortnite',
    description:  'A sky island survival mode where players collect resources, build bridges, and eliminate opponents. Last team standing wins. Classic Skywars gameplay translated to Fortnite mechanics.',
    creatorName:  null,
    genre:        'Survival',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 2,
      toxicityScore:     2,
      ugcContentRisk:    0,
      strangerRisk:      2,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   0,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 11,
      summary:           'A competitive sky island survival mode with resource management and combat. Familiar to Minecraft players — good for development, but intensity warrants parental awareness.',
      benefitsNarrative: "Skywars teaches risk assessment and resource prioritisation — players must constantly evaluate whether to collect more materials, build bridges toward opponents, or defend their island. The spatial challenge of fighting across gaps at height adds distinctive thinking demands that standard maps don't replicate.",
      risksNarrative:    'The competitive format with strangers can produce toxicity, particularly when a player is eliminated early. The "void death" mechanic (falling off the island) can be especially frustrating for younger players who feel robbed of a fair fight.',
      parentTip:         'If your child enjoys Minecraft\'s Skywars servers, this is a direct equivalent in Fortnite. The cross-platform familiarity often helps them get up to speed faster, and comparing the two games can spark interesting conversations about game design.',
    },
  },

  // ── Adventure & Exploration ───────────────────────────────────────────────

  {
    code:         '4721-9382-0156',
    title:        'Wilderness Survival',
    description:  'A survival experience where players gather resources, build shelter, and navigate natural hazards in a wilderness environment. Cooperative-friendly with no PvP combat.',
    creatorName:  null,
    genre:        'Survival',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   2,
      socialScore:       1,
      learningScore:     3,
      recommendedMinAge: 9,
      summary:           'A cooperative survival experience with no PvP and strong problem-solving value. A good option for Minecraft fans exploring Fortnite Creative.',
      benefitsNarrative: 'Wilderness Survival develops planning, resource management, and environmental reading — skills that mirror real outdoor education concepts. The no-PvP format removes competitive pressure entirely, making failure feel like a learning moment rather than a defeat.',
      risksNarrative:    'Very low risk. No competitive combat, no spending, minimal stranger interaction. The open-ended survival format can occasionally feel directionless for younger players who need more structured goals.',
      parentTip:         'If your child enjoys Minecraft\'s survival mode, this scratches the same itch inside Fortnite. Playing cooperatively with a sibling or friend makes the resource-gathering and building genuinely collaborative — a natural multi-player co-op experience.',
    },
  },
  {
    code:         '3281-7450-6912',
    title:        'Pirate Adventure',
    description:  'A story-driven pirate adventure with quests, exploration, and naval combat. Players sail ships, discover islands, and complete objectives in a colourful swashbuckling setting.',
    creatorName:  null,
    genre:        'Adventure',
    thumbnailUrl: null,
    scores: {
      dopamineTrapScore: 1,
      toxicityScore:     0,
      ugcContentRisk:    0,
      strangerRisk:      1,
      monetizationScore: 0,
      privacyRisk:       0,
      creativityScore:   2,
      socialScore:       1,
      learningScore:     2,
      recommendedMinAge: 8,
      summary:           'A story-driven pirate adventure with quests and exploration. Light combat in a colourful setting — one of the more narratively engaging Creative maps.',
      benefitsNarrative: 'Pirate Adventure develops narrative comprehension (following quest objectives), spatial navigation, and the satisfaction of completing multi-step goals — a format closer to traditional adventure games than Fortnite\'s usual combat focus. The thematic richness sparks imagination in a way that pure skill maps don\'t.',
      risksNarrative:    'Very low risk. Combat is present but light and thematic rather than competitive. No stranger interaction required for the main experience, no spending pressure, and no inappropriate content. Suitable for a broad age range.',
      parentTip:         'A great gateway map for children who are interested in the world of Fortnite but not ready for competitive play. The quest structure gives clear goals and a sense of accomplishment that pure combat modes often lack for younger players.',
    },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 255)
}

function computeScores(s: MapScores) {
  const risk    = calculateExperienceRisk(s)
  const benefit = calculateExperienceBenefits(s.creativityScore, s.socialScore, s.learningScore)
  const timeRec = deriveTimeRecommendation(risk.ris, benefit.bds, risk.contentRisk, null)
  const safety  = 1 - risk.ris
  const denom   = benefit.bds + safety
  const curascore = denom > 0 ? Math.round((2 * benefit.bds * safety) / denom * 100) : 0
  return { risk, benefit, timeRec, curascore }
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
    console.error('[fetch-fortnite] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
  const runStartedAt = new Date()

  for (const map of CURATED_MAPS) {
    const { risk, benefit, timeRec, curascore } = computeScores(map.scores)
    const s = map.scores
    const existing_ = existingByCode.get(map.code)
    let experienceId: number

    if (existing_) {
      const contentChanged = existing_.title !== map.title || existing_.description !== (map.description ?? null)
      await db.update(platformExperiences).set({
        title:        map.title,
        description:  map.description,
        creatorName:  map.creatorName,
        // Only overwrite thumbnailUrl if we have one — preserve any URL set externally (e.g. fix-fortnite-thumbnails script)
        ...(map.thumbnailUrl !== null ? { thumbnailUrl: map.thumbnailUrl } : {}),
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

    await db.insert(experienceScores).values({
      experienceId,
      // Raw dimension inputs
      dopamineTrapScore:  s.dopamineTrapScore,
      toxicityScore:      s.toxicityScore,
      ugcContentRisk:     s.ugcContentRisk,
      strangerRisk:       s.strangerRisk,
      monetizationScore:  s.monetizationScore,
      privacyRisk:        s.privacyRisk,
      creativityScore:    s.creativityScore,
      socialScore:        s.socialScore,
      learningScore:      s.learningScore,
      // Engine-derived composites
      dopamineRisk:               risk.dopamine,
      monetizationRisk:           risk.monetization,
      socialRisk:                 risk.social,
      contentRisk:                risk.contentRisk,
      riskScore:                  risk.ris,
      benefitScore:               benefit.bds,
      curascore,
      timeRecommendationMinutes:  timeRec.minutes,
      timeRecommendationLabel:    timeRec.label,
      timeRecommendationColor:    timeRec.color,
      timeRecommendationReasoning: timeRec.reasoning,
      // Narrative
      recommendedMinAge:   s.recommendedMinAge,
      summary:             s.summary,
      benefitsNarrative:   s.benefitsNarrative,
      risksNarrative:      s.risksNarrative,
      parentTip:           s.parentTip,
      methodologyVersion:  CURRENT_METHODOLOGY_VERSION,
      calculatedAt:        new Date(),
      updatedAt:           new Date(),
    }).onConflictDoUpdate({
      target: experienceScores.experienceId,
      set: {
        // Raw dimension inputs — update when map scoring is revised
        dopamineTrapScore:  s.dopamineTrapScore,
        toxicityScore:      s.toxicityScore,
        ugcContentRisk:     s.ugcContentRisk,
        strangerRisk:       s.strangerRisk,
        monetizationScore:  s.monetizationScore,
        privacyRisk:        s.privacyRisk,
        creativityScore:    s.creativityScore,
        socialScore:        s.socialScore,
        learningScore:      s.learningScore,
        // Engine-derived composites — recomputed from inputs above
        dopamineRisk:               risk.dopamine,
        monetizationRisk:           risk.monetization,
        socialRisk:                 risk.social,
        contentRisk:                risk.contentRisk,
        riskScore:                  risk.ris,
        benefitScore:               benefit.bds,
        curascore,
        timeRecommendationMinutes:  timeRec.minutes,
        timeRecommendationLabel:    timeRec.label,
        timeRecommendationColor:    timeRec.color,
        timeRecommendationReasoning: timeRec.reasoning,
        // Narrative
        recommendedMinAge:   s.recommendedMinAge,
        summary:             s.summary,
        benefitsNarrative:   s.benefitsNarrative,
        risksNarrative:      s.risksNarrative,
        parentTip:           s.parentTip,
        methodologyVersion:  CURRENT_METHODOLOGY_VERSION,
        updatedAt:           new Date(),
      },
    })
    scored.push(map.title)
  }

  // ── Code drift check ───────────────────────────────────────────────────────
  // For maps not verified in the last 30 days, ping the Fortnite website.
  // A clean 404 means the island was unpublished — mark isPublic = false so
  // the page returns 404 gracefully instead of serving stale data.
  const DRIFT_THRESHOLD = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const toCheck = await db
    .select({ id: platformExperiences.id, placeId: platformExperiences.placeId, title: platformExperiences.title })
    .from(platformExperiences)
    .where(and(
      eq(platformExperiences.platformId, fortnitePlatform.id),
      eq(platformExperiences.isPublic, true),
      or(isNull(platformExperiences.lastFetchedAt), lt(platformExperiences.lastFetchedAt, DRIFT_THRESHOLD)),
    ))

  const deadCodes: string[] = []
  for (const map of toCheck) {
    try {
      const res = await fetch(`https://www.fortnite.com/creative/island/${map.placeId}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5_000),
      })
      if (res.status === 404) {
        await db.update(platformExperiences)
          .set({ isPublic: false, updatedAt: new Date() })
          .where(eq(platformExperiences.id, map.id))
        deadCodes.push(map.placeId ?? '')
        console.log(`[fetch-fortnite] Dead code: ${map.title} (${map.placeId})`)
      } else {
        await db.update(platformExperiences)
          .set({ lastFetchedAt: new Date() })
          .where(eq(platformExperiences.id, map.id))
      }
    } catch {
      console.warn(`[fetch-fortnite] Drift check skipped (timeout): ${map.placeId}`)
    }
  }

  // ── Stale score flagging ────────────────────────────────────────────────────
  // Maps whose scores haven't been recalculated in 6 months get flagged so
  // the AI rescore queue can pick them up automatically.
  const STALE_THRESHOLD = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  const staleRows = await db
    .select({ experienceId: experienceScores.experienceId })
    .from(experienceScores)
    .innerJoin(platformExperiences, eq(experienceScores.experienceId, platformExperiences.id))
    .where(and(
      eq(platformExperiences.platformId, fortnitePlatform.id),
      lt(experienceScores.calculatedAt, STALE_THRESHOLD),
    ))

  let staleCount = 0
  for (const { experienceId } of staleRows) {
    await db.update(platformExperiences)
      .set({ needsRescore: true, updatedAt: new Date() })
      .where(eq(platformExperiences.id, experienceId))
    staleCount++
  }
  if (staleCount > 0) console.log(`[fetch-fortnite] Flagged ${staleCount} maps as stale`)

  await logCronRun('fetch-fortnite-maps', runStartedAt, {
    itemsProcessed: inserted.length + refreshed.length,
    errors:         0,
    meta:           { inserted: inserted.length, refreshed: refreshed.length, scored: scored.length, staleFlagged: staleCount },
  })
  return NextResponse.json({
    ok: true,
    inserted:    inserted.length,
    refreshed:   refreshed.length,
    scored:      scored.length,
    driftChecked: toCheck.length,
    deadCodes,
    staleFlagged: staleCount,
    insertedMaps: inserted,
  })
}
