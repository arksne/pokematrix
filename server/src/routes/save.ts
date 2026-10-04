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
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users, saveHistory } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateSaveData } from '../validation/save-data.js';

import { parseSaveStrict, SaveParseError, countSavePokemon } from '../db/save-json.js';

const router = Router();

/** Сколько копий сейва хранить на пользователя. */
const HISTORY_LIMIT = 10;

// ── Приватный ключ для GetUserID ─────────────────────────────
interface SaveDataPayload {
  saveData?: any;
  badgesCount?: number;
  teamLevelSum?: number;
  money?: number;
  pokemonCount?: number;
  legendaryCount?: number;
  saveVersion?: number;
  /** Намеренный сброс прогресса. Без этого флага пустой сейв отклоняется. */
  reset?: boolean;
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

    // Повреждённый сейв должен быть виден, а не выглядеть как его отсутствие.
    // Раньше здесь мягкий разбор подставлял {} и отдавал 200: клиент получал
    // «сейва нет», init.ts считал это плохим сейвом и уводил игрока в giveStarter.
    let saveData;
    try {
      saveData = parseSaveStrict(user.save_data, user.id);
    } catch (e) {
      if (e instanceof SaveParseError) {
        res.status(500).json({
          error: 'Stored save is corrupt and cannot be parsed',
          hint: 'restore it from save_history via the admin API',
        });
        return;
      }
      throw e;
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

    // ── Optimistic locking + защита от затирания прогресса ──
    const currentUser = (await db.select({
      save_version: users.save_version,
      money: users.money,
      save_data: users.save_data,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1))[0];

    if (!currentUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const clientVersion = body.saveVersion ?? 0;
    const serverVersion = currentUser.save_version ?? 0;

    // Оптимистическая блокировка. Раньше сравнение шло против порядка величин
    // разных шкал: клиент присылает Date.now() (~1.8e12), сервер считает до
    // единиц, поэтому условие не срабатывало никогда. Сравниваем только когда
    // клиент прислал версию того же вида, что и серверная (малое целое).
    if (
      Number.isInteger(clientVersion) &&
      clientVersion > 0 &&
      clientVersion < 1_000_000_000 &&
      clientVersion < serverVersion
    ) {
      res.status(409).json({
        error: 'Save conflict: server has newer data',
        serverVersion,
      });
      return;
    }

    // ── Главная защита от потери прогресса ──
    // Клиент шлёт save_data целиком. Если он прислал состояние без единого
    // покемона, а в базе команда есть — это не «новая игра», а потеря данных:
    // именно так клиент с незагруженным состоянием затирал реальный сейв при
    // старте. Сброс игры идёт отдельным флагом reset.
    const stored = parseSaveStrict(currentUser.save_data, userId);
    const storedCount = countSavePokemon(stored);
    const incomingCount = countSavePokemon(body.saveData);

    if (incomingCount === 0 && storedCount > 0 && !body.reset) {
      console.warn(
        `[save] Отклонено затирание прогресса: user ${userId}, в базе ${storedCount} покемонов, ` +
        `в запросе 0. Клиент должен прислать reset: true, если это намеренный сброс.`,
      );
      res.status(409).json({
        error: 'Refusing to overwrite a non-empty save with an empty one',
        storedPokemon: storedCount,
        hint: 'send reset: true for an intentional wipe',
      });
      return;
    }

    // ── Бэкап прежнего сейва ──
    // Копия делается не на каждом сохранении, а только когда она может
    // понадобиться: при откате по числу покемонов, при намеренном сбросе и при
    // административных правках. Раньше архивировалось каждое автосохранение, и
    // при HISTORY_LIMIT = 10 хорошая копия вытеснялась за десять сохранений —
    // то есть за минуты обычной игры. Хранилище, из которого нельзя
    // восстановиться, бесполезно.
    const isRegression = incomingCount < storedCount;
    const worthArchiving = body.reset || isRegression;
    if (worthArchiving && currentUser.save_data) {
      try {
        await db.insert(saveHistory).values({
          user_id: userId,
          save_data: currentUser.save_data,
          save_version: serverVersion,
          reason: body.reset ? 'reset' : (isRegression ? 'regression' : 'overwrite'),
          created_at: new Date().toISOString(),
        });
        // Подрезаем историю, чтобы она не росла бесконечно.
        await db.execute(sql`
          DELETE FROM save_history
          WHERE user_id = ${userId}
            AND id NOT IN (
              SELECT id FROM save_history WHERE user_id = ${userId}
              ORDER BY id DESC LIMIT ${HISTORY_LIMIT}
            )
        `);
      } catch (e: any) {
        // Бэкап не удался — не пишем, но и не роняем сохранение целиком:
        // предупреждаем и продолжаем, иначе игрок потеряет прогресс из-за
        // служебной ошибки. Событие важное, поэтому дублируем в stderr.
        console.error(`[save] НЕ УДАЛОСЬ сохранить бэкап для user ${userId}:`, e);
      }
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

    // Клиент не управляет деньгами, количеством покемонов и баджами: эти поля
    // считаются из проверенного save_data. Раньше money брался из тела запроса
    // вообще вне Zod-схемы, а money — колонка int4, то есть значение 1e300
    // роняло сохранение с 500.
    const moneyFromSave = Number(validation.data.inventory?.['credit'] ?? 0);
    const money = Number.isFinite(moneyFromSave)
      ? Math.min(Math.max(Math.trunc(moneyFromSave), 0), 2_000_000_000)
      : currentUser.money ?? 0;
    const pokemonCount = countSavePokemon(validation.data);

    const updateData: any = {
      save_data: JSON.stringify(body.saveData),
      save_version: serverVersion + 1,
      money,
      badges_count: validatedBadges.length,
      pokemon_count: pokemonCount,
      last_seen: new Date().toISOString(),
    };

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
