/**
 * revise-sv-sanity.ts
 *
 * Edits existing Swedish Sanity editorial docs (guide / post / faqItem) in place to
 * (a) strip the em-dash overuse English translations carry over and (b) de-AI the
 * prose so it reads like a professional Swedish writer wrote it from scratch — no
 * calques, no anglicisms, no formulaic AI tells. It does NOT retranslate or change
 * meaning, and it preserves Portable Text structure (blocks, marks, link defs)
 * untouched: only span `text` and plain string fields are rewritten.
 *
 * Runs through the headless Claude Code CLI (Max plan, no API spend) on Sonnet.
 *
 * Usage:
 *   npx tsx scripts/revise-sv-sanity.ts --dry            # list docs + string counts
 *   npx tsx scripts/revise-sv-sanity.ts --limit 1        # revise one doc → DRAFT
 *   npx tsx scripts/revise-sv-sanity.ts                  # all docs → DRAFTS
 *   npx tsx scripts/revise-sv-sanity.ts --publish        # write live docs
 *
 * Requires NEXT_PUBLIC_SANITY_PROJECT_ID + SANITY_API_TOKEN (Editor) in .env.local.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createClient } from '@sanity/client'
import { runClaudeCli } from '@/lib/claude-cli'

const DO_NOT_TRANSLATE = ['LumiKin', 'LumiScore', 'ESRB', 'PEGI', 'Metacritic', 'RAWG', 'IGDB']

const args   = process.argv.slice(2)
const getArg = (n: string) =>
  args.find(a => a.startsWith(`--${n}=`))?.split('=')[1]
  ?? (args.indexOf(`--${n}`) !== -1 ? args[args.indexOf(`--${n}`) + 1] : undefined)
const DRY     = args.includes('--dry')
const PUBLISH = args.includes('--publish')
const LIMIT   = getArg('limit') ? parseInt(getArg('limit')!, 10) : Infinity
const SLUG    = getArg('slug')

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const token     = process.env.SANITY_API_TOKEN
if (!projectId) { console.error('NEXT_PUBLIC_SANITY_PROJECT_ID is required'); process.exit(1) }
if (!token && !DRY) { console.error('SANITY_API_TOKEN (Editor role) is required to write'); process.exit(1) }

const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false })

// ─── Collect rewritable strings (same surface as translate-sanity) ───────────────

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

// ─── Revision prompt ─────────────────────────────────────────────────────────────

const SYSTEM = `You are a professional Swedish editor improving existing Swedish translations of parental game-guidance articles. The text was machine-translated from English and reads like it: too many em dashes and too many literal English structures.

You receive a JSON array of Swedish strings. Return ONLY a JSON array of the SAME length and SAME order, where each element is your improved version of the corresponding input element. No prose, no markdown around the JSON — just the array.

WHAT TO FIX:
- Em dashes (—): English overuses them, Swedish prose rarely does. Replace with a comma, a colon, parentheses, or by splitting into two sentences — whichever reads most naturally. Keep an em dash only in the rare case nothing else works.
- Calques and anglicisms: recast word-for-word English sentence structures and idioms into natural, idiomatic Swedish.
- AI tells: kill formulaic transitions, robotic parallelism, over-hedging, and filler like "Det är viktigt att notera/att komma ihåg". Make it read as if a professional Swedish writer wrote it from scratch.
- General flow and word choice, where it is stilted.

HARD CONSTRAINTS:
- Do NOT change meaning, add information, or drop information. Same facts, same claims, same numbers.
- Output array length MUST equal input length. Do NOT merge, split, reorder, add, or remove elements.
- Many elements are sentence FRAGMENTS (a clause split off by bold/link formatting). Revise the wording of a fragment but keep it a fragment — never turn it into a full sentence and never move words between elements. You may split into two sentences only WITHIN a single element, never across elements.
- Preserve inline markdown/HTML, placeholders, URLs, and numbers verbatim.
- Reproduce these terms exactly, never translate them: ${DO_NOT_TRANSLATE.join(', ')}.
- If an element already reads naturally and has no em dash, return it unchanged.`

function parseArray(text: string, n: number): string[] | null {
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) return null
  try {
    const arr = JSON.parse(m[0])
    if (Array.isArray(arr) && arr.length === n && arr.every(s => typeof s === 'string')) return arr
  } catch { /* fall through */ }
  return null
}

const CHUNK = 25
let aborted = false

async function reviseChunk(strings: string[]): Promise<string[] | null> {
  for (let attempt = 0; attempt < 2 && !aborted; attempt++) {
    const r = await runClaudeCli(SYSTEM, JSON.stringify(strings), 'sonnet', 240_000)
    if (!r.ok) {
      if (r.quotaExhausted) { aborted = true; console.error('    ⛔ compute quota exhausted — stopping'); return null }
      continue
    }
    const arr = parseArray(r.text, strings.length)
    if (arr) return arr
  }
  if (aborted || strings.length <= 1) return null
  const mid = Math.ceil(strings.length / 2)
  const a = await reviseChunk(strings.slice(0, mid)); if (!a) return null
  const b = await reviseChunk(strings.slice(mid));    if (!b) return null
  return [...a, ...b]
}

async function reviseStrings(strings: string[]): Promise<string[] | null> {
  const out: string[] = []
  for (let i = 0; i < strings.length && !aborted; i += CHUNK) {
    const arr = await reviseChunk(strings.slice(i, i + CHUNK))
    if (!arr) { console.warn(`    ⚠ chunk ${i}-${i + Math.min(CHUNK, strings.length - i)} failed`); return null }
    out.push(...arr)
  }
  return aborted ? null : out
}

const countEm = (ss: string[]) => ss.reduce((n, s) => n + (s.match(/—/g) || []).length, 0)

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  let docs = await client.fetch<Doc[]>(
    `*[_type in ["guide","post","faqItem"] && locale == "sv" && !(_id in path("drafts.**"))]`,
  )
  if (SLUG) docs = docs.filter(d => (d.slug as { current?: string })?.current === SLUG)
  console.log(`\nSanity sv revision  via sonnet / Max CLI`)
  console.log(`Swedish docs: ${docs.length}  ${DRY ? '(DRY)' : PUBLISH ? '(PUBLISH)' : '(DRAFT)'}\n`)

  if (DRY) {
    for (const d of docs) {
      const ss = collect(structuredClone(d)).map(a => a.get())
      console.log(`  ${String(d._type).padEnd(8)} ${(d.slug as { current?: string })?.current ?? d._id}  — ${ss.length} strings, ${countEm(ss)} em-dashes`)
    }
    process.exit(0)
  }

  let done = 0, skipped = 0, errors = 0
  for (const src of docs) {
    if (done + errors >= LIMIT) break
    const out = structuredClone(src)
    const acc = collect(out)
    const label = `${src._type} ${(src.slug as { current?: string })?.current ?? src._id}`
    if (acc.length === 0) { skipped++; continue }

    const before = acc.map(a => a.get())
    const revised = await reviseStrings(before)
    if (!revised) { errors++; console.warn(`  ⚠ ${label} — revision failed`); continue }
    acc.forEach((a, i) => a.set(revised[i]))

    const baseId = String(src._id)
    out._id = PUBLISH ? baseId : `drafts.${baseId}`
    delete out._rev; delete out._updatedAt

    await client.createOrReplace(out as Doc & { _id: string; _type: string })
    // In publish mode, clear any stale draft of the same doc so Studio stays clean.
    if (PUBLISH) { try { await client.delete(`drafts.${baseId}`) } catch { /* no draft */ } }
    done++
    console.log(`  ✓ ${label} → ${out._id}  (em-dashes ${countEm(before)} → ${countEm(revised)})`)
  }

  console.log(`\nDone. revised=${done} skipped=${skipped} errors=${errors}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
