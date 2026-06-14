import type { Metadata } from 'next'
import { Lora } from 'next/font/google'
import AuthorByline from '@/components/AuthorByline'
import { SITE_URL, personSchema, ldJson } from '@/lib/author'

export const revalidate = 86400

// Body serif for the long-form essay — matches the methodology page's reading register.
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})

const PAGE_TITLE = 'About LumiKin — the editor behind the ratings'
const PAGE_DESC =
  'Why LumiKin exists, in the words of its founder and editor: a games-positive, research-grounded read on what a game builds in a child — not just how long they play.'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return {
    title: PAGE_TITLE,
    description: PAGE_DESC,
    alternates: { canonical: `${SITE_URL}/${locale}/about` },
    openGraph: {
      title: PAGE_TITLE,
      description: PAGE_DESC,
      type: 'profile',
      url: `${SITE_URL}/${locale}/about`,
    },
    twitter: { card: 'summary_large_image', title: PAGE_TITLE, description: PAGE_DESC },
  }
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  // Full schema.org/Person node — emitted ONCE, here on /about (its canonical home).
  // mainEntityOfPage marks this page as the one primarily about Johan. Other pages
  // reference the same @id rather than re-emitting the node.
  const personLd = {
    ...personSchema,
    mainEntityOfPage: `${SITE_URL}/${locale}/about`,
  }

  return (
    <div className={`${lora.variable} bg-paper text-ink`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(personLd) }} />

      <article className="max-w-2xl mx-auto px-6 py-16 sm:py-24">
        {/* ── Header (no CTA — institutional register) ─────────────────────────── */}
        <header className="mb-12">
          <p
            className="text-kicker uppercase font-semibold text-muted mb-4"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            About LumiKin
          </p>
          <h1 className="font-serif text-display-sm md:text-display tracking-tight leading-tight">
            Why I built this
          </h1>
        </header>

        {/* ── Warm, first-person essay ─────────────────────────────────────────── */}
        <div
          className="space-y-6 text-lg leading-relaxed text-ink/90"
          style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
        >
          <p>
            I bought my first console with my own money in 1989, when I was ten and my parents were
            quietly convinced video games were a waste of a good childhood. One of the first games I
            loved was the original <em>Zelda</em>. My English wasn&rsquo;t good enough to figure out
            the save function, so for a long time I simply started from the beginning every time —
            and kept playing anyway. That tells you most of what you need to know about how I feel
            about this medium.
          </p>
          <p>
            I&rsquo;ve been console-fluid ever since — PlayStation, Xbox, four generations of
            Nintendo in the house — though these days I mostly play on PC. I still believe the best
            narrative games sit comfortably next to good books in what they can do to you.
          </p>
          <p>
            Then I had children, and I wanted them to play. I&rsquo;ve never seen games as a threat
            to manage; I see them as something that, chosen well, genuinely helps a young mind grow.
            But &ldquo;chosen well&rdquo; turned out to be the hard part. The tools available to me
            could enforce screen-time limits and allow-lists, and they did — but all they really gave
            our household was conflict. They could tell me <em>how long</em>, never{' '}
            <em>which games, and why</em>. A blocker assumes every game is a risk to be contained.
            What I actually needed was a way to tell a game that builds something from a game
            engineered to extract something.
          </p>
          <p>
            So I built it. The deeper I went, the clearer it became that games are not
            interchangeable — that the distance between a title that develops real skills and one
            designed to exploit attention is enormous, and almost completely invisible to the parent
            standing in the doorway. What changed our home wasn&rsquo;t a stricter limit; it was a
            shared, honest read of a game&rsquo;s actual benefits and risks, and a conversation we
            could both stand behind.
          </p>
          <p>
            I came to this as a journalist with a background in anthropology, which is to say
            I&rsquo;m in the habit of sourcing claims carefully and of observing — systematically,
            without flinching — how people behave inside the systems built for them. Games are
            exactly that: systems, and culture. LumiKin is what happens when you turn that lens on
            them in the service of parents who like games and want to choose well.
          </p>

          {/* COLLABORATOR_SEAM: closing line introducing named academic advisor once secured */}
        </div>

        {/* ── Byline (no independence note — that lives in the credentialed block) ── */}
        <div className="mt-16">
          <AuthorByline variant="full" />
        </div>
      </article>
    </div>
  )
}
