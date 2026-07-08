/**
 * Save routes:
 *   GET  /save    — загрузить облачное сохранение
 *   POST /save    — сохранить на сервер
 *
 * Все данные хранятся в users.save_data (JSON-колонка).
 * Сервер НЕ парсит save_data — только хранит/отдаёт целиком.
 * Это гарантирует, что структура всегда совпадает с клиентом.
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateSaveData } from '../validation/save-data.js';

const router = Router();

// ── Приватный ключ для GetUserID ─────────────────────────────
interface SaveDataPayload {
  saveData?: any;
  badgesCount?: number;
  teamLevelSum?: number;
  money?: number;
  pokemonCount?: number;
  legendaryCount?: number;
  saveVersion?: number;
}

// ── GET /save ────────────────────────────────────────────────
// Загрузить сохранение. Если нет — вернёт save_data по умолчанию.
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const user = (await db.select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1))[0];

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let saveData;
    try {
      saveData = JSON.parse(user.save_data || '{}');
    } catch {
      saveData = {};
    }

    res.json({ saveData });
  } catch (err: any) {
    console.error('[save/get]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /save ───────────────────────────────────────────────
// Сохранить игру. Обновляет save_data и мета-поля (money, badges_count...).
// Этот же endpoint вызывается при pagehide с keepalive.
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const body = req.body as SaveDataPayload;
    if (!body.saveData) {
      res.status(400).json({ error: 'saveData is required' });
      return;
    }

    // ── Валидация структуры save_data ──
    const validation = validateSaveData(body.saveData);
    if (!validation.success) {
      console.warn(`[save] Validation rejected for user ${req.user!.userId}:`, validation.errors);
      res.status(422).json({
        error: 'Save data validation failed',
        details: validation.errors,
      });
      return;
    }

    const db = getDb();
    const userId = req.user!.userId;

    // ── Optimistic locking: проверяем save_version ──
    const currentUser = (await db.select({ save_version: users.save_version })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1))[0];

    if (!currentUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const clientVersion = body.saveVersion ?? 0;
    const serverVersion = currentUser.save_version ?? 0;

    // Если у клиента устаревшая версия — отклоняем
    if (clientVersion < serverVersion) {
      res.status(409).json({
        error: 'Save conflict: server has newer data',
        serverVersion,
      });
      return;
    }

    // Дополнительная проверка: если badges_count не совпадает с длиной badges — отклоняем
    const validatedBadges = validation.data.badges ?? [];
    if (body.badgesCount !== undefined && body.badgesCount !== validatedBadges.length) {
      res.status(422).json({
        error: 'Badge count mismatch',
        details: `Client reports ${body.badgesCount} badges but save_data has ${validatedBadges.length}`,
      });
      return;
    }

    // Сохраняем весь save_data целиком + инкрементим save_version
    const updateData: any = {
      save_data: JSON.stringify(body.saveData),
      save_version: serverVersion + 1,
    };

    // Обновляем мета-поля для быстрого доступа (leaderboard, profile)
    if (body.money !== undefined) updateData.money = body.money;
    if (body.badgesCount !== undefined) updateData.badges_count = body.badgesCount;
    if (body.pokemonCount !== undefined) updateData.pokemon_count = body.pokemonCount;
    updateData.last_seen = new Date().toISOString();

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[save/post]', err);
    // pagehide keepalive — клиент не ждёт ответа, но не должны падать
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
