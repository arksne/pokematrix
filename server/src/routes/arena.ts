/**
 * M-18: таблица лидеров PvP-Арены.
 *   GET /api/arena/leaders — топ-20 по победам, затем по лучшему стрику.
 * Источник — серверная таблица arena_stats (клиент её не пишет).
 */
import { Router, Request, Response } from 'express';
import { desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users, arenaStats } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/leaders', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = await db.select({
      userId: users.tg_id,
      nickname: users.nickname,
      first_name: users.first_name,
      username: users.username,
      wins: arenaStats.wins,
      streak: arenaStats.streak,
      best: arenaStats.best,
    }).from(arenaStats)
      .innerJoin(users, eq(users.id, arenaStats.user_id))
      .orderBy(desc(arenaStats.wins), desc(arenaStats.best))
      .limit(20);

    res.json({
      entries: rows.map((r) => ({
        userId: r.userId,
        name: r.nickname || r.first_name || r.username || 'Тренер',
        wins: r.wins || 0,
        streak: r.streak || 0,
        best: r.best || 0,
      })),
    });
  } catch (err: any) {
    console.error('[arena/leaders]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
