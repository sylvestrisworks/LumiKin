import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'es', 'fr', 'sv', 'de'],
  defaultLocale: 'en',
})
