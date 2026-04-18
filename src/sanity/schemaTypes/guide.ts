import { defineField, defineType } from 'sanity'

export const guide = defineType({
  name: 'guide',
  title: 'Parental Guide',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'locale',
      title: 'Language',
      type: 'string',
      options: { list: ['en', 'es', 'fr', 'sv', 'de'], layout: 'radio' },
      initialValue: 'en',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'category',
      type: 'string',
      options: {
        list: [
          { title: 'Screen Time', value: 'screen-time' },
          { title: 'Game Safety', value: 'game-safety' },
          { title: 'Age Guide', value: 'age-guide' },
          { title: 'Parenting Tips', value: 'parenting-tips' },
        ],
      },
    }),
    defineField({
      name: 'excerpt',
      type: 'text',
      rows: 3,
      description: 'Short summary shown on cards and in search results (max 160 chars)',
      validation: (Rule) => Rule.max(160),
    }),
    defineField({
      name: 'coverImage',
      type: 'image',
      options: { hotspot: true },
      fields: [
        defineField({ name: 'alt', type: 'string', title: 'Alt text' }),
      ],
    }),
    defineField({
      name: 'body',
      type: 'array',
      of: [
        { type: 'block' },
        {
          type: 'image',
          options: { hotspot: true },
          fields: [defineField({ name: 'alt', type: 'string', title: 'Alt text' })],
        },
      ],
    }),
    defineField({
      name: 'publishedAt',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({ name: 'seoTitle', title: 'SEO Title override', type: 'string' }),
    defineField({ name: 'seoDescription', title: 'SEO Description override', type: 'text', rows: 2 }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'category', media: 'coverImage' },
  },
})
