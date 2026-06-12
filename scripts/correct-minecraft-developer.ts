/**
 * One-off correction (P1-8): Minecraft's developer was ingested as "4J Studios"
 * (the console porting house) because the old mapper took RAWG developers[0].
 * RAWG lists ["4J Studios", "Mojang"]; the corrected mapper (pickPrimaryDeveloper)
 * yields "Mojang". This script brings the existing row in line with that.
 *
 * Idempotent and narrow: only updates the `minecraft` row, and only if it is
 * still the stale "4J Studios" value. Re-ingesting Minecraft through the fixed
 * mapper has the same effect.
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/correct-minecraft-developer.ts
 */

import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

async function main() {
  const updated = await db
    .update(games)
    .set({ developer: 'Mojang', updatedAt: new Date() })
    .where(and(eq(games.slug, 'minecraft'), eq(games.developer, '4J Studios')))
    .returning({ slug: games.slug, developer: games.developer })

  if (updated.length > 0) {
    console.log(`Corrected: ${updated[0].slug} → developer "${updated[0].developer}"`)
  } else {
    console.log('No change — Minecraft is not on the stale "4J Studios" value (already corrected?).')
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('Correction failed:', err)
  process.exit(1)
})
