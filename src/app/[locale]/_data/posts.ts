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

// Latest essay that actually has a cover — the hero leads with its art, so an
// un-illustrated post would break the layout.
export async function fetchFeaturedPost(locale: string): Promise<Post | null> {
  if (!sanityClient) return null
  const q = groq`
    *[_type == "post" && locale == $locale && defined(coverImage.asset)]
      | order(publishedAt desc)[0]{ ${postFields} }
  `
  return sanityClient.fetch<Post | null>(q, { locale }).catch(() => null)
}

export async function fetchLatestPosts(locale: string, limit = 3): Promise<Post[]> {
  if (!sanityClient) return []
  const q = groq`
    *[_type == "post" && locale == $locale] | order(publishedAt desc) { ${postFields} }
  `
  const posts = await sanityClient.fetch<Post[]>(q, { locale }).catch(() => [])
  return (posts ?? []).slice(0, limit)
}

// Featured essay + the next N posts (excluding the featured one), for the hero
// and reading-room respectively, in a single round-trip.
export async function fetchPostsForHome(locale: string, rest = 3): Promise<{ featured: Post | null; more: Post[] }> {
  if (!sanityClient) return { featured: null, more: [] }
  const q = groq`
    *[_type == "post" && locale == $locale] | order(publishedAt desc) { ${postFields} }
  `
  const posts = (await sanityClient.fetch<Post[]>(q, { locale }).catch(() => [])) ?? []
  const featured = posts.find(p => p.coverImage?.asset) ?? null
  const more = posts.filter(p => p._id !== featured?._id).slice(0, rest)
  return { featured, more }
}
