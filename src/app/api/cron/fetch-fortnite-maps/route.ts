/**
 * GET /api/cron/fetch-fortnite-maps
 *
 * Upserts curated Fortnite Creative map metadata into platform_experiences.
 * No external API required — metadata is maintained manually below.
 *
 * To add a new map:
 *   1. Find the island code in-game or on fortnite.gg
 *   2. Add an entry to CURATED_MAPS below
 *   3. The next cron run (or a manual trigger) will insert it
 *
 * Runs every 24h via GitHub Actions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformExperiences, games } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const maxDuration = 60

// ─── Curated map list ─────────────────────────────────────────────────────────
// code:         island code, format XXXX-XXXX-XXXX-XXXX
// thumbnailUrl: paste a direct image URL, or leave null

type CuratedMap = {
  code:         string
  title:        string
  description:  string | null
  creatorName:  string | null
  genre:        string | null
  thumbnailUrl: string | null
}

const CURATED_MAPS: CuratedMap[] = [
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

  for (const map of CURATED_MAPS) {
    const existing_ = existingByCode.get(map.code)

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

      refreshed.push(map.title)
    } else {
      let slug = slugify(map.title)
      const [collision] = await db
        .select({ id: platformExperiences.id })
        .from(platformExperiences)
        .where(eq(platformExperiences.slug, slug))
        .limit(1)
      if (collision) slug = `${slug}-${map.code.replace(/-/g, '').slice(0, 8)}`

      await db.insert(platformExperiences).values({
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
      })
      inserted.push(map.title)
      console.log(`[fetch-fortnite] Inserted: ${map.title} (${map.code})`)
    }
  }

  return NextResponse.json({ ok: true, inserted: inserted.length, refreshed: refreshed.length, insertedMaps: inserted })
}
