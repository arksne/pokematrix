/**
 * Управление JWT и refresh token'ами.
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Сгенерировать access token (JWT) — короткоживущий.
 */
export function generateAccessToken(user: { userId: number; tgId: number; isAdmin: boolean; username?: string; firstName?: string }): string {
  return jwt.sign(
    {
      userId: user.userId,
      tgId: user.tgId,
      isAdmin: user.isAdmin,
      username: user.username || '',
      firstName: user.firstName || '',
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as any }
  );
}

/**
 * Сгенерировать refresh token (случайная строка).
 * Хранится в БД, используется для получения новой пары токенов.
 */
export function generateRefreshToken(): string {
  return crypto.randomUUID();
}

/**
 * Посчитать expires_at для refresh token (ISO строка).
 */
export function getRefreshExpiresAt(): string {
  return new Date(Date.now() + config.refreshTokenExpiresMs).toISOString();
}
