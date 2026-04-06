import { db } from '../src/lib/db';
import { games, gameScores } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const rows = await db
    .select({
      title: games.title,
      ris: gameScores.ris,
      dopamineRisk: gameScores.dopamineRisk,
      monetizationRisk: gameScores.monetizationRisk,
      socialRisk: gameScores.socialRisk,
      accessibilityRisk: gameScores.accessibilityRisk,
      endlessDesignRisk: gameScores.endlessDesignRisk,
    })
    .from(gameScores)
    .innerJoin(games, eq(games.id, gameScores.gameId));

  for (const r of rows) {
    console.log(r.title);
    console.log('  dopamine:     ', (r.dopamineRisk ?? 0).toFixed(2));
    console.log('  monetization: ', (r.monetizationRisk ?? 0).toFixed(2));
    console.log('  social:       ', (r.socialRisk ?? 0).toFixed(2));
    console.log('  accessibility:', (r.accessibilityRisk ?? 0).toFixed(2));
    console.log('  endless:      ', (r.endlessDesignRisk ?? 0).toFixed(2));
    console.log('  RIS:          ', (r.ris ?? 0).toFixed(2));
    console.log();
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
