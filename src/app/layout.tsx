import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Curascore by Good Game Parent — See exactly how a game impacts your child',
  description:
    'Every Curascore reveals the real impact of a game. We analyze skills built, habits formed, and recommend a daily screen time limit that actually makes sense.',
  openGraph: { siteName: 'Curascore by Good Game Parent', type: 'website' },
}

// Root layout — minimal shell. Locale-specific layout lives in [locale]/layout.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
