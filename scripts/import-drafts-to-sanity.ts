/**
 * Import markdown drafts in docs/redesign/editorial-drafts/ into Sanity.
 *
 * Default: imports as drafts (visible in Studio for review, not on the site).
 * With --publish: creates published docs directly. If a draft already exists
 * for the same slug+locale, it's promoted (published, then the draft deleted).
 * Published docs are never overwritten — re-run with --publish to bulk-fill
 * remaining items without trampling earlier edits.
 *
 * Run with:
 *   node --env-file=.env.local --env-file=.env node_modules/tsx/dist/cli.cjs scripts/import-drafts-to-sanity.ts
 *   node --env-file=.env.local --env-file=.env node_modules/tsx/dist/cli.cjs scripts/import-drafts-to-sanity.ts --publish
 *
 * Requires SANITY_API_TOKEN in .env.local (Editor role). Idempotent. Tables in
 * source markdown flatten to " · "-joined paragraphs and need manual
 * reformatting in Studio before they're presentation-quality.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@sanity/client'

const DRAFTS_DIR = 'docs/redesign/editorial-drafts'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const token = process.env.SANITY_API_TOKEN

if (!projectId) {
  console.error('NEXT_PUBLIC_SANITY_PROJECT_ID is required')
  process.exit(1)
}
if (!token) {
  console.error('SANITY_API_TOKEN is required (Editor role token from sanity.io/manage)')
  process.exit(1)
}

const PUBLISH = process.argv.includes('--publish')

const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false })

// ─── Frontmatter ─────────────────────────────────────────────────────────────

type Frontmatter = Record<string, string>

function parseFrontmatter(src: string): { fm: Frontmatter; body: string } {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!m) throw new Error('No frontmatter')
  const fm: Frontmatter = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z][a-zA-Z0-9_]*):\s*(.*)$/)
    if (!kv) continue
    let v = kv[2].trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    if (v) fm[kv[1]] = v
  }
  return { fm, body: m[2] }
}

// ─── Markdown → portable text ────────────────────────────────────────────────

function randomKey(): string {
  return Math.random().toString(36).slice(2, 14)
}

type Span = { _type: 'span'; _key: string; text: string; marks: string[] }
type MarkDef = { _key: string; _type: string; href?: string }

/** Parse inline markdown (bold, italic, links) into spans + markDefs. */
function parseInline(text: string): { spans: Span[]; markDefs: MarkDef[] } {
  const spans: Span[] = []
  const markDefs: MarkDef[] = []
  let buf = ''
  const flushBuf = (marks: string[] = []) => {
    if (!buf) return
    spans.push({ _type: 'span', _key: randomKey(), text: buf, marks })
    buf = ''
  }
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    // [link text](href)
    const link = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (link) {
      flushBuf()
      const key = randomKey()
      markDefs.push({ _key: key, _type: 'link', href: link[2] })
      spans.push({ _type: 'span', _key: randomKey(), text: link[1], marks: [key] })
      i += link[0].length
      continue
    }
    // ***bold-italic***
    const bi = rest.match(/^\*\*\*([^*]+)\*\*\*/)
    if (bi) {
      flushBuf()
      spans.push({ _type: 'span', _key: randomKey(), text: bi[1], marks: ['strong', 'em'] })
      i += bi[0].length
      continue
    }
    // **bold**
    const b = rest.match(/^\*\*([^*]+)\*\*/)
    if (b) {
      flushBuf()
      spans.push({ _type: 'span', _key: randomKey(), text: b[1], marks: ['strong'] })
      i += b[0].length
      continue
    }
    // *italic* — guard against ** prefix
    const em = rest.match(/^\*([^*\n]+)\*/)
    if (em && !rest.startsWith('**')) {
      flushBuf()
      spans.push({ _type: 'span', _key: randomKey(), text: em[1], marks: ['em'] })
      i += em[0].length
      continue
    }
    // `code`
    const code = rest.match(/^`([^`]+)`/)
    if (code) {
      flushBuf()
      spans.push({ _type: 'span', _key: randomKey(), text: code[1], marks: ['code'] })
      i += code[0].length
      continue
    }
    buf += text[i]
    i++
  }
  flushBuf()
  return { spans, markDefs }
}

type Block = {
  _type: 'block'
  _key: string
  style: string
  listItem?: 'bullet' | 'number'
  level?: number
  markDefs: MarkDef[]
  children: Span[]
}

function mkBlock(style: string, text: string, listItem?: 'bullet' | 'number'): Block {
  const { spans, markDefs } = parseInline(text)
  const block: Block = {
    _type: 'block',
    _key: randomKey(),
    style,
    markDefs,
    children: spans.length > 0 ? spans : [{ _type: 'span', _key: randomKey(), text: '', marks: [] }],
  }
  if (listItem) {
    block.listItem = listItem
    block.level = 1
  }
  return block
}

function markdownToBlocks(md: string): Block[] {
  const blocks: Block[] = []
  const lines = md.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    let m: RegExpMatchArray | null
    if ((m = line.match(/^### (.+)$/))) { blocks.push(mkBlock('h3', m[1])); i++; continue }
    if ((m = line.match(/^## (.+)$/))) { blocks.push(mkBlock('h2', m[1])); i++; continue }
    if ((m = line.match(/^# (.+)$/))) { blocks.push(mkBlock('h1', m[1])); i++; continue }
    if ((m = line.match(/^> (.+)$/))) { blocks.push(mkBlock('blockquote', m[1])); i++; continue }
    if (line.match(/^\|.+\|$/)) {
      // Flatten table: skip the |---|---| separator, render each row as a normal paragraph.
      while (i < lines.length && lines[i].match(/^\|.+\|$/)) {
        const row = lines[i]
        if (!row.match(/^\|[\s\-:|]+\|$/)) {
          const cells = row.slice(1, -1).split('|').map(c => c.trim()).filter(Boolean)
          if (cells.length) blocks.push(mkBlock('normal', cells.join(' · ')))
        }
        i++
      }
      continue
    }
    if ((m = line.match(/^- (.+)$/))) { blocks.push(mkBlock('normal', m[1], 'bullet')); i++; continue }
    if ((m = line.match(/^\d+\.\s+(.+)$/))) { blocks.push(mkBlock('normal', m[1], 'number')); i++; continue }
    // Regular paragraph: join consecutive non-empty, non-special lines.
    let end = i
    while (end < lines.length && lines[end].trim() && !lines[end].match(/^(#|>|-|\d+\.\s|\|)/)) end++
    const text = lines.slice(i, end).join(' ').trim()
    if (text) blocks.push(mkBlock('normal', text))
    i = end
  }
  return blocks
}

// ─── Import one file ─────────────────────────────────────────────────────────

async function importDraft(file: string): Promise<'created' | 'published' | 'exists' | 'skipped'> {
  const src = readFileSync(join(DRAFTS_DIR, file), 'utf8')
  const { fm, body } = parseFrontmatter(src)

  const type = fm.sanityType
  if (type !== 'guide' && type !== 'post') {
    console.log(`  SKIP ${file}: unknown sanityType "${type}"`)
    return 'skipped'
  }
  const slug = fm.slug
  const locale = fm.locale ?? 'en'
  if (!slug) { console.log(`  SKIP ${file}: no slug`); return 'skipped' }

  const publishedId = `${type}-${slug}-${locale}`
  const draftId     = `drafts.${publishedId}`

  // Look up both ids so we can distinguish "draft only" from "already published".
  const [publishedExists, draftExists] = await Promise.all([
    client.fetch<string | null>(`*[_id == $id][0]._id`, { id: publishedId }),
    client.fetch<string | null>(`*[_id == $id][0]._id`, { id: draftId }),
  ])

  if (publishedExists) {
    console.log(`  EXISTS (published) ${file} → ${publishedId}`)
    return 'exists'
  }
  if (draftExists && !PUBLISH) {
    console.log(`  EXISTS (draft) ${file} → ${draftId}`)
    return 'exists'
  }

  const docId = PUBLISH ? publishedId : draftId
  // Strip HTML comments (e.g. the <!-- coverImage / alt --> authoring note) so
  // they never render as visible body text.
  const cleanBody = body.replace(/<!--[\s\S]*?-->/g, '')
  const bodyBlocks = markdownToBlocks(cleanBody)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = {
    _id: docId,
    _type: type,
    title: fm.title,
    slug: { _type: 'slug', current: slug },
    locale,
    excerpt: fm.excerpt,
    body: bodyBlocks,
    publishedAt: fm.publishedAt ? new Date(fm.publishedAt + 'T12:00:00Z').toISOString() : new Date().toISOString(),
  }
  if (fm.seoTitle) doc.seoTitle = fm.seoTitle
  if (fm.seoDescription) doc.seoDescription = fm.seoDescription
  if (type === 'guide') doc.category = fm.category
  if (type === 'post') {
    doc.postType = fm.postType ?? 'blog'
    doc.author = 'LumiKin'
  }

  await client.createOrReplace(doc)

  // In --publish mode, also clear the stale draft so Studio shows clean state.
  if (PUBLISH && draftExists) {
    await client.delete(draftId)
    console.log(`  PUBLISHED ${file} → ${publishedId} (promoted from draft)`)
  } else if (PUBLISH) {
    console.log(`  PUBLISHED ${file} → ${publishedId}`)
  } else {
    console.log(`  CREATED  ${file} → ${docId}`)
  }
  return PUBLISH ? 'published' : 'created'
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const files = readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.md')).sort()
  console.log(`Project: ${projectId} / ${dataset}`)
  console.log(`Mode:    ${PUBLISH ? 'PUBLISH (live on the site immediately)' : 'DRAFT (review in Studio first)'}`)
  console.log(`Importing ${files.length} files from ${DRAFTS_DIR}/\n`)
  let created = 0, published = 0, exists = 0, skipped = 0
  for (const f of files) {
    try {
      const result = await importDraft(f)
      if (result === 'created') created++
      else if (result === 'published') published++
      else if (result === 'exists') exists++
      else skipped++
    } catch (e) {
      console.error(`  ERROR ${f}:`, e instanceof Error ? e.message : e)
      skipped++
    }
  }
  console.log(`\nDone. created=${created} published=${published} exists=${exists} skipped=${skipped}`)
  console.log('Open Sanity Studio at /studio to review. Tables in source markdown have been')
  console.log('flattened to "·"-separated paragraphs — reformat in Studio for presentation quality.')
}

main().catch(e => { console.error(e); process.exit(1) })
