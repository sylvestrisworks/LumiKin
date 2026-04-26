import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={`${inter.className} antialiased bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
          {children}
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
        <Script
          id="plausible-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`,
          }}
        />
        <Script
          strategy="afterInteractive"
          src="https://plausible.io/js/pa--Dusr9peIPVfgU_4d8QUi.js"
          defer
        />
      </body>
    </html>
  )
}
