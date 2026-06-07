import { permanentRedirect } from 'next/navigation'

// /discover has been merged into /browse, which now carries the carousels,
// age/platform pickers, and the editorial panels (LumiScore scale, catalogue
// stats, Safe Swap, research facts) that used to live here. Permanent redirect
// preserves search equity for the old URL.
export default async function DiscoverPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  permanentRedirect(`/${locale}/browse`)
}
