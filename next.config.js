const createNextIntlPlugin = require('next-intl/plugin')
const { withSentryConfig } = require('@sentry/nextjs')
const createMDX = require('@next/mdx')

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
const withMDX = createMDX({
  options: {
    remarkPlugins: [require('remark-gfm').default],
    rehypePlugins: [require('rehype-slug').default],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.rawg.io' },
      { protocol: 'https', hostname: 'images.igdb.com' },
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      { protocol: 'https', hostname: 'img2.fortnitemaps.com' },
      { protocol: 'https', hostname: 'cdn2.unrealengine.com' },
      { protocol: 'https', hostname: '*.qstv.on.epicgames.com' },
      { protocol: 'https', hostname: 'tr.rbxcdn.com' },
    ],
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options',             value: 'DENY' },
      { key: 'X-Content-Type-Options',      value: 'nosniff' },
      { key: 'Referrer-Policy',             value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy',          value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security',   value: 'max-age=63072000; includeSubDomains; preload' },
      {
        key: 'Content-Security-Policy',
        // unsafe-inline needed for next-intl hydration and JSON-LD script tags
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://plausible.io",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' media.rawg.io images.igdb.com cdn.sanity.io *.rbxcdn.com tr.rbxcdn.com img2.fortnitemaps.com cdn2.unrealengine.com *.qstv.on.epicgames.com assets.fortnitecreativehq.com *.fortnite.com data: blob:",
          "font-src 'self' data:",
          "connect-src 'self' https://*.api.sanity.io wss://*.api.sanity.io https://cdn.sanity.io https://plausible.io",
          "frame-ancestors 'none'",
        ].join('; '),
      },
    ]

    return [
      // Studio: no CSP — it makes many varied requests to sanity.io
      {
        source: '/studio(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
        ],
      },
      // All other routes: full security headers
      {
        source: '/((?!studio).*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = withSentryConfig(withMDX(withNextIntl(nextConfig)), {
  org: 'lumikin',
  project: 'lumikin',
  silent: true,         // suppress build output noise
  widenClientFileUpload: true,
  hideSourceMaps: true, // don't ship source maps to client bundle
  disableLogger: true,
  automaticVercelMonitors: false,
})
