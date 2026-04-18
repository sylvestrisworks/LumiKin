import { PortableText, type PortableTextComponents } from '@portabletext/react'
import { urlFor } from '@/sanity/lib/image'

const components: PortableTextComponents = {
  types: {
    image: ({ value }) => {
      if (!value?.asset) return null
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urlFor(value).width(800).auto('format').url()}
          alt={value.alt ?? ''}
          className="w-full rounded-xl my-6"
        />
      )
    },
  },
  block: {
    h1: ({ children }) => <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-10 mb-4">{children}</h1>,
    h2: ({ children }) => <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-8 mb-3">{children}</h2>,
    h3: ({ children }) => <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-6 mb-2">{children}</h3>,
    normal: ({ children }) => <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">{children}</p>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-indigo-400 pl-4 my-6 text-slate-600 dark:text-slate-400 italic">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4 text-slate-700 dark:text-slate-300">{children}</ul>,
    number: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4 text-slate-700 dark:text-slate-300">{children}</ol>,
  },
  marks: {
    strong: ({ children }) => <strong className="font-bold text-slate-900 dark:text-white">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    link: ({ value, children }) => (
      <a
        href={value?.href}
        target={value?.href?.startsWith('http') ? '_blank' : undefined}
        rel={value?.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
      >
        {children}
      </a>
    ),
  },
}

export default function PortableTextRenderer({ value }: { value: unknown[] }) {
  return (
    <div className="prose-like">
      <PortableText value={value} components={components} />
    </div>
  )
}
