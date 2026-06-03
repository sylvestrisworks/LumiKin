import { PortableText, type PortableTextComponents, type PortableTextBlock } from '@portabletext/react'
import { urlFor } from '@/sanity/lib/image'

const components: PortableTextComponents = {
  types: {
    image: ({ value }) => {
      if (!value?.asset) return null
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urlFor(value)!.width(800).auto('format').url()}
          alt={value.alt ?? ''}
          className="w-full rounded-xl my-6"
        />
      )
    },
  },
  block: {
    h1: ({ children }) => <h1 className="font-serif text-display-sm text-ink mt-10 mb-4">{children}</h1>,
    h2: ({ children }) => <h2 className="font-serif text-2xl text-ink mt-8 mb-3">{children}</h2>,
    h3: ({ children }) => <h3 className="font-serif text-xl text-ink mt-6 mb-2">{children}</h3>,
    normal: ({ children }) => <p className="text-ink/85 leading-relaxed mb-4">{children}</p>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-accent pl-4 my-6 font-serif text-ink/80 italic">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4 text-ink/85">{children}</ul>,
    number: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4 text-ink/85">{children}</ol>,
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    link: ({ value, children }) => (
      <a
        href={value?.href}
        target={value?.href?.startsWith('http') ? '_blank' : undefined}
        rel={value?.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="text-accent underline hover:no-underline transition-colors"
      >
        {children}
      </a>
    ),
  },
}

export default function PortableTextRenderer({ value }: { value: PortableTextBlock[] }) {
  return (
    <div className="prose-like">
      <PortableText value={value} components={components} />
    </div>
  )
}
