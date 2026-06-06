import { groq } from 'next-sanity'

// ── Guides ─────────────────────────────────────────────────────────────────

export const guidesQuery = groq`
  *[_type == "guide" && locale == $locale] | order(publishedAt desc) {
    _id, title, slug, excerpt, coverImage, category, publishedAt
  }
`

// Prefer the requested locale, fall back to English when no translation exists
// (de/fr/es have no Sanity translations yet — they must still render the EN doc).
export const guideBySlugQuery = groq`
  *[_type == "guide" && slug.current == $slug && locale in [$locale, "en"]]
    | order(select(locale == $locale => 0, 1))[0] {
    _id, title, slug, excerpt, coverImage, body, category, publishedAt,
    seoTitle, seoDescription
  }
`

// ── Posts (blog + news) ────────────────────────────────────────────────────

export const postsQuery = groq`
  *[_type == "post" && locale == $locale] | order(publishedAt desc) {
    _id, title, slug, postType, excerpt, coverImage, author, publishedAt
  }
`

export const postBySlugQuery = groq`
  *[_type == "post" && slug.current == $slug && locale in [$locale, "en"]]
    | order(select(locale == $locale => 0, 1))[0] {
    _id, title, slug, postType, excerpt, coverImage, body, author, publishedAt,
    seoTitle, seoDescription
  }
`

// ── FAQs ───────────────────────────────────────────────────────────────────

export const faqsQuery = groq`
  *[_type == "faqItem" && locale == $locale] | order(order asc, _createdAt asc) {
    _id, question, answer, category
  }
`

// ── Learn hub ──────────────────────────────────────────────────────────────

export const learnHubQuery = groq`
  {
    "featuredGuides": *[_type == "guide" && locale == $locale] | order(publishedAt desc) [0...3] {
      _id, title, slug, excerpt, coverImage, category, publishedAt
    },
    "recentPosts": *[_type == "post" && locale == $locale] | order(publishedAt desc) [0...4] {
      _id, title, slug, postType, excerpt, coverImage, author, publishedAt
    },
    "faqCount": count(*[_type == "faqItem" && locale == $locale])
  }
`

// ── Sitemap slugs ──────────────────────────────────────────────────────────

export const allGuideSlugsQuery = groq`
  *[_type == "guide"] { "slug": slug.current, locale, _updatedAt }
`

export const allPostSlugsQuery = groq`
  *[_type == "post"] { "slug": slug.current, locale, _updatedAt }
`
