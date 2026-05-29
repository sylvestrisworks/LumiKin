import {
  BigScore,
  EditorialIcon,
  ListingCard,
  type ListingCardData,
  Masthead,
  Rosette,
  ScoreBar,
  ScoreTable,
  type ScoreRow,
  SearchInput,
} from '@/components/editorial'
import DesignPreviewShell from './DesignPreviewShell'

export const metadata = {
  title: 'Design preview — editorial direction',
  robots: { index: false, follow: false },
}

const BENEFITS: ScoreRow[] = [
  { code: 'B1', label: 'Creativity',      value: 0.82 },
  { code: 'B2', label: 'Problem solving', value: 0.71 },
  { code: 'B3', label: 'Teamwork',        value: 0.54 },
]

const RISKS: ScoreRow[] = [
  { code: 'R1', label: 'Addictive mechanics', value: 0.22 },
  { code: 'R2', label: 'Monetization',        value: 0.12 },
  { code: 'R3', label: 'FOMO',                value: 0.08 },
]

// ─── Listing card data ───────────────────────────────────────────────────────

const LISTING_CARDS: ListingCardData[] = [
  {
    title: 'Minecraft',
    kicker: 'Review · Multi-platform',
    dek: 'The sandbox that taught a generation to build — and still does.',
    bds: 0.71, ris: 0.18, minutes: 90, ages: '8+',
    photoFrom: '#3F5A2E', photoTo: '#7C8F4E',
  },
  {
    title: 'Stardew Valley',
    kicker: 'Review · Switch · PC',
    dek: 'A small farm, a slow clock, and not a single battle pass in sight.',
    bds: 0.66, ris: 0.12, minutes: 90, ages: '10+',
    photoFrom: '#6B4A2B', photoTo: '#C49A6C',
  },
  {
    title: 'Fortnite',
    kicker: 'Review · Multi-platform',
    dek: 'Genuine social joy, wrapped in some of the most aggressive monetization on the market.',
    bds: 0.42, ris: 0.68, minutes: 30, ages: '13+',
    photoFrom: '#3A1E5C', photoTo: '#A04BBF',
  },
]

// ─── Detail panel ────────────────────────────────────────────────────────────

function DetailPanel() {
  return (
    <article>
      {/* Treated hero photo */}
      <div
        className="aspect-[21/9] w-full"
        style={{ background: 'linear-gradient(135deg, #3F5A2E, #7C8F4E)' }}
        aria-hidden
      />
      <p className="font-serif italic text-sm text-muted mt-2 mb-12">
        Photograph · A Minecraft world built by a nine-year-old. <span className="not-italic">Credit: Mojang.</span>
      </p>

      {/* Title block */}
      <div className="max-w-prose">
        <p
          className="text-kicker uppercase font-semibold text-accent mb-4"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          Review · Multi-platform · Sandbox
        </p>
        <h2 className="font-serif text-display-sm tracking-tight mb-5" style={{ fontOpticalSizing: 'auto' }}>
          Minecraft
        </h2>
        <p className="font-serif text-xl italic text-muted leading-snug mb-6">
          The sandbox that taught a generation to build — and still does.
        </p>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="font-sans italic">By the LumiKin editors</span>
          <span className="text-rule">·</span>
          <time className="font-sans tabular-nums">Updated 17 May 2026</time>
          <span className="text-rule">·</span>
          <span
            className="font-sans uppercase tracking-wider text-xs"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            PS5 · Xbox · Switch · PC · Mobile
          </span>
        </div>
      </div>

      {/* Verdict strip */}
      <div className="mt-12 border-t-2 border-ink border-b border-b-ink py-6 grid grid-cols-3 gap-8">
        <div>
          <p
            className="text-kicker uppercase text-muted mb-1"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            LumiKin verdict
          </p>
          <p className="font-serif text-2xl tracking-tight">Recommended</p>
        </div>
        <div className="border-l border-ink/30 pl-8">
          <p
            className="text-kicker uppercase text-muted mb-1"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Daily limit
          </p>
          <p className="font-serif text-4xl tracking-tight tabular-nums">90<span className="text-xl text-muted"> min</span></p>
        </div>
        <div className="border-l border-ink/30 pl-8">
          <p
            className="text-kicker uppercase text-muted mb-1"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Age guidance
          </p>
          <p className="font-serif text-4xl tracking-tight tabular-nums">8+</p>
        </div>
      </div>

      {/* Score tables */}
      <div className="mt-12 grid md:grid-cols-2 gap-12">
        <ScoreTable title="Developmental benefits"  rows={BENEFITS} tone="ink" />
        <ScoreTable title="Design risks"            rows={RISKS}    tone="accent" />
      </div>

      {/* Pull-quote — replaces the "parent tip" callout */}
      <figure className="mt-16 max-w-prose ml-12 relative">
        <span
          aria-hidden
          className="absolute -left-12 -top-4 font-serif text-9xl leading-none text-accent select-none"
          style={{ fontOpticalSizing: 'auto' }}
        >
          “
        </span>
        <blockquote className="font-serif text-2xl italic leading-snug text-ink">
          Sit alongside for the first hour. Minecraft rewards patience, and a child who hears
          “show me what you built” at the end of a session keeps building for years.
        </blockquote>
        <figcaption
          className="mt-4 text-kicker uppercase text-muted"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          Parent tip · The LumiKin editors
        </figcaption>
      </figure>

      {/* Heads-up — replaces colored alert box */}
      <section className="mt-16 max-w-prose">
        <p
          className="text-kicker uppercase font-semibold text-accent mb-4"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          Heads up
        </p>
        <ul className="border-t border-ink">
          {[
            ['Marketplace purchases', 'Real-money currency (Minecoins) for skins and worlds. No loot boxes.'],
            ['Stranger chat', 'Public Realms and servers allow voice/text chat. Disabled by default on child accounts.'],
            ['Subscription pressure', 'Realms ($8/mo) is optional but heavily promoted in-game.'],
          ].map(([label, body]) => (
            <li key={label} className="border-b border-ink/20 py-4 grid grid-cols-[10rem_1fr] gap-6">
              <span
                className="text-sm text-muted uppercase tracking-wider"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {label}
              </span>
              <span className="font-serif text-base text-ink leading-snug">{body}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Meta footer */}
      <div className="mt-16 border-t border-ink pt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 text-sm font-sans">
        <span>
          <span
            className="text-kicker uppercase text-muted mr-2"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Base price
          </span>
          <span className="tabular-nums text-ink">$29.99</span>
        </span>
        <span>
          <span
            className="text-kicker uppercase text-muted mr-2"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Avg playtime
          </span>
          <span className="tabular-nums text-ink">~120 h</span>
        </span>
        <span className="ml-auto italic text-muted">
          <a href="#" className="underline decoration-rule hover:text-accent hover:decoration-accent">How scores are calculated →</a>
        </span>
      </div>
    </article>
  )
}

// ─── Detail panel · v2 — Monocle-leaning ──────────────────────────────────────

type V2Variant = 'standard' | 'bundled' | 'pending'

function DetailPanelV2({ variant = 'standard' }: { variant?: V2Variant } = {}) {
  const BDS = 0.71
  const RIS = 0.18

  const kids = [
    { name: 'Mia',   age: 9, ok: true  },
    { name: 'Oscar', age: 6, ok: false },
  ]

  const showRosette = variant !== 'pending'

  return (
    <article>
      {/* Hero row: photo (left, 2/3) + rosette stamp + title (right, 1/3) */}
      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-2 relative">
          <div
            className="aspect-[16/10] w-full"
            style={{
              background: 'linear-gradient(135deg, #2E4818 0%, #5C7C2E 45%, #A0A45B 100%)',
              filter: 'saturate(1.1) contrast(1.05)',
            }}
            aria-hidden
          />
          {/* Rosette · md+: pinned to photo corner; mobile renders a smaller stamp above the title */}
          {showRosette && (
            <div className="hidden md:block absolute -top-4 -right-4 md:-right-10">
              <Rosette variant="recommends" size={140} rotate={-7} />
            </div>
          )}
          <p className="font-serif italic text-sm text-muted mt-2">
            Photograph · A Minecraft world built by a nine-year-old. <span className="not-italic">Credit: Mojang.</span>
          </p>
        </div>

        <div className="md:col-span-1 pt-2">
          {/* Mobile-only rosette stamp — shrinks + rotates less for the tighter context */}
          {showRosette && (
            <div className="md:hidden mb-4 -mt-2">
              <Rosette variant="recommends" size={88} rotate={-3} />
            </div>
          )}
          <p
            className="text-kicker uppercase font-semibold text-accent mb-3"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Review · Sandbox · Multi-platform
          </p>
          <h2 className="font-serif text-display-sm tracking-tight mb-4 leading-[1.02]" style={{ fontOpticalSizing: 'auto' }}>
            Minecraft
          </h2>
          <p className="font-serif text-lg italic text-muted leading-snug mb-4">
            The sandbox that taught a generation to build — and still does.
          </p>
          <div className="text-sm text-muted space-y-1">
            <p className="font-sans italic">By the LumiKin editors</p>
            <p className="font-sans tabular-nums">Updated 17 May 2026 · 4 min read</p>
            <p
              className="font-sans uppercase tracking-wider text-xs"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              PS5 · Xbox · Switch · PC · Mobile
            </p>
          </div>
        </div>
      </div>

      {/* Conditional editorial banners — sit between the hero block and the verdict strip.
          Hairline-bounded, no fills. Accent kicker carries the warning weight. */}
      {variant === 'bundled' && (
        <section className="mt-12 border-t border-b border-ink py-4 max-w-5xl">
          <p
            className="text-kicker uppercase font-semibold text-accent mb-2"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Bundled online — know the live-service layer
          </p>
          <p className="font-serif italic text-base leading-snug text-ink/90">
            The base price unlocks the singleplayer story. The connected online mode is
            its own product, with its own monetization and chat layer — we score those
            separately.{' '}
            <a href="#" className="not-italic underline decoration-rule hover:text-accent hover:decoration-accent">
              Read how we handle bundled-online games →
            </a>
          </p>
        </section>
      )}
      {variant === 'pending' && (
        <section className="mt-12 border-t border-b border-ink py-4 max-w-5xl">
          <p
            className="text-kicker uppercase font-semibold text-muted mb-2"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Under review · provisional scores
          </p>
          <p className="font-serif italic text-base leading-snug text-ink/90">
            We&rsquo;re still verifying this experience — scores below are provisional.
            Confidence: <span className="not-italic tabular-nums">0.42</span>.
          </p>
        </section>
      )}

      {/* The verdict — the moment. Big colored numerals do the talking.
          Mobile: 2×2 grid with horizontal rule between rows, vertical rule between cells.
          Desktop: 1×4 row with three vertical rules. */}
      <div className="mt-12 md:mt-16 border-t-2 border-ink border-b border-b-ink py-6 md:py-8 grid grid-cols-2 md:grid-cols-4 gap-x-6 md:gap-x-8 gap-y-6 md:gap-y-0 items-end">
        <BigScore label="Growth (BDS)"     value={BDS} tone="ivy" />
        <div className="border-l border-ink/30 pl-6 md:pl-8">
          <BigScore label="Risk (RIS)"     value={RIS} tone="accent" />
        </div>
        <div className="border-t md:border-t-0 md:border-l border-ink/30 pt-6 md:pt-0 md:pl-8">
          <p
            className="text-kicker uppercase text-muted mb-1"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Daily limit
          </p>
          <p className="font-serif text-5xl tracking-tight tabular-nums leading-none mt-1">
            90<span className="text-2xl text-muted ml-1">min</span>
          </p>
        </div>
        <div className="border-t md:border-t-0 border-l border-ink/30 pt-6 md:pt-0 pl-6 md:pl-8">
          <p
            className="text-kicker uppercase text-muted mb-1"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Age guidance
          </p>
          <p className="font-serif text-5xl tracking-tight tabular-nums leading-none mt-1">8+</p>
        </div>
      </div>

      {/* Per-child line — editorial italic, glyphs in ivy/accent */}
      <p className="mt-6 font-serif italic text-lg text-ink/90">
        {kids.map((k, i) => (
          <span key={k.name}>
            {i > 0 && <span className="text-rule mx-3">·</span>}
            <span className={k.ok ? 'text-ivy not-italic font-semibold mr-1' : 'text-accent not-italic font-semibold mr-1'}>
              {k.ok ? '✓' : '✗'}
            </span>
            <span>{k.name} <span className="text-muted not-italic text-base">({k.age})</span></span>
          </span>
        ))}
        <span className="text-muted not-italic text-sm ml-4">— recommended age {' '}8+</span>
      </p>

      {/* Main content: scores left (2/3), handwritten margin annotation right (1/3) */}
      <div className="mt-16 grid md:grid-cols-3 gap-12">
        {/* Score tables */}
        <div className="md:col-span-2 space-y-12">
          <ScoreTable title="Developmental benefits"  rows={BENEFITS} tone="ink" />
          <ScoreTable title="Design risks"            rows={RISKS}    tone="accent" />

          {/* Editorial tabs — text labels, hairline underline on active.
              Horizontal scroll on mobile preserves the typographic strip metaphor. */}
          <div className="border-t border-ink mt-8 -mx-8 md:mx-0 overflow-x-auto">
            <div className="flex gap-6 md:gap-8 -mt-px px-8 md:px-0 whitespace-nowrap">
              <button
                className="font-sans text-kicker uppercase font-semibold py-4 border-t-2 border-ink -mt-px text-ink"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                Simplified
              </button>
              <button
                className="font-sans text-kicker uppercase py-4 text-muted hover:text-ink"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                Full scores (45 items)
              </button>
              <button
                className="font-sans text-kicker uppercase py-4 text-muted hover:text-ink"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                Debate transcript
              </button>
            </div>
          </div>
        </div>

        {/* Margin annotation — handwritten parent tip.
            Mobile: solid accent left rule (2px) so the note reads as a deliberate margin.
            Desktop: dashed ink/40 left rule (1px) — quieter, more sidebar. */}
        <aside className="md:col-span-1 pl-4 md:pl-6 border-l-2 md:border-l border-accent md:border-ink/40 [border-left-style:solid] md:[border-left-style:dashed]">
          <div className="flex items-center gap-2 mb-3">
            {/* tiny ink-line lightbulb */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink">
              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1.2 1.5 1.5 2.5h5c.3-1 .8-1.8 1.5-2.5A6 6 0 0 0 12 3z" />
            </svg>
            <p
              className="text-kicker uppercase font-semibold text-ink"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              A note from the editors
            </p>
          </div>
          <p className="font-hand text-2xl leading-snug text-ink/90" style={{ transform: 'rotate(-0.4deg)' }}>
            Sit alongside for the first hour. Minecraft rewards patience, and a
            child who hears <em>“show me what you built”</em> at the end of a
            session keeps building for years.
          </p>
          <p
            className="mt-4 text-kicker uppercase text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            — The LumiKin editors
          </p>
        </aside>
      </div>

      {/* Heads-up — small line icons in margin, ink-on-paper rows.
          Mobile: icon + label on one row, body wraps below.
          Desktop: 3-column grid (icon · label · body). */}
      <section className="mt-16 max-w-5xl">
        <p
          className="text-kicker uppercase font-semibold text-accent mb-4"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          Heads up
        </p>
        <ul className="border-t border-ink">
          {([
            {
              icon: 'marketplace' as const,
              tone: 'warm' as const,
              label: 'Marketplace purchases',
              body: 'Real-money currency (Minecoins) for skins and worlds. No loot boxes.',
            },
            {
              icon: 'chat' as const,
              tone: 'accent' as const,
              label: 'Stranger chat',
              body: 'Public Realms and servers allow voice/text chat. Disabled by default on child accounts.',
            },
            {
              icon: 'subscription' as const,
              tone: 'warm' as const,
              label: 'Subscription pressure',
              body: 'Realms ($8/mo) is optional but heavily promoted in-game.',
            },
            {
              icon: 'lootBox' as const,
              tone: 'accent' as const,
              label: 'Loot boxes',
              body: 'None in this title — Mojang has held that line since launch.',
            },
            {
              icon: 'timePressure' as const,
              tone: 'warm' as const,
              label: 'Time pressure',
              body: 'No battle pass, no FOMO clock — sessions end on the child’s terms.',
            },
            {
              icon: 'dataCollection' as const,
              tone: 'warm' as const,
              label: 'Data collection',
              body: 'Microsoft account required online; child accounts limit telemetry by default.',
            },
          ]).map((row) => (
            <li
              key={row.label}
              className="border-b border-ink/20 py-4 grid grid-cols-[1.5rem_1fr] md:grid-cols-[2rem_11rem_1fr] gap-x-4 gap-y-2 items-start"
            >
              <span className={row.tone === 'accent' ? 'text-accent mt-0.5' : 'text-warm mt-0.5'}>
                <EditorialIcon name={row.icon} />
              </span>
              <span
                className="text-sm text-ink uppercase tracking-wider"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {row.label}
              </span>
              <span className="col-span-2 md:col-span-1 font-serif text-base text-ink leading-snug">
                {row.body}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Meta footer */}
      <div className="mt-16 border-t border-ink pt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 text-sm font-sans">
        <span>
          <span
            className="text-kicker uppercase text-muted mr-2"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Base price
          </span>
          <span className="tabular-nums text-ink">$29.99</span>
        </span>
        <span>
          <span
            className="text-kicker uppercase text-muted mr-2"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Avg playtime
          </span>
          <span className="tabular-nums text-ink">~120 h</span>
        </span>
        <span>
          <span
            className="text-kicker uppercase text-muted mr-2"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Reviewed
          </span>
          <span className="tabular-nums text-ink">May 2026</span>
        </span>
        <span className="ml-auto italic text-muted">
          <a href="#" className="underline decoration-rule hover:text-accent hover:decoration-accent">How scores are calculated →</a>
        </span>
      </div>
    </article>
  )
}

// ─── Homepage cover spread ───────────────────────────────────────────────────

function HomepageCover() {
  return (
    <article>
      {/* TODAY'S REVIEW cover treatment — Monocle-leaning. */}
      <p
        className="text-kicker uppercase font-semibold text-accent mb-4"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        Today&rsquo;s review · Sun · 17 May 2026
      </p>

      <div className="relative">
        <div
          className="aspect-[16/8] md:aspect-[21/8] w-full"
          style={{
            background: 'linear-gradient(135deg, #2E4818 0%, #5C7C2E 45%, #A0A45B 100%)',
            filter: 'saturate(1.1) contrast(1.05)',
          }}
          aria-hidden
        />
        <div className="hidden md:block absolute -bottom-8 -right-2 md:-right-6">
          <Rosette variant="recommends" size={160} rotate={-5} />
        </div>
      </div>

      <div className="mt-12 md:mt-16 grid md:grid-cols-3 gap-x-12 gap-y-6">
        <div className="md:col-span-2">
          <h2
            className="font-serif text-display-sm md:text-display lg:text-display-lg tracking-tight leading-[1.02] mb-6"
            style={{ fontOpticalSizing: 'auto' }}
          >
            Twenty years of building blocks.
          </h2>
          <p className="font-serif text-xl md:text-2xl italic text-muted leading-snug mb-6">
            Why Minecraft is still the safest sandbox in your house — and what to watch for
            as your child grows up inside it.
          </p>
        </div>
        <div className="md:col-span-1 md:pl-6 md:border-l md:border-ink/30 md:pt-2">
          <p className="font-serif text-base leading-relaxed text-ink/90 mb-6">
            Two decades on, Minecraft remains the rare childhood franchise that has neither
            curdled into a casino nor faded into nostalgia. We sat down with it again to see
            how the live-service era has — and hasn&rsquo;t — touched the calmest sandbox
            online.
          </p>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="font-sans italic">By the LumiKin editors</span>
            <span className="text-rule">·</span>
            <span className="font-sans">4 min read</span>
          </div>
          <a
            href="#"
            className="mt-4 inline-block text-kicker uppercase font-semibold text-accent hover:text-ink"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Read the review →
          </a>
        </div>
      </div>
    </article>
  )
}

function WhatWereTracking() {
  return (
    <section>
      <div className="flex items-baseline justify-between border-t-2 border-ink pt-3 mb-1">
        <p
          className="text-kicker uppercase font-semibold text-ink"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          What we&rsquo;re tracking
        </p>
        <a
          href="#"
          className="text-kicker uppercase text-muted hover:text-ink"
          style={{ fontVariantCaps: 'all-small-caps' }}
        >
          All reviews →
        </a>
      </div>
      <div className="border-t border-ink/30 mb-10" />
      <div className="grid md:grid-cols-3 gap-x-10 gap-y-12">
        {LISTING_CARDS.map((c) => (
          <ListingCard key={c.title} card={c} />
        ))}
      </div>
    </section>
  )
}

// ─── Compare two-column ──────────────────────────────────────────────────────

type CompareGame = {
  title: string
  kicker: string
  bds: number
  ris: number
  minutes: number
  ages: string
  benefits: ScoreRow[]
  risks: ScoreRow[]
}

const COMPARE_A: CompareGame = {
  title: 'Minecraft',
  kicker: 'Sandbox · Multi-platform',
  bds: 0.71, ris: 0.18, minutes: 90, ages: '8+',
  benefits: BENEFITS,
  risks: RISKS,
}

const COMPARE_B: CompareGame = {
  title: 'Fortnite',
  kicker: 'Shooter · Multi-platform',
  bds: 0.42, ris: 0.68, minutes: 30, ages: '13+',
  benefits: [
    { code: 'B1', label: 'Creativity',      value: 0.48 },
    { code: 'B2', label: 'Problem solving', value: 0.39 },
    { code: 'B3', label: 'Teamwork',        value: 0.71 },
  ],
  risks: [
    { code: 'R1', label: 'Addictive mechanics', value: 0.78 },
    { code: 'R2', label: 'Monetization',        value: 0.74 },
    { code: 'R3', label: 'FOMO',                value: 0.69 },
  ],
}

function CompareColumn({ game }: { game: CompareGame }) {
  return (
    <div>
      <p
        className="text-kicker uppercase font-semibold text-accent mb-2"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {game.kicker}
      </p>
      <h3 className="font-serif text-3xl tracking-tight mb-6 leading-[1.05]" style={{ fontOpticalSizing: 'auto' }}>
        {game.title}
      </h3>
      <div className="border-t border-b border-ink py-4 grid grid-cols-2 gap-x-6 mb-8">
        <BigScore label="Growth" value={game.bds} tone="ivy" />
        <div className="border-l border-ink/30 pl-6">
          <BigScore label="Risk" value={game.ris} tone="accent" />
        </div>
      </div>
      <div className="space-y-10">
        <ScoreTable title="Developmental benefits" rows={game.benefits} tone="ink" />
        <ScoreTable title="Design risks"           rows={game.risks}    tone="accent" />
      </div>
    </div>
  )
}

function ComparePanel() {
  return (
    <article>
      <p
        className="text-kicker uppercase font-semibold text-muted mb-3"
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        Compare · 17 May 2026
      </p>
      <h2 className="font-serif text-display-sm tracking-tight mb-10" style={{ fontOpticalSizing: 'auto' }}>
        {COMPARE_A.title} <span className="text-muted font-normal italic">vs</span> {COMPARE_B.title}
      </h2>

      {/* Two columns. On mobile they stack with a hairline rule between. */}
      <div className="grid md:grid-cols-2 gap-x-10 gap-y-12 border-t-2 border-ink pt-10">
        <CompareColumn game={COMPARE_A} />
        <div className="md:border-l md:border-ink/30 md:pl-10 border-t border-ink/30 pt-12 md:pt-0 md:border-t-0">
          <CompareColumn game={COMPARE_B} />
        </div>
      </div>

      {/* Shared rule across both columns — the editorial point of the page. */}
      <div className="mt-10 border-t-2 border-b border-ink py-6 grid grid-cols-2 gap-x-10 items-end">
        <div>
          <p
            className="text-kicker uppercase text-muted mb-1"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Daily limit · {COMPARE_A.title}
          </p>
          <p className="font-serif text-5xl tracking-tight tabular-nums leading-none">
            {COMPARE_A.minutes}<span className="text-2xl text-muted ml-1">min</span>
          </p>
          <p className="mt-2 font-serif italic text-muted text-sm">
            Ages {COMPARE_A.ages}
          </p>
        </div>
        <div className="border-l border-ink/30 pl-10">
          <p
            className="text-kicker uppercase text-muted mb-1"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Daily limit · {COMPARE_B.title}
          </p>
          <p className="font-serif text-5xl tracking-tight tabular-nums leading-none">
            {COMPARE_B.minutes}<span className="text-2xl text-muted ml-1">min</span>
          </p>
          <p className="mt-2 font-serif italic text-muted text-sm">
            Ages {COMPARE_B.ages}
          </p>
        </div>
      </div>

      <p className="mt-6 font-serif italic text-base text-muted max-w-prose">
        The limit gap is not arbitrary. {COMPARE_A.title}&rsquo;s low monetization pressure
        and steady-pace mechanics earn the longer session; {COMPARE_B.title}&rsquo;s
        live-service loops are tuned to keep your child playing past the bell.
      </p>
    </article>
  )
}


export default function DesignPreviewPage() {
  return (
    <DesignPreviewShell>
      <div className="min-h-screen bg-paper text-ink">
        <Masthead />

      <main className="mx-auto max-w-7xl px-8 py-16">
        <article className="max-w-prose">
          <p
            className="text-kicker uppercase font-semibold text-accent mb-6"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Review · Multi-platform
          </p>

          <h1 className="font-serif text-display tracking-tight mb-6" style={{ fontOpticalSizing: 'auto' }}>
            Twenty years of building blocks.
          </h1>

          <p className="font-serif text-2xl leading-snug text-muted italic mb-8">
            Why Minecraft is still the safest sandbox in your house — and what to watch for as your child grows up inside it.
          </p>

          <div className="flex items-center gap-3 text-sm text-muted mb-12">
            <span className="font-sans italic">By the LumiKin editors</span>
            <span className="text-rule">·</span>
            <time className="font-sans tabular-nums">17 May 2026</time>
            <span className="text-rule">·</span>
            <span className="font-sans">4 min read</span>
          </div>

          <div className="border-t border-ink/30 pt-8 font-serif text-lg leading-relaxed text-ink/90 space-y-5">
            <p className="first-letter:font-serif first-letter:text-7xl first-letter:font-semibold first-letter:float-left first-letter:mr-3 first-letter:leading-[0.85] first-letter:mt-1">
              Two decades after a Swedish programmer uploaded a rough prototype to a developer forum, Minecraft remains the rare childhood franchise that has neither curdled into a casino nor faded into nostalgia. It is, by some distance, the calmest place a nine-year-old can spend an afternoon online.
            </p>
            <p>
              That calmness is not an accident. Mojang has resisted nearly every monetization pattern its peers have embraced — no battle pass, no rotating store, no FOMO clock counting down a limited-edition skin. What it sells instead is time: time to build, time to fail, time to be quietly competent at something.
            </p>
          </div>
        </article>

        <aside className="mt-20 grid md:grid-cols-2 gap-12 max-w-5xl border-t-2 border-ink pt-10">
          <ScoreTable title="Developmental benefits"  rows={BENEFITS} tone="ink" />
          <ScoreTable title="Design risks"            rows={RISKS}    tone="accent" />
        </aside>

        <div className="mt-12 max-w-5xl border-t border-b border-ink py-6 flex items-baseline justify-between">
          <div>
            <p
              className="text-kicker uppercase text-muted mb-1"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              Recommended daily limit
            </p>
            <p className="font-serif text-5xl tracking-tight tabular-nums">90 minutes</p>
          </div>
          <div className="text-right">
            <p
              className="text-kicker uppercase text-muted mb-1"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              Age guidance
            </p>
            <p className="font-serif text-5xl tracking-tight tabular-nums">8+</p>
          </div>
        </div>

        {/* ─────────────────────────────────────────────── */}
        {/*  HOMEPAGE — cover spread + What we're tracking   */}
        {/* ─────────────────────────────────────────────── */}
        <section className="mt-32">
          <div className="border-t-2 border-ink pt-3 mb-1" />
          <div className="border-t border-ink/30" />
          <p
            className="mt-8 text-kicker uppercase font-semibold text-muted mb-10"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Homepage · cover spread
          </p>

          <HomepageCover />

          <div className="mt-16 max-w-3xl">
            <p
              className="text-kicker uppercase text-muted mb-3"
              style={{ fontVariantCaps: 'all-small-caps' }}
            >
              Search the archive
            </p>
            <SearchInput placeholder="Search 6,400 reviews" width="w-full" />
          </div>

          <div className="mt-32">
            <WhatWereTracking />
          </div>
        </section>

        {/* ─────────────────────────────────────────────── */}
        {/*  CHROME — Search input (classified-ad style)     */}
        {/* ─────────────────────────────────────────────── */}
        <section className="mt-32">
          <div className="border-t-2 border-ink pt-3 mb-1" />
          <div className="border-t border-ink/30" />
          <p
            className="mt-8 text-kicker uppercase font-semibold text-muted mb-10"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Chrome · search input
          </p>

          <div className="space-y-8">
            <div>
              <p
                className="text-kicker uppercase text-muted mb-2"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                Masthead — narrow
              </p>
              <SearchInput placeholder="Search reviews" width="max-w-sm" />
            </div>
            <div>
              <p
                className="text-kicker uppercase text-muted mb-2"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                Homepage — full width
              </p>
              <SearchInput placeholder="Search 6,400 reviews" width="w-full" />
            </div>
            <div>
              <p
                className="text-kicker uppercase text-muted mb-2"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                Empty state — italic prompt
              </p>
              <SearchInput
                placeholder="Try “Stardew”, “co-op”, or “low monetization”"
                width="max-w-2xl"
              />
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────── */}
        {/*  GAME — LISTING CARDS (browse grid)             */}
        {/* ─────────────────────────────────────────────── */}
        <section className="mt-32">
          <div className="border-t-2 border-ink pt-3 mb-1" />
          <div className="border-t border-ink/30" />
          <p
            className="mt-8 text-kicker uppercase font-semibold text-muted mb-10"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Browse · Listing cards
          </p>

          <div className="grid md:grid-cols-3 gap-x-10 gap-y-12 border-t border-ink/30 pt-10">
            {LISTING_CARDS.map((c) => (
              <ListingCard key={c.title} card={c} />
            ))}
          </div>
        </section>

        {/* ─────────────────────────────────────────────── */}
        {/*  GAME — DETAIL PANEL                            */}
        {/* ─────────────────────────────────────────────── */}
        <section className="mt-32">
          <div className="border-t-2 border-ink pt-3 mb-1" />
          <div className="border-t border-ink/30" />
          <p
            className="mt-8 text-kicker uppercase font-semibold text-muted mb-10"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Game page · Detail panel
          </p>

          <DetailPanel />
        </section>

        {/* ─────────────────────────────────────────────── */}
        {/*  GAME — DETAIL PANEL · v2 (editorial with soul) */}
        {/* ─────────────────────────────────────────────── */}
        <section className="mt-32">
          <div className="border-t-2 border-ink pt-3 mb-1" />
          <div className="border-t border-ink/30" />
          <p
            className="mt-8 text-kicker uppercase font-semibold text-muted mb-10"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Game page · Detail panel — v2 (Monocle-leaning)
          </p>

          <DetailPanelV2 />
        </section>

        {/* ─────────────────────────────────────────────── */}
        {/*  GAME — DETAIL PANEL · v2 (bundled-online)       */}
        {/* ─────────────────────────────────────────────── */}
        <section className="mt-32">
          <div className="border-t-2 border-ink pt-3 mb-1" />
          <div className="border-t border-ink/30" />
          <p
            className="mt-8 text-kicker uppercase font-semibold text-muted mb-10"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Game page · Detail panel — v2 (bundled-online warning)
          </p>

          <DetailPanelV2 variant="bundled" />
        </section>

        {/* ─────────────────────────────────────────────── */}
        {/*  GAME — DETAIL PANEL · v2 (UGC pending verify)   */}
        {/* ─────────────────────────────────────────────── */}
        <section className="mt-32">
          <div className="border-t-2 border-ink pt-3 mb-1" />
          <div className="border-t border-ink/30" />
          <p
            className="mt-8 text-kicker uppercase font-semibold text-muted mb-10"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Game page · Detail panel — v2 (UGC · pending verification)
          </p>

          <DetailPanelV2 variant="pending" />
        </section>

        {/* ─────────────────────────────────────────────── */}
        {/*  COMPARE — two-column                            */}
        {/* ─────────────────────────────────────────────── */}
        <section className="mt-32">
          <div className="border-t-2 border-ink pt-3 mb-1" />
          <div className="border-t border-ink/30" />
          <p
            className="mt-8 text-kicker uppercase font-semibold text-muted mb-10"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            Compare page · two-column
          </p>

          <ComparePanel />
        </section>

        <p className="mt-32 text-xs text-muted font-sans italic">
          Design preview — typography and color tokens only. Not linked from production navigation.
        </p>
        </main>
      </div>
    </DesignPreviewShell>
  )
}
