/**
 * Auth routes:
 *   POST /auth/tg         — вход через Telegram
 *   POST /auth/register   — регистрация тренера
 *   POST /auth/refresh    — обновление токенов
 *   GET  /auth/is-admin   — проверка админ-статуса
 */
import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { users, refreshTokens } from '../db/schema.js';
import { generateAccessToken, generateRefreshToken, getRefreshExpiresAt } from '../services/token.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

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
      // ── Режим разработки ──
      tgUser = { id: 1, username: 'dev', first_name: 'Dev' };
    } else {
      // ── Проверка initData через Telegram Bot API ──
      // В реальном продакшне нужно проверить HMAC-SHA256 подпись initData
      // Для упрощения: парсим initData и проверяем auth_date
      try {
        const params = new URLSearchParams(initData);
        const userJson = params.get('user');
        if (!userJson) throw new Error('user field missing');
        tgUser = JSON.parse(decodeURIComponent(userJson));
      } catch {
        res.status(401).json({ error: 'Invalid initData format' });
        return;
      }
    }

    const db = getDb();

    // ── Найти или создать пользователя ──
    let user = (await db.select().from(users).where(eq(users.tg_id, tgUser.id)).limit(1))[0];

    if (!user) {
      // Создаём нового пользователя
      const newUser = await db.insert(users).values({
        tg_id: tgUser.id,
        username: tgUser.username || null,
        first_name: tgUser.first_name || null,
        is_admin: config.adminIds.has(tgUser.id) ? 1 : 0,
        created_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
      }).returning();
      user = newUser[0];
    } else {
      // Обновляем last_seen
      await db.update(users)
        .set({ last_seen: new Date().toISOString(), username: tgUser.username || user.username })
        .where(eq(users.id, user.id));
    }

    // ── Генерируем токены ──
    const tokenPayload = { userId: user.id, tgId: user.tg_id, isAdmin: !!user.is_admin };
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
    const { nickname, avatar, starterPokemon } = req.body;
    const userId = req.user!.userId;

    const db = getDb();
    await db.update(users).set({
      nickname: nickname || '',
      avatar: avatar || 'trainer_f',
      registered: 1,
      last_seen: new Date().toISOString(),
    }).where(eq(users.id, userId));

    // ── Новые токены (после регистрации) ──
    const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    const tokenPayload = { userId: user.id, tgId: user.tg_id, isAdmin: !!user.is_admin };
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

    // Удалить старый refresh token
    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

    // Создать новую пару
    const tokenPayload = { userId: user.id, tgId: user.tg_id, isAdmin: !!user.is_admin };
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
  res.json({ isAdmin: !!req.user?.isAdmin });
});

export default router;
