/**
 * Начальные данные для PostgreSQL.
 * Вызывается при первом запуске (если таблицы пусты).
 */
import { connectDb, closeDb, getDb } from './index.js';
import { serverFeatures, dropConfig } from './schema.js';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('[seed] Seeding database...');
  connectDb();
  const db = getDb();

  const defaultFeatures = [
    { feature: 'double_exp', enabled: 0 },
    { feature: 'beta_mode', enabled: 0 },
    { feature: 'shiny_boost', enabled: 0 },
    { feature: 'free_shop', enabled: 0 },
  ];

  for (const feat of defaultFeatures) {
    const existing = await db
      .select()
      .from(serverFeatures)
      .where(eq(serverFeatures.feature, feat.feature))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(serverFeatures).values(feat);
      console.log(`[seed] Feature ${feat.feature} = ${feat.enabled}`);
    }
  }

  const existingDrop = await db.select().from(dropConfig).limit(1);
  if (existingDrop.length === 0) {
    await db.insert(dropConfig).values({
      monster_drops: JSON.stringify({}),
      // Valuable-категория удалена: универсальный пул пуст (миграция 0006
      // чистит старые строки).
      universal_drops: JSON.stringify([]),
    });
    console.log('[seed] Default drop config inserted');
  }

  console.log('[seed] Seed complete.');
  await closeDb();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Seed failed:', err);
  process.exit(1);
});
