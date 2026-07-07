/**
 * Leaderboard route:
 *   GET /api/leaderboard — таблица лидеров
 *
 * Сортировка: по значки → по покемонам → по деньгам.
 * Только зарегистрированные пользователи.
 */
import { Router, Request, Response } from 'express';
import { desc, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const entries = await db.select({
      userId: users.tg_id,
      first_name: users.first_name,
      username: users.username,
      trainerNickname: users.nickname,
      badges_count: users.badges_count,
      pokemon_count: users.pokemon_count,
      money: users.money,
    }).from(users)
      .where(sql`${users.registered} = 1`)
      .orderBy(desc(users.badges_count), desc(users.pokemon_count), desc(users.money))
      .limit(100);

    // Добавляем legendary_count из save_data
    const enriched = entries.map((entry) => ({
      ...entry,
      legendary_count: 0, // упрощение: не парсим save_data для 100 записей
      trainerNickname: entry.trainerNickname || null,
    }));

    res.json({ entries: enriched });
  } catch (err: any) {
    console.error('[leaderboard]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
