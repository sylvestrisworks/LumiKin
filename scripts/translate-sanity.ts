/**
 * translate-sanity.ts
 *
 * Translates Sanity editorial content (guide / post / faqItem) from English into
 * a target locale by creating per-locale documents (Sanity here is document-per-
 * locale: each doc has a `locale` field; a translation is a separate doc with the
 * same slug + `locale: 'sv'`). Portable Text bodies are translated span-by-span so
 * block structure, marks, and link defs are preserved untouched.
 *
 * Runs through the headless Claude Code CLI (Max plan, no API spend) by default —
 * sv → Sonnet, others → Haiku (see cliModelForLocale). Idempotent: skips a locale
 * doc that already exists unless --force.
 *
 * Usage:
 *   npx tsx scripts/translate-sanity.ts --dry              # count what would translate
 *   npx tsx scripts/translate-sanity.ts --limit 1          # one doc (draft) to eyeball
 *   npx tsx scripts/translate-sanity.ts --publish          # write live docs
 *   npx tsx scripts/translate-sanity.ts --locale sv --publish
 *
 * Requires NEXT_PUBLIC_SANITY_PROJECT_ID + SANITY_API_TOKEN (Editor) in .env.local.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createClient } from '@sanity/client'
import { runClaudeCli } from '@/lib/claude-cli'

// ─── Config ───────────────────────────────────────────────────────────────────

const LANGUAGE_NAMES: Record<string, string> = {
  sv: 'Swedish', de: 'German', fr: 'French', es: 'Spanish (Latin American)',
}
const cliModelForLocale = (l: string) => (l === 'sv' ? 'sonnet' : 'haiku')

const DO_NOT_TRANSLATE = ['LumiKin', 'LumiScore', 'ESRB', 'PEGI', 'Metacritic', 'RAWG', 'IGDB']

const args     = process.argv.slice(2)
const getArg   = (n: string) =>
  args.find(a => a.startsWith(`--${n}=`))?.split('=')[1]
  ?? (args.indexOf(`--${n}`) !== -1 ? args[args.indexOf(`--${n}`) + 1] : undefined)
const LOCALE   = getArg('locale') ?? 'sv'
const DRY      = args.includes('--dry')
const PUBLISH  = args.includes('--publish')
const FORCE    = args.includes('--force')
const LIMIT    = getArg('limit') ? parseInt(getArg('limit')!, 10) : Infinity

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const token     = process.env.SANITY_API_TOKEN

if (!projectId) { console.error('NEXT_PUBLIC_SANITY_PROJECT_ID is required'); process.exit(1) }
if (!token && !DRY) { console.error('SANITY_API_TOKEN (Editor role) is required to write'); process.exit(1) }

const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false })

// ─── Translatable-string collection ─────────────────────────────────────────────
// Walk a document and gather { get, set } accessors for every non-empty string we
// want translated, leaving structure (keys, marks, refs) untouched.

type Doc = Record<string, unknown>
type Accessor = { get: () => string; set: (v: string) => void }

function collect(doc: Doc): Accessor[] {
  const acc: Accessor[] = []
  const field = (obj: Record<string, unknown>, key: string) => {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) acc.push({ get: () => obj[key] as string, set: (x) => { obj[key] = x } })
  }

  if (doc._type === 'faqItem') {
    field(doc, 'question')
  } else {
    field(doc, 'title'); field(doc, 'excerpt'); field(doc, 'seoTitle'); field(doc, 'seoDescription')
    const cover = doc.coverImage as Record<string, unknown> | undefined
    if (cover) field(cover, 'alt')
  }

  const body = (doc.body ?? doc.answer) as unknown[] | undefined
  if (Array.isArray(body)) {
    for (const block of body as Record<string, unknown>[]) {
      if (block._type === 'block' && Array.isArray(block.children)) {
        for (const span of block.children as Record<string, unknown>[]) {
          if (span._type === 'span' && typeof span.text === 'string' && span.text.trim()) {
            acc.push({ get: () => span.text as string, set: (x) => { span.text = x } })
          }
        }
      } else if (block._type === 'image') {
        field(block, 'alt')
      }
    }
  }
  return acc
}

// ─── Localize internal links to the target locale ───────────────────────────────
// Internal hrefs are authored locale-prefixed (e.g. /en/game/x). A translated doc
// must point at same-locale routes (/sv/game/x) or readers bounce back to English.
// External (http, //) and locale-less paths are left untouched.
const LOCALE_PREFIX_RE = new RegExp(`^/(${['en', ...Object.keys(LANGUAGE_NAMES)].join('|')})(?=/|#|$)`)

function localizeHrefs(doc: Doc, locale: string): number {
  let n = 0
  const blocks = (doc.body ?? doc.answer) as Record<string, unknown>[] | undefined
  if (!Array.isArray(blocks)) return 0
  for (const block of blocks) {
    const defs = block.markDefs as Record<string, unknown>[] | undefined
    if (!Array.isArray(defs)) continue
    for (const def of defs) {
      const href = def.href
      if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) continue
      const next = href.replace(LOCALE_PREFIX_RE, '/' + locale)
      if (next !== href) { def.href = next; n++ }
    }
  }
  return n
}

// ─── Translate one doc's strings via the CLI (one call) ──────────────────────────

const lang = LANGUAGE_NAMES[LOCALE] ?? LOCALE
const SV_STYLE = LOCALE === 'sv' ? `

SWEDISH STYLE:
- Avoid em dashes (—). English overuses them; Swedish prose rarely does. Replace with a comma, a colon, parentheses, or split into two sentences — whichever reads most naturally. Use an em dash only when no other punctuation works.
- Do not translate word-for-word. Render the meaning in idiomatic Swedish; recast English sentence structures and idioms rather than calquing them.
- The result must read as if a professional Swedish writer wrote it from scratch — not a translation. Avoid stilted phrasing, anglicisms, and tell-tale AI patterns (formulaic transitions, "Det är viktigt att notera", over-hedging).` : ''
const SYSTEM = `You are translating website editorial content (parental game-guidance articles) from English into ${lang}. Faithful, natural ${lang} for parents — never add, drop, or summarize.${SV_STYLE}

You receive a JSON array of strings. Return ONLY a JSON array of the SAME length and SAME order, where each element is the ${lang} translation of the corresponding input element.
- Do NOT merge, split, reorder, add, or remove array elements — the output array length must exactly equal the input array length.
- Preserve any inline markdown/HTML and placeholders verbatim.
- Reproduce any "DO NOT TRANSLATE" terms exactly as given, wherever they appear.
- Some elements are short fragments (parts of a sentence split across formatting) — translate each on its own as best you can.`

function parseArray(text: string, n: number): string[] | null {
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) return null
  try {
    const arr = JSON.parse(m[0])
    if (Array.isArray(arr) && arr.length === n && arr.every(s => typeof s === 'string')) return arr
  } catch { /* fall through */ }
  return null
}

const CHUNK = 30   // strings per CLI call — smaller = faster + fewer length-mismatches
const DNT_LINE = `DO NOT TRANSLATE (verbatim): ${DO_NOT_TRANSLATE.join(', ')}\n\n`

let aborted = false   // set when the plan's compute quota is spent

/**
 * Translate one slice, guaranteeing the returned array length matches the input.
 * Retries transient failures; on a persistent length-mismatch (model merged/split
 * elements) it splits the slice and recurses — base case is one string, which can't
 * mismatch. Returns null only on a hard failure (single string fails, or quota).
 */
async function translateChunk(strings: string[]): Promise<string[] | null> {
  for (let attempt = 0; attempt < 2 && !aborted; attempt++) {
    const r = await runClaudeCli(SYSTEM, DNT_LINE + JSON.stringify(strings), cliModelForLocale(LOCALE), 240_000)
    if (!r.ok) {
      if (r.quotaExhausted) { aborted = true; console.error('    ⛔ compute quota exhausted — stopping'); return null }
      continue   // transient (timeout / rate-limit) — retry
    }
    const arr = parseArray(r.text, strings.length)
    if (arr) return arr
    // length mismatch → retry, then fall through to split
  }
  if (aborted || strings.length <= 1) return null   // can't split a single string further
  const mid = Math.ceil(strings.length / 2)
  const a = await translateChunk(strings.slice(0, mid)); if (!a) return null
  const b = await translateChunk(strings.slice(mid));    if (!b) return null
  return [...a, ...b]
}

async function translateStrings(strings: string[]): Promise<string[] | null> {
  const out: string[] = []
  for (let i = 0; i < strings.length && !aborted; i += CHUNK) {
    const arr = await translateChunk(strings.slice(i, i + CHUNK))
    if (!arr) { console.warn(`    ⚠ chunk ${i}-${i + Math.min(CHUNK, strings.length - i)} failed`); return null }
    out.push(...arr)
  }
  return aborted ? null : out
}

// ─── Main ────────────────────────────────────────────────────────────────────

const svId = (enId: string) => (enId.endsWith('-en') ? enId.slice(0, -3) : enId) + `-${LOCALE}`

async function main() {
  const enDocs = await client.fetch<Doc[]>(
    `*[_type in ["guide","post","faqItem"] && locale == "en" && !(_id in path("drafts.**"))]`,
  )
  const existing = new Set(
    await client.fetch<string[]>(`*[locale == $loc]._id`, { loc: LOCALE }),
  )

  const todo = enDocs.filter(d => FORCE || !existing.has(svId(d._id as string)))
  console.log(`\nSanity → ${LOCALE} (${lang})  via ${cliModelForLocale(LOCALE)} / Max CLI`)
  console.log(`English docs: ${enDocs.length}  already-${LOCALE}: ${enDocs.length - todo.length}  to translate: ${todo.length}  ${DRY ? '(DRY)' : PUBLISH ? '(PUBLISH)' : '(DRAFT)'}\n`)

  if (DRY) {
    for (const d of todo.slice(0, 60)) {
      const n = collect(structuredClone(d)).length
      console.log(`  ${d._type}  ${(d.slug as { current?: string })?.current ?? d._id}  — ${n} strings`)
    }
    process.exit(0)
  }

  let done = 0, skipped = 0, errors = 0
  for (const en of todo) {
    if (done + errors >= LIMIT) break
    const out = structuredClone(en)
    const acc = collect(out)
    const label = `${en._type} ${(en.slug as { current?: string })?.current ?? en._id}`
    if (acc.length === 0) { skipped++; continue }

    const translated = await translateStrings(acc.map(a => a.get()))
    if (!translated) { errors++; console.warn(`  ⚠ ${label} — translation failed`); continue }
    acc.forEach((a, i) => a.set(translated[i]))
    const relinked = localizeHrefs(out, LOCALE)

    const targetId = svId(en._id as string)
    out._id = PUBLISH ? targetId : `drafts.${targetId}`
    out.locale = LOCALE
    delete out._rev; delete out._createdAt; delete out._updatedAt

    await client.createOrReplace(out as Doc & { _id: string; _type: string })
    // In publish mode, clear any stale draft of the same locale doc so Studio is clean.
    if (PUBLISH) { try { await client.delete(`drafts.${targetId}`) } catch { /* no draft */ } }
    done++
    console.log(`  ✓ ${label} → ${out._id} (${acc.length} strings, ${relinked} links localized)`)
  }

  console.log(`\nDone. translated=${done} skipped=${skipped} errors=${errors}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
