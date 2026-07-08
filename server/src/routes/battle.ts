/**
 * Battle routes:
 *   GET    /battle/state   — получить текущий battle_state
 *   POST   /battle/state   — сохранить/обновить battle_state
 *   DELETE /battle/state   — очистить battle_state
 *   GET    /battle/rating  — PvP рейтинг
 *
 * battle_state хранится в users.battle_state (JSON)
 * Авто-очистка: при GET проверяет timestamp — если бой старше 5 мин → очищает
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { users, battleRatings } from '../db/schema.js';

const router = Router();

// ── Константы ─────────────────────────────────────────────────
const BATTLE_TTL_MS = 5 * 60 * 1000; // 5 минут — таймаут для боя (защита от краша)

// ── POST /battle/state — сохранить/обновить battle_state ──────
router.post('/state', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { battleState } = req.body;
    if (!battleState || typeof battleState !== 'object') {
      res.status(400).json({ error: 'battleState object required' });
      return;
    }

    // Автоматически проставляем timestamp
    battleState._updatedAt = Date.now();

    const db = getDb();
    const userId = req.user!.userId;

    await db.update(users).set({
      battle_state: JSON.stringify(battleState),
    }).where(eq(users.id, userId));

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[battle/state POST]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /battle/state — получить battle_state ─────────────────
router.get('/state', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;
    const user = (await db.select({ battle_state: users.battle_state })
      .from(users).where(eq(users.id, userId)).limit(1))[0];

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let battleState: any = {};
    try { battleState = JSON.parse(user.battle_state || '{}'); } catch {}

    // ── Проверка таймаута — если бой висит больше 5 мин → очищаем ──
    if (battleState._updatedAt) {
      const elapsed = Date.now() - battleState._updatedAt;
      if (elapsed > BATTLE_TTL_MS) {
        await db.update(users).set({
          battle_state: '{}',
        }).where(eq(users.id, userId));
        res.json({ battleState: null, reason: 'timeout' });
        return;
      }
    }

    // Если есть battleType и это нормальный бой — возвращаем
    if (battleState.battleType && battleState.battleType !== 'none') {
      res.json({ battleState });
    } else {
      res.json({ battleState: null });
    }
  } catch (err: any) {
    console.error('[battle/state GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /battle/state — очистить battle_state ──────────────
router.delete('/state', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;

    await db.update(users).set({
      battle_state: '{}',
    }).where(eq(users.id, userId));

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[battle/state DELETE]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /battle/rating — PvP рейтинг ─────────────────────────
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
