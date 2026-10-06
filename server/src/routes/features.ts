/**
 * Features route:
 *   GET /api/features — включённые серверные фичи для ВСЕХ игроков.
 *
 * Публичный (без auth): клиент читает при старте и применяет эффекты
 * (double_exp, shiny_boost, free_shop, beta_mode). Переключаются админкой
 * (POST /admin/api {cmd: toggle_feature}).
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { serverFeatures } from '../db/schema.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = await db.select().from(serverFeatures);
    const features: Record<string, boolean> = {};
    for (const r of rows) features[r.feature] = !!r.enabled;
    res.json({ features });
  } catch (err: any) {
    console.error('[features]', err);
    res.json({ features: {} });
  }
});

export default router;
