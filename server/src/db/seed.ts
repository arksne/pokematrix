/**
 * Начальные данные для базы.
 * Вызывается при первом запуске (если таблицы пусты).
 * ON CONFLICT DO NOTHING — чтобы не перезаписывать при редеплое.
 */
import { connectDb, closeDb, getDb } from './index.js';
import { serverFeatures, dropConfig } from './schema.js';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('[seed] Seeding database...');
  const { db } = connectDb();

  // ── Серверные фичи (тогглы) ──
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

  // ── Дроп-конфиг (дефолтный) ──
  const existingDrop = await db
    .select()
    .from(dropConfig)
    .limit(1);

  if (existingDrop.length === 0) {
    await db.insert(dropConfig).values({
      monster_drops: JSON.stringify({
        // Дефолтные дропы: формат как ожидает клиент
        // location.ts: processMonsterDrop проверяет state.serverDropConfig
      }),
      universal_drops: JSON.stringify([
        { item: 'prettyWing', chance: 0.04, qty: 1 },
        { item: 'nugget', chance: 0.02, qty: 1 },
        { item: 'starPiece', chance: 0.01, qty: 1 },
      ]),
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
