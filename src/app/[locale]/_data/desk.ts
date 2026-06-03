import { sanityClient } from '@/sanity/lib/client'
import { groq } from 'next-sanity'

export type DeskGuide = {
  _id: string
  title: string
  slug: { current: string }
  excerpt?: string
  category?: string
  publishedAt?: string
  coverImage?: { asset: { _ref: string }; alt?: string } | null
}

// GROQ slice operator only takes literals; we slice in JS after fetch so the
// homepage caller can tune `limit` without templating queries.
const deskQuery = groq`
  *[_type == "guide" && locale == $locale] | order(publishedAt desc) {
    _id, title, slug, excerpt, coverImage, category, publishedAt
  }
`

export async function fetchDeskGuides(locale: string, limit = 3): Promise<DeskGuide[]> {
  if (!sanityClient) return []
  const guides = await sanityClient
    .fetch<DeskGuide[]>(deskQuery, { locale })
    .catch(() => [])
  return (guides ?? []).slice(0, limit)
}
