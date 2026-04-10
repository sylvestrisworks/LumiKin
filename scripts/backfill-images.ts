/**
 * Backfill script: uploads all RAWG game images to Vercel Blob
 * and updates the backgroundImage column in the DB.
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/backfill-images.ts
 *
 * Options:
 *   --dry-run   Print what would be done without uploading or updating
 *   --limit N   Only process N games (useful for testing)
 */

import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { isNotNull, not, like, eq } from 'drizzle-orm'
import { uploadImageFromUrl } from '../src/lib/blob'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity

const BLOB_PREFIX = 'https://blob.vercel-storage.com'
const VERCEL_BLOB_PREFIX = 'https://'  // Vercel blob URLs start with https://*.public.blob.vercel-storage.com

function isAlreadyBlobUrl(url: string | null): boolean {
  if (!url) return false
  return url.includes('blob.vercel-storage.com') || url.includes('public.blob.vercel-storage.com')
}

async function main() {
  console.log(`\n🖼  PlaySmart — Image Backfill${DRY_RUN ? ' (DRY RUN)' : ''}\n`)

  if (!process.env.BLOB_READ_WRITE_TOKEN && !DRY_RUN) {
    console.error('❌ BLOB_READ_WRITE_TOKEN is not set. Add it to .env and try again.')
    process.exit(1)
  }

  // Fetch all games that have a backgroundImage but it's not already a Blob URL
  const rows = await db
    .select({ id: games.id, slug: games.slug, title: games.title, backgroundImage: games.backgroundImage })
    .from(games)
    .where(isNotNull(games.backgroundImage))

  const toProcess = rows
    .filter(r => !isAlreadyBlobUrl(r.backgroundImage))
    .slice(0, LIMIT === Infinity ? rows.length : LIMIT)

  const alreadyMigrated = rows.length - toProcess.length

  console.log(`  Total games with images : ${rows.length}`)
  console.log(`  Already on Blob         : ${alreadyMigrated}`)
  console.log(`  To process              : ${toProcess.length}`)
  if (DRY_RUN) console.log(`  (dry run — no changes will be made)\n`)

  let succeeded = 0
  let failed = 0

  // Process in batches of 5 to avoid hammering RAWG CDN
  const BATCH = 5
  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH)
    await Promise.all(batch.map(async (game) => {
      process.stdout.write(`  [${i + batch.indexOf(game) + 1}/${toProcess.length}] ${game.title.slice(0, 40).padEnd(40)} `)

      if (DRY_RUN) {
        console.log(`→ ${game.backgroundImage?.slice(0, 60)}`)
        succeeded++
        return
      }

      const blobUrl = await uploadImageFromUrl(game.backgroundImage!, `games/${game.slug}`)
      if (blobUrl) {
        await db.update(games).set({ backgroundImage: blobUrl }).where(eq(games.id, game.id))
        console.log(`✓`)
        succeeded++
      } else {
        console.log(`✗ failed`)
        failed++
      }
    }))
  }

  console.log(`\n  Done. ${succeeded} uploaded, ${failed} failed, ${alreadyMigrated} already on Blob.`)
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
