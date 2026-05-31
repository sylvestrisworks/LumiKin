// Maps DB genre strings (English, as ingested from RAWG) to stable kebab keys
// used in the i18n `genres` namespace. Keys are intentionally lowercase-kebab
// to match the convention everywhere else in messages/*.json.
//
// Unmapped genres (rare ones in the long tail) fall back to the source string.

const GENRE_KEY_MAP: Record<string, string> = {
  'Action':                'action',
  'Indie':                 'indie',
  'Adventure':             'adventure',
  'Casual':                'casual',
  'Educational':           'educational',
  'Fighting':              'fighting',
  'Family':                'family',
  'Simulation':            'simulation',
  'Arcade':                'arcade',
  'Strategy':              'strategy',
  'Puzzle':                'puzzle',
  'RPG':                   'rpg',
  'Sports':                'sports',
  'Card':                  'card',
  'Racing':                'racing',
  'Platformer':            'platformer',
  'Shooter':               'shooter',
  'Board Games':           'boardGames',
  'Massively Multiplayer': 'mmo',
}

/** Returns the i18n key for a genre, or null if unmapped (caller falls back to the source). */
export function genreKey(genre: string): string | null {
  return GENRE_KEY_MAP[genre] ?? null
}

/**
 * Resolves a genre string to its locale-translated label.
 * Pass a `t` from `useTranslations('genres')` (client) or `getTranslations('genres')` (server).
 */
export function localizeGenre(genre: string, t: (key: string) => string): string {
  const key = genreKey(genre)
  if (!key) return genre
  try {
    return t(key)
  } catch {
    return genre
  }
}
