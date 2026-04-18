import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { schemaTypes } from './src/sanity/schemaTypes'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '8j5re8qj'
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET   ?? 'production'

export default defineConfig({
  basePath: '/studio',
  projectId,
  dataset,
  title: 'LumiKin Content',
  schema: { types: schemaTypes },
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            S.listItem().title('Parental Guides').schemaType('guide').child(
              S.documentTypeList('guide').title('Guides')
            ),
            S.listItem().title('Blog & News').schemaType('post').child(
              S.documentTypeList('post').title('Posts')
            ),
            S.divider(),
            S.listItem().title('FAQs').schemaType('faqItem').child(
              S.documentTypeList('faqItem').title('FAQs')
            ),
          ]),
    }),
  ],
})
