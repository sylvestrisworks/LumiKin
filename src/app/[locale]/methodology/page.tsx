import type { Metadata } from 'next'
import { Lora } from 'next/font/google'
import { notFound } from 'next/navigation'
import { getMethodologyVersion, CURRENT_METHODOLOGY_VERSION } from '@/lib/methodology'
import { VERSION_COMPONENTS } from '@/lib/methodology-versions'
import TableOfContents from './_components/TableOfContents'
import VersionBanner from './_components/VersionBanner'

export const dynamic = 'force-dynamic'

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})

export function generateMetadata(): Metadata {
  return {
    title: `LumiKin Methodology v${CURRENT_METHODOLOGY_VERSION} — PlaySmart rating framework`,
    description:
      'The full PlaySmart scoring methodology: how LumiKin rates games on cognitive benefits, social-emotional development, dopamine manipulation design, and monetization pressure.',
  }
}

export default async function MethodologyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ version?: string }>
}) {
  const { locale } = await params
  const { version: versionParam } = await searchParams
  const entry = getMethodologyVersion(versionParam)

  if (!entry) notFound()

  const MDXContent = VERSION_COMPONENTS[entry.version]
  if (!MDXContent) notFound()

  const publishedDate = new Date(entry.publishedDate).toLocaleDateString('en', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const pdfPath = `/lumikin-methodology-v${entry.version}.pdf`

  return (
    <div className={`${lora.variable} bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100`}>
      <VersionBanner version={entry} locale={locale} />

      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* ── Document header (screen) ─────────────────────────────────────── */}
        <div className="mb-12 pb-8 border-b border-zinc-200 dark:border-zinc-800 print:hidden">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
            LumiKin · PlaySmart Framework
          </p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            Methodology
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <span>Version {entry.version}</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span>Published {publishedDate}</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <a href="#changelog" className="underline underline-offset-2 hover:no-underline hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
              Changelog
            </a>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <a
              href={pdfPath}
              download
              className="underline underline-offset-2 hover:no-underline hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              Download PDF
            </a>
          </div>
        </div>

        {/* ── Document cover (print / PDF only) ────────────────────────────── */}
        <div className="hidden print:block mb-12 pb-8" style={{ borderBottom: '2px solid #000' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lumikin-logo.svg" alt="LumiKin" style={{ height: 28, width: 'auto' }} />
          <div style={{ marginTop: '1.5rem', fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', fontFamily: 'system-ui, sans-serif' }}>
            Methodology
          </div>
          <div style={{ marginTop: '0.25rem', fontSize: '1rem', fontWeight: 400, fontFamily: 'system-ui, sans-serif', color: '#71717a' }}>
            Version {entry.version} · Published {publishedDate}
          </div>
          <div style={{ marginTop: '0.25rem', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif', color: '#a1a1aa' }}>
            lumikin.org/methodology
          </div>
        </div>

        {/* ── Two-column layout ───────────────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-16 xl:gap-20">

          {/* Sticky ToC — desktop only, hidden on print */}
          <aside className="hidden lg:block print:hidden">
            <div className="sticky top-20">
              <TableOfContents entries={entry.toc} />
            </div>
          </aside>

          {/* Prose content */}
          <article className="methodology-prose min-w-0">
            <MDXContent />
          </article>
        </div>
      </div>

      {/* ── Prose styles scoped to this page ──────────────────────────────── */}
      <style>{`
        .methodology-prose {
          font-family: var(--font-lora), Georgia, serif;
          font-size: 1.0625rem;
          line-height: 1.75;
          color: inherit;
        }
        .methodology-prose h2 {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 1.375rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.25;
          margin-top: 3rem;
          margin-bottom: 1rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgb(228 228 231);
          scroll-margin-top: 5rem;
        }
        @media (prefers-color-scheme: dark) {
          .methodology-prose h2 { border-top-color: rgb(39 39 42); }
        }
        .dark .methodology-prose h2 { border-top-color: rgb(39 39 42); }
        .methodology-prose h2:first-child {
          margin-top: 0;
          padding-top: 0;
          border-top: none;
        }
        .methodology-prose h3 {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 1.0625rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 0.5rem;
          scroll-margin-top: 5rem;
        }
        .methodology-prose p {
          margin-bottom: 1.25rem;
        }
        .methodology-prose strong {
          font-weight: 700;
          color: inherit;
        }
        .methodology-prose a {
          text-decoration: underline;
          text-underline-offset: 3px;
          color: inherit;
        }
        .methodology-prose a:hover {
          text-decoration: none;
        }
        .methodology-prose ul, .methodology-prose ol {
          padding-left: 1.5rem;
          margin-bottom: 1.25rem;
        }
        .methodology-prose li {
          margin-bottom: 0.375rem;
        }
        .methodology-prose table {
          width: 100%;
          border-collapse: collapse;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
          margin-top: 0.5rem;
        }
        .methodology-prose th {
          text-align: left;
          font-weight: 600;
          padding: 0.5rem 0.75rem;
          border-bottom: 2px solid rgb(228 228 231);
          color: rgb(113 113 122);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .dark .methodology-prose th { border-bottom-color: rgb(63 63 70); color: rgb(113 113 122); }
        .methodology-prose td {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid rgb(244 244 245);
          vertical-align: top;
        }
        .dark .methodology-prose td { border-bottom-color: rgb(39 39 42); }
        .methodology-prose tr:last-child td { border-bottom: none; }
        .methodology-prose code {
          font-family: ui-monospace, monospace;
          font-size: 0.875em;
          background: rgb(244 244 245);
          padding: 0.15em 0.4em;
          border-radius: 4px;
        }
        .dark .methodology-prose code { background: rgb(39 39 42); }
        @media print {
          .methodology-prose { font-size: 11pt; }
          .methodology-prose h2 { font-size: 14pt; margin-top: 2rem; }
          .methodology-prose h3 { font-size: 12pt; }
        }
      `}</style>
    </div>
  )
}
