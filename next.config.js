/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'media.rawg.io' },
      { hostname: 'images.igdb.com' },
    ],
  },
  // On Vercel, VERCEL_URL is injected automatically (e.g. curascore.vercel.app
  // for production, curascore-abc123-sylvestrisworks.vercel.app for previews).
  // This ensures NextAuth redirects land on the correct host in all environments.
  env: {
    NEXTAUTH_URL: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL,
  },
}
module.exports = nextConfig
