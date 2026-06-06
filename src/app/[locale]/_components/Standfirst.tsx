import { getTranslations } from 'next-intl/server'

// Editor's standfirst — a short note directly under the masthead that says who
// LumiKin is, who it's for, and the one promise (benefits first, public rubric,
// one thing to watch). This is the human voice an anonymous, AI-generated page
// lacks; it's the first trust signal a parent reads.
export default async function Standfirst() {
  const te = await getTranslations('editorial')

  return (
    <section className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-12 pb-10 md:pt-14 md:pb-12">
        <div className="border-t border-ink pt-4 mb-6">
          <p
            className="text-kicker uppercase font-semibold text-muted"
            style={{ fontVariantCaps: 'all-small-caps' }}
          >
            {te('standfirst.kicker')}
          </p>
        </div>

        <p className="font-serif text-xl md:text-2xl leading-snug text-ink max-w-3xl">
          {te('standfirst.body')}
        </p>

        <p className="font-hand text-2xl text-ink/80 mt-5">
          {te('standfirst.signoff')}
        </p>
      </div>
    </section>
  )
}
