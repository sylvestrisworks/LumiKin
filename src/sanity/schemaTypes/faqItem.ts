import { defineField, defineType } from 'sanity'

export const faqItem = defineType({
  name: 'faqItem',
  title: 'FAQ',
  type: 'document',
  fields: [
    defineField({
      name: 'question',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'answer',
      type: 'array',
      of: [{ type: 'block' }],
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
          { title: 'General', value: 'general' },
          { title: 'LumiScore', value: 'lumiscore' },
          { title: 'Screen Time', value: 'screen-time' },
          { title: 'Game Safety', value: 'game-safety' },
        ],
      },
    }),
    defineField({
      name: 'order',
      type: 'number',
      description: 'Controls display order within a category (lower = first)',
      initialValue: 99,
    }),
  ],
  orderings: [
    {
      title: 'Display order',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],
  preview: {
    select: { title: 'question', subtitle: 'category' },
  },
})
