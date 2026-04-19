import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'),
  title: 'LumiKin — See exactly how a game impacts your child',
  description:
    'Every LumiScore reveals the real impact of a game. We analyze skills built, habits formed, and recommend a daily screen time limit that actually makes sense.',
  openGraph: { siteName: 'LumiKin', type: 'website' },
}

// Root layout — minimal shell. Locale-specific layout lives in [locale]/layout.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body className={`${inter.variable} ${plusJakarta.variable} ${inter.className} antialiased bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
          {children}
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  )
}
