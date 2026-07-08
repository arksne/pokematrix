/**
 * Battle route:
 *   GET /api/battle/rating — PvP рейтинг игрока
 *
 * Начальный рейтинг: 1000.
 * Упрощение: пока не реализовано обновление рейтинга через PvP.
 * Возвращает 1000/0/0 если нет данных.
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { battleRatings } from '../db/schema.js';

const router = Router();

router.get('/rating', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const row = (await db.select()
      .from(battleRatings)
      .where(eq(battleRatings.user_id, req.user!.userId))
      .limit(1))[0];

    res.json({
      rating: row?.rating || 1000,
      wins: row?.wins || 0,
      losses: row?.losses || 0,
    });
  } catch {
    res.json({ rating: 1000, wins: 0, losses: 0 });
  }
});

export default router;
