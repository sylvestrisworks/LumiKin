import { sanityClient } from '@/sanity/lib/client'
import { groq } from 'next-sanity'

// Blog / News essays from Sanity. Until this they were unsurfaced on the
// homepage despite all carrying illustrated covers — the cover-story hero and
// the reading-room grid pull them in.
export type Post = {
  _id: string
  title: string
  slug: { current: string }
  excerpt?: string
  postType?: 'blog' | 'news'
  author?: string
  publishedAt?: string
  coverImage?: { asset: { _ref: string }; alt?: string } | null
}

const postFields = groq`
  _id, title, slug, excerpt, postType, author, publishedAt, coverImage
`

// Roblox/Fortnite essays earn the hero slot — they map to the highest-intent
// parent queries ("is Roblox safe?") and out-click a general games piece.
const HIGH_INTENT = /roblox|fortnite/i

// Single source of truth for "which essay leads the homepage": prefer an
// illustrated Roblox/Fortnite piece, else fall back to the newest illustrated
// post. The hero features it and the reading-room excludes it via this same fn.
export function pickFeaturedPost(posts: Post[]): Post | null {
  const withCover = posts.filter(p => p.coverImage?.asset)
  const highIntent = withCover.find(
    p => HIGH_INTENT.test(p.title) || HIGH_INTENT.test(p.slug?.current ?? ''),
  )
  return highIntent ?? withCover[0] ?? null
}

// Featured essay + the next N posts (excluding the featured one), for the hero
// and reading-room respectively, in a single round-trip.
export async function fetchPostsForHome(locale: string, rest = 3): Promise<{ featured: Post | null; more: Post[] }> {
  if (!sanityClient) return { featured: null, more: [] }
  const q = groq`
    *[_type == "post" && locale == $locale] | order(publishedAt desc) { ${postFields} }
  `
  const posts = (await sanityClient.fetch<Post[]>(q, { locale }).catch(() => [])) ?? []
  const featured = pickFeaturedPost(posts)
  const more = posts.filter(p => p._id !== featured?._id).slice(0, rest)
  return { featured, more }
}
