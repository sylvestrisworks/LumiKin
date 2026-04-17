const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'media.rawg.io' },
      { hostname: 'images.igdb.com' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.lumikin.org' }],
        destination: 'https://lumikin.org/:path*',
        permanent: true,
      },
    ]
  },
}

module.exports = withNextIntl(nextConfig)
