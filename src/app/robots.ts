import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'

// Bot policy — robots.txt is voluntary; the actual block is in middleware.ts.
// Allow:    search engines + AI tools that cite sources (drives traffic) and
//           AI training crawlers (drives discoverability in AI surfaces).
// Disallow: third-party SEO scrapers (Ahrefs/Semrush/etc.) — pure cost, no upside.
// Default:  every other bot inherits the '*' rule (allow with private-area carve-outs).

const ALLOW_BOTS = [
  // Traditional search
  'Googlebot',
  'Bingbot',
  'DuckDuckBot',
  'Applebot',
  // AI retrieval (cites sources → sends traffic)
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Perplexity-User',
  // AI training (drives discoverability inside the assistants)
  'ClaudeBot',
  'anthropic-ai',
  'GPTBot',
  'Google-Extended',
  'Applebot-Extended',
  'Meta-ExternalAgent',
  'Amazonbot',
  'CCBot',
] as const

const DISALLOW_BOTS = [
  'AhrefsBot',
  'SemrushBot',
  'DotBot',
  'MJ12bot',
  'DataForSeoBot',
  'Bytespider',
  'PetalBot',
  'SeznamBot',
] as const

const PRIVATE_PATHS = [
  '/*/dashboard',
  '/*/library',
  '/*/account',
  '/*/settings',
  '/*/notifications',
  '/*/login',
  '/*/review',
  '/api/',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...ALLOW_BOTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: PRIVATE_PATHS,
      })),
      ...DISALLOW_BOTS.map((userAgent) => ({
        userAgent,
        disallow: '/',
      })),
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
