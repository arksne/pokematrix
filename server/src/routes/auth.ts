/**
 * Auth routes:
 *   POST /auth/tg         — вход через Telegram
 *   POST /auth/register   — регистрация тренера
 *   POST /auth/refresh    — обновление токенов
 *   GET  /auth/is-admin   — проверка админ-статуса
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { users, refreshTokens } from '../db/schema.js';
import { generateAccessToken, generateRefreshToken, getRefreshExpiresAt } from '../services/token.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/** Максимальный возраст initData (Telegram рекомендует проверять подлинность в течение часа). */
const MAX_INIT_DATA_AGE_SEC = 3600;

/**
 * Допустимые аватары тренера. Должны совпадать с TRAINER_AVATARS в src/game/auth.ts.
 * Всё, чего здесь нет, отбрасывается — иначе значение попадёт в innerHTML на клиенте.
 */
const VALID_AVATARS = new Set([
  'trainer_f',
  'trainer_m',
  'ninja',
  'sailor',
  'super_nerd',
  'beauty',
  'gentleman',
]);

/**
 * Верификация initData от Telegram Mini App.
 * Проверяет HMAC-SHA256 подпись через BOT_TOKEN.
 * Возвращает params если подпись верна, null если нет.
 * Если botToken не задан, пропускает проверку (dev-режим).
 */
function verifyTelegramInitData(initData: string, botToken: string): URLSearchParams | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  // auth_date: не старше MAX_INIT_DATA_AGE секунд, иначе перехваченная строка
  // initData оставалась бы валидной навсегда (бессрочный replay).
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (ageSec > MAX_INIT_DATA_AGE_SEC || ageSec < -60) return null;

  // Удаляем hash, сортируем параметры
  params.delete('hash');
  const sorted = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // HMAC-SHA256: secret = HMAC_SHA256("WebAppData", botToken)
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secret).update(sorted).digest('hex');

  // Сравнение постоянного времени, чтобы нельзя было подбирать подпись по таймингу.
  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(hash, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return params;
}

// ── POST /auth/tg ────────────────────────────────────────────
// Вход через Telegram Mini App initData.
// В dev-режиме можно без проверки.
router.post('/tg', async (req: Request, res: Response) => {
  try {
    const { initData } = req.body;
    if (!initData) {
      res.status(400).json({ error: 'initData is required' });
      return;
    }

    let tgUser: { id: number; username?: string; first_name?: string };

    if (config.allowDevLogin && initData === 'test') {
      // ── Режим разработки (требует ALLOW_DEV_LOGIN=true) ──
      tgUser = { id: 1, username: 'dev', first_name: 'Dev' };
    } else {
      // ── HMAC-SHA256 верификация Telegram initData ──
      // Небезопасного fallback'а «BOT_TOKEN не задан — просто распарсим user» больше нет:
      // он позволял без каких-либо учётных данных получить JWT на любой tg_id,
      // то есть захватить чужой аккаунт вместе с его save_data.
      if (!config.botToken) {
        console.error('[auth/tg] BOT_TOKEN is not set — refusing to authenticate');
        res.status(503).json({ error: 'Server is not configured for Telegram login' });
        return;
      }
      const params = verifyTelegramInitData(initData, config.botToken);
      if (!params) {
        res.status(401).json({ error: 'Invalid initData signature' });
        return;
      }
      const userJson = params.get('user');
      if (!userJson) {
        res.status(401).json({ error: 'user field missing in initData' });
        return;
      }
      try {
        tgUser = JSON.parse(decodeURIComponent(userJson));
      } catch {
        res.status(401).json({ error: 'Invalid user data in initData' });
        return;
      }
      if (!Number.isInteger(tgUser.id) || tgUser.id <= 0) {
        res.status(401).json({ error: 'Invalid user id in initData' });
        return;
      }
    }

    const db = getDb();

    // ── Найти или создать пользователя (через UPSERT без race condition) ──
    const result = await db.insert(users).values({
      tg_id: tgUser.id,
      username: tgUser.username || null,
      first_name: tgUser.first_name || null,
      is_admin: config.adminIds.has(tgUser.id) ? 1 : 0,
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    }).onConflictDoNothing().returning();

    let user: typeof users.$inferSelect;
    if (result.length > 0) {
      user = result[0];
    } else {
      // Пользователь уже существовал — читаем его
      user = (await db.select().from(users).where(eq(users.tg_id, tgUser.id)).limit(1))[0]!;
      // Обновляем last_seen
      await db.update(users)
        .set({
          last_seen: new Date().toISOString(),
          username: tgUser.username || user.username,
          is_admin: config.adminIds.has(tgUser.id) ? 1 : 0,
        })
        .where(eq(users.id, user.id));
    }

    // ── Генерируем токены ──
    const tokenPayload = { userId: user.id, tgId: user.tg_id, isAdmin: !!user.is_admin, username: user.username || '', firstName: user.first_name || '' };
    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken();

    await db.insert(refreshTokens).values({
      user_id: user.id,
      token: refreshToken,
      expires_at: getRefreshExpiresAt(),
    });

    res.json({
      token,
      refreshToken,
      user: {
        id: user.tg_id,
        username: user.username || '',
        first_name: user.first_name || '',
        registered: user.registered,
        is_admin: !!user.is_admin,
      },
    });
  } catch (err: any) {
    console.error('[auth/tg]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/register ──────────────────────────────────────
// Регистрация: ник, аватар, стартовый покемон.
router.post('/register', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { nickname, avatar } = req.body;
    const userId = req.user!.userId;

    // ── Санитизация nickname (XSS-защита) ──
    const safeNickname = (nickname || '')
      .replace(/[<>&"']/g, '')    // удаляем HTML-спецсимволы
      .trim()
      .slice(0, 32);               // макс 32 символа

    const db = getDb();

    // avatar рендерится клиентом через innerHTML, поэтому принимаем только
    // закрытый список спрайтов из TRAINER_AVATARS. Раньше сюда писалось любое
    // значение — это давало stored XSS (например '/avatars/x" onerror=...'),
    // а refresh-токен лежит в localStorage, то есть это был захват аккаунтов.
    const safeAvatar = VALID_AVATARS.has(avatar) ? avatar : 'trainer_f';

    await db.update(users).set({
      nickname: safeNickname,
      avatar: safeAvatar,
      registered: 1,
      last_seen: new Date().toISOString(),
    }).where(eq(users.id, userId));

    // ── Новые токены (после регистрации) ──
    const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    const tokenPayload = { userId: user.id, tgId: user.tg_id, isAdmin: !!user.is_admin, username: user.username || '', firstName: user.first_name || '' };
    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken();

    await db.insert(refreshTokens).values({
      user_id: user.id,
      token: refreshToken,
      expires_at: getRefreshExpiresAt(),
    });

    res.json({ token, refreshToken });
  } catch (err: any) {
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/refresh ───────────────────────────────────────
// Обновление пары токенов по refresh token.
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }

    const db = getDb();

    // Найти refresh token в БД
    const stored = (await db.select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, refreshToken))
      .limit(1))[0];

    if (!stored) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    // ── Детекция повторного использования refresh token ──
    if (stored.consumed_at) {
      // Токен УЖЕ БЫЛ использован — кто-то пытается переиспользовать
      console.warn(`[auth/refresh] Token reuse detected! user_id=${stored.user_id}, token_id=${stored.id}`);
      // Инвалидируем ВСЕ refresh-токены пользователя (stolen token)
      await db.delete(refreshTokens).where(eq(refreshTokens.user_id, stored.user_id));
      res.status(401).json({ error: 'Session compromised — please re-login' });
      return;
    }

    // Проверить срок действия
    if (new Date(stored.expires_at) < new Date()) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
      res.status(401).json({ error: 'Refresh token expired' });
      return;
    }

    // Найти пользователя
    const user = (await db.select().from(users).where(eq(users.id, stored.user_id)).limit(1))[0];
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Пометить старый токен как использованный.
    // UPDATE с условием consumed_at IS NULL делает это атомарно: раньше SELECT и
    // UPDATE шли раздельно, поэтому два параллельных refresh с одним токеном
    // оба видели consumed_at = null и оба получали действующую пару токенов —
    // детект повторного использования обходился гонкой.
    const consumed = await db.update(refreshTokens)
      .set({ consumed_at: new Date().toISOString() })
      .where(and(eq(refreshTokens.id, stored.id), isNull(refreshTokens.consumed_at)))
      .returning({ id: refreshTokens.id });

    if (consumed.length === 0) {
      // Токен уже израсходован другим запросом — это повторное использование.
      console.warn(`[auth/refresh] Concurrent reuse detected! user_id=${stored.user_id}, token_id=${stored.id}`);
      await db.delete(refreshTokens).where(eq(refreshTokens.user_id, stored.user_id));
      res.status(401).json({ error: 'Session compromised — please re-login' });
      return;
    }

    // Создать новую пару
    const tokenPayload = { userId: user.id, tgId: user.tg_id, isAdmin: !!user.is_admin, username: user.username || '', firstName: user.first_name || '' };
    const newToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken();

    await db.insert(refreshTokens).values({
      user_id: user.id,
      token: newRefreshToken,
      expires_at: getRefreshExpiresAt(),
    });

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (err: any) {
    console.error('[auth/refresh]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /auth/is-admin ───────────────────────────────────────
router.get('/is-admin', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const user = (await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1))[0];
    res.json({ isAdmin: !!user?.is_admin });
  } catch {
    res.json({ isAdmin: false });
  }
});

export default router;
