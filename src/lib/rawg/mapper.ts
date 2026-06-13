// Maps RAWG API responses to our games table insert shape.

import type { games } from '@/lib/db/schema'
import type { RawgEsrbRating, RawgGameDetail, RawgGameSummary, RawgTag } from './types'

type GameInsert = typeof games.$inferInsert

// ─── ESRB rating ──────────────────────────────────────────────────────────────

const ESRB_MAP: Record<string, string> = {
  'everyone':          'E',
  'everyone-10-plus':  'E10+',
  'teen':              'T',
  'mature':            'M',
  'adults-only':       'AO',
}

export function mapEsrbRating(rating: RawgEsrbRating): string | null {
  return rating ? (ESRB_MAP[rating.slug] ?? null) : null
}

// ─── Risk-flag tag extraction ─────────────────────────────────────────────────
//
// RAWG game tags often signal monetization/engagement mechanics. We scan both
// the tag slug and the lowercased tag name so variant spellings are caught.

type RiskFlags = Pick<
  GameInsert,
  'hasMicrotransactions' | 'hasLootBoxes' | 'hasBattlePass' | 'hasSubscription'
>

const TAG_SIGNALS: Record<keyof RiskFlags, string[]> = {
  hasMicrotransactions: [
    'microtransactions',
    'micro-transactions',
    'in-app-purchases',
    'in-app purchases',
    'free-to-play',
    'free to play',
    'freemium',
    'pay-to-play',
    'pay to play',
  ],
  hasLootBoxes: [
    'loot-boxes',
    'loot-box',
    'loot boxes',
    'lootbox',
    'lootboxes',
    'gacha',
    'randomized-rewards',
    'randomized rewards',
  ],
  hasBattlePass: [
    'battle-pass',
    'battle pass',
    'battlepass',
    'season-pass',
    'season pass',
    'seasonal-pass',
  ],
  hasSubscription: [
    'subscription',
    'subscription-service',
    'subscription required',
    'subscription-required',
  ],
}

export function extractRiskFlags(tags: RawgTag[]): RiskFlags {
  const slugs = new Set(tags.map((t) => t.slug.toLowerCase()))
  const names = new Set(tags.map((t) => t.name.toLowerCase()))
  const has = (signals: string[]) =>
    signals.some((s) => slugs.has(s) || names.has(s))

  return {
    hasMicrotransactions: has(TAG_SIGNALS.hasMicrotransactions),
    hasLootBoxes:         has(TAG_SIGNALS.hasLootBoxes),
    hasBattlePass:        has(TAG_SIGNALS.hasBattlePass),
    hasSubscription:      has(TAG_SIGNALS.hasSubscription),
  }
}

// ─── Developer attribution ─────────────────────────────────────────────────────
//
// RAWG's `developers` array lists every studio credited on a title, in no
// reliable order — for Minecraft the first entry is "4J Studios" (the console
// porting house), not Mojang. Blindly taking developers[0] mis-attributes any
// title that was ported or co-developed.
//
// We prefer the first developer that is NOT a known porting / co-development
// house. If every credited developer is a porting house (or none are listed),
// we fall back to the publisher, which is the original studio far more often
// than a porting house is.

const PORTING_STUDIOS = new Set([
  '4j studios', 'iron galaxy', 'iron galaxy studios', 'aspyr', 'aspyr media',
  'bluepoint games', 'virtuos', 'mass media', 'mass media inc', 'shiver entertainment',
  'panic button', 'panic button games', 'feral interactive', 'd3t', 'tantalus media',
  'tantalus', 'qloc', 'nixxes software', 'climax studios', 'abstraction games',
  'straight right', 'blitworks', 'sickhead games', 'code mystics', 'mercenary technology',
  'grip digital', 'saber interactive', 'shin\'en multimedia', 'fun labs', 'turn me up games',
])

export const isPortingStudio = (name: string | null | undefined): boolean =>
  !!name && PORTING_STUDIOS.has(name.trim().toLowerCase())

/**
 * Choose the primary developer for a title, skipping known porting / co-dev
 * houses and falling back to the publisher when attribution is ambiguous.
 */
export function pickPrimaryDeveloper(
  developers: Array<{ name: string }> | null | undefined,
  publishers: Array<{ name: string }> | null | undefined,
): string | null {
  const devNames = (developers ?? []).map((d) => d.name).filter(Boolean)
  const pubName  = (publishers ?? [])[0]?.name ?? null

  if (devNames.length === 0) return pubName
  if (devNames.length === 1) return devNames[0]

  const primary = devNames.find((n) => !isPortingStudio(n))
  if (primary) return primary

  // Every credited developer is a porting house → prefer the publisher.
  return pubName ?? devNames[0]
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

// Maps a RAWG list-endpoint summary (no description/developer/publisher)
export function mapSummaryToInsert(game: RawgGameSummary): GameInsert {
  const tags = game.tags ?? []
  return {
    rawgId:             game.id,
    slug:               game.slug,
    title:              game.name,
    backgroundImage:    game.background_image,
    metacriticScore:    game.metacritic ?? null,
    rawgAdded:          game.added > 0 ? game.added : null,
    avgPlaytimeHours:   game.playtime > 0 ? game.playtime : null,
    releaseDate:        game.released ? new Date(game.released) : null,
    genres:             game.genres.map((g) => g.name),
    platforms:          (game.platforms ?? []).map((p) => p.platform.name),
    esrbRating:         mapEsrbRating(game.esrb_rating),
    ...extractRiskFlags(tags),
    metadataLastSynced: new Date(),
    updatedAt:          new Date(),
  }
}

// Maps a RAWG detail-endpoint response (full data including description etc.)
export function mapDetailToInsert(game: RawgGameDetail): GameInsert {
  return {
    ...mapSummaryToInsert(game),
    description: game.description_raw ?? null,
    developer:   pickPrimaryDeveloper(game.developers, game.publishers),
    publisher:   game.publishers[0]?.name ?? null,
  }
}
