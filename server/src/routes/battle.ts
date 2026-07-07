/**
 * Battle route:
 *   GET /api/battle/rating — PvP рейтинг игрока
 *
 * Начальный рейтинг: 1000.
 * Упрощение: пока не реализовано обновление рейтинга через PvP.
 * Возвращает 1000/0/0 если нет данных.
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/rating', authMiddleware, async (req: Request, res: Response) => {
  // Пока заглушка — возвращаем дефолтный рейтинг
  // В будущем: отдельная таблица battle_ratings с wins/losses/rating
  res.json({
    rating: 1000,
    wins: 0,
    losses: 0,
  });
});

export default router;
