import { defineField, defineType } from 'sanity'

export const post = defineType({
  name: 'post',
  title: 'Blog / News',
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
      name: 'postType',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          { title: 'Blog', value: 'blog' },
          { title: 'News', value: 'news' },
        ],
        layout: 'radio',
      },
      initialValue: 'blog',
    }),
    defineField({
      name: 'excerpt',
      type: 'text',
      rows: 3,
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
      name: 'author',
      type: 'string',
      initialValue: 'LumiKin',
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
    select: { title: 'title', subtitle: 'postType', media: 'coverImage' },
  },
})
