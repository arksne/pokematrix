/**
 * Drops route:
 *   GET /api/drops — конфигурация дропов (выпадаемых предметов)
 *
 * Если в БД нет конфига — отдаёт статические дефолты.
 * Клиент использует это как overrides для MONSTER_DROP_TABLE.
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import { dropConfig } from '../db/schema.js';

const router = Router();

// Дефолтные дропы (копия из src/ui/location.ts)
const DEFAULT_MONSTER_DROPS: Record<string, any> = {};
const DEFAULT_UNIVERSAL_DROPS = [
  { item: 'prettyWing', chance: 0.04, qty: 1 },
  { item: 'nugget', chance: 0.02, qty: 1 },
  { item: 'starPiece', chance: 0.01, qty: 1 },
];

router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const configs = await db.select().from(dropConfig).limit(1);
    const config = configs[0];

    res.json({
      monsterDrops: config ? JSON.parse(config.monster_drops) : DEFAULT_MONSTER_DROPS,
      universalDrops: config ? JSON.parse(config.universal_drops) : DEFAULT_UNIVERSAL_DROPS,
    });
  } catch (err: any) {
    console.error('[drops]', err);
    // При ошибке — отдаём дефолты (клиент всё равно падает на статику)
    res.json({
      monsterDrops: DEFAULT_MONSTER_DROPS,
      universalDrops: DEFAULT_UNIVERSAL_DROPS,
    });
  }
});

export default router;
