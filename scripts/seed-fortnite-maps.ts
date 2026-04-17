/**
 * One-shot script: upsert all curated Fortnite Creative maps into platform_experiences.
 * Mirrors the logic in fetch-fortnite-maps/route.ts — run this locally to seed
 * without needing the dev server.
 *
 * Usage: node --env-file=.env.local -e "require('child_process').execFileSync(process.execPath, ['./node_modules/tsx/dist/cli.mjs', 'scripts/seed-fortnite-maps.ts'], {stdio:'inherit', env: process.env})"
 */

import { db } from '../src/lib/db'
import { platformExperiences, games } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'

const CURATED_MAPS = [
  {
    code:        '2778-3253-4171',
    title:       'Cizzorz Deathrun 4.0',
    description: 'A punishing obstacle course with 30 increasingly difficult levels. Requires precise movement and patience — no combat, pure skill.',
    creatorName: 'Cizzorz',
    genre:       'Deathrun',
    thumbnailUrl: null,
  },
  {
    code:        '7813-7316-9735',
    title:       '100 Level Default Deathrun',
    description: 'One hundred progressively harder obstacle levels using default Fortnite assets. A popular starting point for players new to deathrun maps.',
    creatorName: null,
    genre:       'Deathrun',
    thumbnailUrl: null,
  },
  {
    code:        '3936-5272-9537',
    title:       'The Pit (Zone Wars)',
    description: 'A fast-paced Zone Wars map where a shrinking storm forces constant close-range combat. Builds competitive build and edit skills.',
    creatorName: 'Enigma',
    genre:       'Zone Wars',
    thumbnailUrl: null,
  },
  {
    code:        '6562-8953-6567',
    title:       'Pandvil Box Fight',
    description: 'A close-quarters box fighting practice map. Players spawn in small enclosed structures and fight for control — heavy emphasis on editing speed.',
    creatorName: 'Pandvil',
    genre:       'Box Fight',
    thumbnailUrl: null,
  },
  {
    code:        '6631-1688-2734',
    title:       'Prop Hunt',
    description: 'Hide and seek with a twist — one team disguises as objects while the other hunts them down. Lighthearted, low-violence, and great for groups.',
    creatorName: null,
    genre:       'Party',
    thumbnailUrl: null,
  },
  {
    code:        '0726-3548-3933',
    title:       'Murder Mystery',
    description: 'A social deduction map where one hidden murderer hunts down innocents. Players must identify the killer before time runs out.',
    creatorName: null,
    genre:       'Party',
    thumbnailUrl: null,
  },
  {
    code:        '6006-1872-8972',
    title:       'Strucid',
    description: 'A third-person build-battle arena inspired by Roblox Strucid. Players build towers and fight from the high ground — great for practicing construction mechanics.',
    creatorName: null,
    genre:       'Build Battle',
    thumbnailUrl: null,
  },
  {
    code:        '4044-8022-1843',
    title:       'The Dropper',
    description: 'Players free-fall through increasingly complex obstacle courses and must land safely at the bottom. No combat — pure spatial awareness and timing.',
    creatorName: null,
    genre:       'Dropper',
    thumbnailUrl: null,
  },
]

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 255)
}

async function main() {
  const [platform] = await db.select({ id: games.id }).from(games).where(eq(games.slug, 'fortnite-creative')).limit(1)
  if (!platform) throw new Error('fortnite-creative row not found — run seed-fortnite.ts first')

  console.log(`Platform id: ${platform.id}\n`)

  const existing = await db
    .select({ id: platformExperiences.id, placeId: platformExperiences.placeId, title: platformExperiences.title, description: platformExperiences.description })
    .from(platformExperiences)
    .where(eq(platformExperiences.platformId, platform.id))

  const existingByCode = new Map(existing.map(e => [e.placeId, e]))
  let inserted = 0, refreshed = 0

  for (const map of CURATED_MAPS) {
    process.stdout.write(`${map.code}  "${map.title}" ... `)
    const existing_ = existingByCode.get(map.code)

    if (existing_) {
      const contentChanged = existing_.title !== map.title || existing_.description !== (map.description ?? null)
      await db.update(platformExperiences).set({
        title: map.title, description: map.description,
        creatorName: map.creatorName, thumbnailUrl: map.thumbnailUrl,
        genre: map.genre,
        ...(contentChanged ? { needsRescore: true } : {}),
        updatedAt: new Date(),
      }).where(eq(platformExperiences.id, existing_.id))
      console.log('refreshed')
      refreshed++
    } else {
      let slug = slugify(map.title)
      const [collision] = await db.select({ id: platformExperiences.id }).from(platformExperiences).where(eq(platformExperiences.slug, slug)).limit(1)
      if (collision) slug = `${slug}-${map.code.replace(/-/g, '').slice(0, 8)}`

      await db.insert(platformExperiences).values({
        slug, platformId: platform.id, placeId: map.code, universeId: null,
        title: map.title, description: map.description, creatorName: map.creatorName,
        thumbnailUrl: map.thumbnailUrl, genre: map.genre, isPublic: true,
        lastFetchedAt: new Date(),
      })
      console.log('inserted')
      inserted++
    }
  }

  console.log(`\nDone — inserted: ${inserted}, refreshed: ${refreshed}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
