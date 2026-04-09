import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { sql } from 'drizzle-orm'
import { count } from 'drizzle-orm'

async function countPlatform(keyword: string): Promise<number> {
  const result = await db
    .select({ n: count() })
    .from(games)
    .where(sql`${games.platforms}::text ILIKE ${'%' + keyword + '%'}`)
  return result[0]?.n ?? 0
}

async function main() {
  const [pc, ps, xbox, sw, ios, android] = await Promise.all([
    countPlatform('PC'),
    countPlatform('PlayStation'),
    countPlatform('Xbox'),
    countPlatform('Switch'),
    countPlatform('iOS'),
    countPlatform('Android'),
  ])

  console.log(`PC            : ${pc}`)
  console.log(`PlayStation   : ${ps}`)
  console.log(`Xbox          : ${xbox}`)
  console.log(`Switch        : ${sw}`)
  console.log(`iOS           : ${ios}`)
  console.log(`Android       : ${android}`)
  console.log(`Mobile total  : ${Math.max(ios, android)} (overlap likely)`)
}

main().catch(console.error)
