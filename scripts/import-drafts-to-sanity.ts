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
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
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
// Optional substring filter so a single draft can be imported/published in
// isolation without touching every other file in the folder:
//   … import-drafts-to-sanity.ts --publish --file=blizzard
const FILE_FILTER = process.argv.find(a => a.startsWith('--file='))?.slice('--file='.length)

const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false })

// ─── Cover image ─────────────────────────────────────────────────────────────

type ImageRef = {
  _type: 'image'
  alt?: string
  asset: { _type: 'reference'; _ref: string }
}

/** Pull the `<!-- coverImage: <path>  alt: "<text>" -->` authoring note. */
function parseCover(rawBody: string): { path: string; alt: string } | null {
  const m = rawBody.match(/coverImage:\s*([^\s]+)[\s\S]*?alt:\s*"([\s\S]*?)"/)
  if (!m) return null
  return { path: m[1].trim(), alt: m[2].replace(/\s+/g, ' ').trim() }
}

/**
 * Inline body figures. Authored as a standalone comment on its own line:
 *   <!-- figure: path/to/chart.png  alt: "..." -->
 * Each is replaced with an `@@FIGURE<n>@@` sentinel line so it survives block
 * parsing in place, then swapped for an uploaded image block afterwards.
 */
const FIGURE_RE = /<!--\s*figure:\s*([^\s]+)[\s\S]*?alt:\s*"([\s\S]*?)"\s*-->/g
function extractFigures(body: string): { body: string; figures: { path: string; alt: string }[] } {
  const figures: { path: string; alt: string }[] = []
  const replaced = body.replace(FIGURE_RE, (_m, path: string, alt: string) => {
    const idx = figures.push({ path: path.trim(), alt: alt.replace(/\s+/g, ' ').trim() }) - 1
    return `\n\n@@FIGURE${idx}@@\n\n`
  })
  return { body: replaced, figures }
}

/** Upload the cover PNG as a Sanity asset (deduped by filename) and return an image ref. */
async function uploadCover(relPath: string, alt: string): Promise<ImageRef | null> {
  const abs = join(process.cwd(), relPath)
  if (!existsSync(abs)) {
    console.log(`    ! cover not found on disk: ${relPath} — skipping image`)
    return null
  }
  const filename = basename(relPath)
  let assetId = await client.fetch<string | null>(
    `*[_type == "sanity.imageAsset" && originalFilename == $f][0]._id`,
    { f: filename },
  )
  if (!assetId) {
    const asset = await client.assets.upload('image', readFileSync(abs), { filename })
    assetId = asset._id
    console.log(`    ↑ uploaded cover ${filename} → ${assetId}`)
  } else {
    console.log(`    = cover ${filename} already uploaded → ${assetId}`)
  }
  return { _type: 'image', alt, asset: { _type: 'reference', _ref: assetId } }
}

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

/**
 * Parse inline markdown (bold, italic, code, links) into spans + markDefs.
 * Recursive over an "active marks" set so nested formatting works — notably a
 * link wrapped in emphasis (`*[text](href)*`), which the previous flat parser
 * dropped as literal text.
 */
function parseInline(text: string): { spans: Span[]; markDefs: MarkDef[] } {
  const markDefs: MarkDef[] = []

  function walk(input: string, marks: string[]): Span[] {
    const spans: Span[] = []
    let buf = ''
    const flush = () => {
      if (!buf) return
      spans.push({ _type: 'span', _key: randomKey(), text: buf, marks: [...marks] })
      buf = ''
    }
    let i = 0
    while (i < input.length) {
      const rest = input.slice(i)
      let m: RegExpMatchArray | null
      // [link text](href) — label may itself contain formatting
      if ((m = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/))) {
        flush()
        const key = randomKey()
        markDefs.push({ _key: key, _type: 'link', href: m[2] })
        spans.push(...walk(m[1], [...marks, key]))
        i += m[0].length; continue
      }
      if ((m = rest.match(/^\*\*\*([^*]+)\*\*\*/))) { flush(); spans.push(...walk(m[1], [...marks, 'strong', 'em'])); i += m[0].length; continue }
      if ((m = rest.match(/^\*\*([^*]+)\*\*/)))     { flush(); spans.push(...walk(m[1], [...marks, 'strong']));      i += m[0].length; continue }
      if (!rest.startsWith('**') && (m = rest.match(/^\*([^*\n]+)\*/))) { flush(); spans.push(...walk(m[1], [...marks, 'em'])); i += m[0].length; continue }
      if ((m = rest.match(/^`([^`]+)`/))) { flush(); spans.push({ _type: 'span', _key: randomKey(), text: m[1], marks: [...marks, 'code'] }); i += m[0].length; continue }
      buf += input[i]; i++
    }
    flush()
    return spans
  }

  return { spans: walk(text, []), markDefs }
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
  // Pull inline figures out first (leaving @@FIGURE<n>@@ sentinels in place),
  // then strip the remaining HTML comments (e.g. the coverImage note) so they
  // never render as visible body text.
  const { body: withSentinels, figures } = extractFigures(body)
  const cleanBody = withSentinels.replace(/<!--[\s\S]*?-->/g, '')
  const bodyBlocks: unknown[] = markdownToBlocks(cleanBody)

  // Swap each sentinel paragraph for an uploaded inline image block.
  for (let i = 0; i < bodyBlocks.length; i++) {
    const b = bodyBlocks[i] as Block
    const text = b._type === 'block' ? b.children.map(s => s.text).join('') : ''
    const fm2 = text.trim().match(/^@@FIGURE(\d+)@@$/)
    if (!fm2) continue
    const fig = figures[Number(fm2[1])]
    const ref = fig ? await uploadCover(fig.path, fig.alt) : null
    bodyBlocks[i] = ref
      ? { _key: randomKey(), ...ref }
      : mkBlock('normal', '') // drop the sentinel if the figure is missing
  }

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

  // Cover image: upload the PNG named in the authoring comment and attach it.
  const cover = parseCover(body)
  if (cover) {
    const ref = await uploadCover(cover.path, cover.alt)
    if (ref) doc.coverImage = ref
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
  let files = readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.md')).sort()
  if (FILE_FILTER) files = files.filter(f => f.includes(FILE_FILTER))
  console.log(`Project: ${projectId} / ${dataset}`)
  console.log(`Mode:    ${PUBLISH ? 'PUBLISH (live on the site immediately)' : 'DRAFT (review in Studio first)'}`)
  if (FILE_FILTER) console.log(`Filter:  --file=${FILE_FILTER} → ${files.length} match(es)`)
  if (files.length === 0) { console.log('No files matched. Nothing to do.'); return }
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
