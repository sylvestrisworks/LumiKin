// RAWG API response types.
// Only the fields we actually use — RAWG returns more but we ignore the rest.

export type RawgPlatformEntry = {
  platform: { id: number; name: string; slug: string }
}

export type RawgGenre = {
  id: number
  name: string
  slug: string
}

export type RawgTag = {
  id: number
  name: string
  slug: string
  language: string
}

export type RawgEsrbRating = {
  id: number
  name: string
  slug: 'everyone' | 'everyone-10-plus' | 'teen' | 'mature' | 'adults-only'
} | null

// Returned by list endpoints (/games, /games?search=, /games?genres=)
export type RawgGameSummary = {
  id: number
  slug: string
  name: string
  background_image: string | null
  metacritic: number | null
  released: string | null  // "YYYY-MM-DD"
  playtime: number          // average hours
  platforms: RawgPlatformEntry[] | null
  genres: RawgGenre[]
  tags: RawgTag[] | null
  esrb_rating: RawgEsrbRating
  ratings_count: number
  added: number           // total RAWG users who added this game — best popularity proxy
}

// Returned by the single-game detail endpoint (/games/{id})
export type RawgGameDetail = RawgGameSummary & {
  description_raw: string | null
  developers: Array<{ id: number; name: string; slug: string }>
  publishers: Array<{ id: number; name: string; slug: string }>
}

export type RawgListResponse = {
  count: number
  next: string | null
  previous: string | null
  results: RawgGameSummary[]
}
