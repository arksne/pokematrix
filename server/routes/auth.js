/**
 * Auth routes — Telegram login, JWT refresh, registration, logout.
 *
 * Key design decisions:
 * - Brute force via `login_attempts` SQLite table (persists across restarts)
 * - Rate limiting via express-rate-limit (3 separate limiters)
 * - Refresh token rotation: DELETE used token, INSERT new one (same family_id)
 * - Theft detection via family_id mismatch
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyTelegramInitData, parseTestUser } from '../auth.js';
import { getDB } from '../db.js';
import { generateAccessToken, generateRefreshToken, authMiddleware, REFRESH_TOKEN_EXPIRY_DAYS } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { asyncHandler, AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AVATARS_DIR = path.join(__dirname, '../../public/avatars');

// Admin access config from env vars (shared with admin.js)
const ADMIN_IDS = (process.env.ADMIN_IDS || '1394113078').split(',').map(Number).filter(n => !isNaN(n));
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || 'nineinchkn5atmythroat').split(',');

// ── Auth-specific rate limiters ──────────────────────────────────────────
const tgLoginLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 minute window
  max: 10,                      // 10 attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Попробуйте через минуту.', code: 'RATE_LIMITED' },
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,                      // 20 refresh attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов обновления токена.', code: 'RATE_LIMITED' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,                       // 5 registration attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов регистрации.', code: 'RATE_LIMITED' },
});

// ── Brute-force protection (DB-backed, survives restarts) ────────────────
const BRUTE_WINDOW_MS = 10 * 60 * 1000;  // 10 min
const BRUTE_MAX_ATTEMPTS = 5;            // 5 failed attempts → lockout

async function checkBruteForceDB(ip) {
  try {
    const db = getDB();
    // Clean expired entries first
    const cutoff = new Date(Date.now() - BRUTE_WINDOW_MS).toISOString();
    await db.run('DELETE FROM login_attempts WHERE first_attempt < ?', cutoff);

    const row = await db.get(
      'SELECT COUNT(*) as cnt FROM login_attempts WHERE ip = ? AND first_attempt > ?',
      ip, cutoff
    );
    if (!row) return true;
    return row.cnt < BRUTE_MAX_ATTEMPTS;
  } catch (err) {
    logger.error({ err, ip }, 'checkBruteForceDB error');
    return true; // Fail open on DB error
  }
}

async function recordBruteForceDB(ip) {
  try {
    const db = getDB();
    const cutoff = new Date(Date.now() - BRUTE_WINDOW_MS).toISOString();
    // Update existing record if within window, otherwise insert new
    const existing = await db.get(
      'SELECT id FROM login_attempts WHERE ip = ? AND first_attempt > ?',
      ip, cutoff
    );
    if (existing) {
      await db.run(
        'UPDATE login_attempts SET attempts = attempts + 1 WHERE id = ?',
        existing.id
      );
    } else {
      await db.run(
        'INSERT INTO login_attempts (ip, attempts, first_attempt) VALUES (?, 1, ?)',
        ip, new Date().toISOString()
      );
    }
  } catch (err) {
    logger.error({ err, ip }, 'recordBruteForceDB error');
  }
}

async function resetBruteForceDB(ip) {
  try {
    const db = getDB();
    await db.run('DELETE FROM login_attempts WHERE ip = ?', ip);
  } catch (err) {
    logger.error({ err, ip }, 'resetBruteForceDB error');
  }
}

// Clean old brute force entries periodically (every 5 minutes)
setInterval(async () => {
  try {
    const db = getDB();
    const cutoff = new Date(Date.now() - BRUTE_WINDOW_MS).toISOString();
    const result = await db.run('DELETE FROM login_attempts WHERE first_attempt < ?', cutoff);
    if (result.changes > 0) {
      logger.debug({ deleted: result.changes }, 'Brute-force cleanup');
    }
  } catch (err) {
    logger.error({ err }, 'Brute-force cleanup error');
  }
}, 5 * 60 * 1000);

// ── Refresh token helpers ───────────────────────────────────────────────
async function issueRefreshToken(db, userId, familyId) {
  const token = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 86400000).toISOString();
  await db.run(
    'INSERT INTO refresh_tokens (user_id, token, expires_at, family_id) VALUES (?, ?, ?, ?)',
    userId, token, expiresAt, familyId || token
  );
  return token;
}

// ── Routes ──────────────────────────────────────────────────────────────
const router = Router();

// POST /api/auth/tg — Telegram initData login
router.post('/tg', tgLoginLimiter, asyncHandler(async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  // Check DB-backed brute force BEFORE processing
  const bruteAllowed = await checkBruteForceDB(clientIp);
  if (!bruteAllowed) {
    logger.warn({ ip: clientIp }, 'Brute-force block on /tg');
    return res.status(429).json({
      error: 'Слишком много неудачных попыток. Попробуйте через 10 минут.',
      code: 'BRUTE_FORCE_BLOCK',
    });
  }

  const { initData } = req.body;
  const botToken = process.env.BOT_TOKEN;
  const isProduction = process.env.NODE_ENV === 'production';
  const isRealInitData = initData && initData !== 'test';
  let tgUser;

  // Custom test user via JSON initData (for multi-trainer Playwright testing)
  if (initData && initData.startsWith('{') && !isProduction) {
    tgUser = parseTestUser(initData);
  } else if (!isRealInitData) {
    if (initData === 'test') {
      // Dev/demo mode: bypass Telegram auth when no BOT_TOKEN or explicitly allowed
      if (!botToken) {
        logger.info('BOT_TOKEN not set — allowing dev login. Set BOT_TOKEN for production Telegram auth.');
        tgUser = parseTestUser();
      } else if (!isProduction || process.env.ALLOW_DEV_LOGIN === 'true') {
        tgUser = parseTestUser();
      } else {
        return res.status(403).json({ error: 'Telegram authentication required in production' });
      }
    } else {
      return res.status(403).json({ error: 'Telegram authentication required' });
    }
  } else if (!botToken) {
    logger.warn('BOT_TOKEN is not set — Telegram init data verification is SKIPPED. Set BOT_TOKEN in production!');
    tgUser = parseTestUser(initData);
  } else {
    tgUser = verifyTelegramInitData(initData, botToken);
    if (!tgUser) {
      const fields = initData.split('&').map(p => p.split('=')[0]).join(',');
      logger.warn({ fields, len: initData?.length, initData: initData.substring(0, 600) }, 'Telegram initData verification FAILED');
    }
  }

  if (!tgUser) {
    await recordBruteForceDB(clientIp);
    const attemptCount = await getDB().get(
      'SELECT attempts FROM login_attempts WHERE ip = ?', clientIp
    );
    logger.warn({
      initData: initData?.substring(0, 800),
      botToken: botToken?.substring(0, 10) + '...',
      attemptsRemaining: BRUTE_MAX_ATTEMPTS - (attemptCount?.attempts || 0),
    }, 'Auth failed: verifyTelegramInitData returned null');
    return res.status(403).json({ error: 'Invalid Telegram init data' });
  }

  // Successful auth — reset brute-force counter
  await resetBruteForceDB(clientIp);

  const db = getDB();
  const telegramId = String(tgUser.id);

  let user = await db.get('SELECT * FROM users WHERE telegram_id = ?', telegramId);

  if (!user) {
    // Use INSERT OR IGNORE to prevent race condition on concurrent registration
    const result = await db.run(
      'INSERT OR IGNORE INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)',
      telegramId, tgUser.username || '', tgUser.first_name || ''
    );
    if (result.lastID) {
      user = { id: result.lastID, telegram_id: telegramId, username: tgUser.username || '', registered: 0 };
    } else {
      // Another concurrent request already inserted — re-fetch
      user = await db.get('SELECT * FROM users WHERE telegram_id = ?', telegramId);
    }
  }
  if (user) {
    await db.run(
      'UPDATE users SET username = ?, first_name = ? WHERE id = ?',
      tgUser.username || '', tgUser.first_name || '', user.id
    );
  }

  const token = generateAccessToken(user.id, telegramId);
  const refreshToken = await issueRefreshToken(db, user.id, null);

  res.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      telegram_id: user.telegram_id,
      username: user.username,
      registered: user.registered || 0,
      nickname: user.nickname || '',
      avatar: user.avatar || '1f464',
      starter_pokemon: user.starter_pokemon || '',
    },
  });
}));

// POST /api/auth/refresh — exchange a refresh token for a new access+refresh token pair
router.post('/refresh', refreshLimiter, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  const db = getDB();
  const row = await db.get(
    "SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime('now')",
    refreshToken
  );
  if (!row) {
    logger.warn({ tokenPre: refreshToken.substring(0, 8) }, 'Refresh: invalid or expired token');
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  // Token rotation: DELETE + INSERT with same family_id
  await db.run('DELETE FROM refresh_tokens WHERE id = ?', row.id);

  // Check for token theft: if another token in the same family was already rotated
  // (detected by family_id having a newer entry that isn't this one), reject.
  const theftCheck = await db.get(
    'SELECT id FROM refresh_tokens WHERE family_id = ? AND id != ?',
    row.family_id || '', row.id
  );
  if (theftCheck) {
    // Possible token theft — invalidate ALL tokens for this family
    logger.warn({ userId: row.user_id, familyId: row.family_id }, 'Token theft detected! Invalidating all tokens in family');
    await db.run('DELETE FROM refresh_tokens WHERE family_id = ?', row.family_id || '');
    return res.status(401).json({ error: 'Token reused — possible theft. Please re-login.', code: 'TOKEN_THEFT' });
  }

  const user = await db.get('SELECT id, telegram_id FROM users WHERE id = ?', row.user_id);
  if (!user) {
    logger.warn({ userId: row.user_id }, 'Refresh: user not found');
    return res.status(401).json({ error: 'User not found' });
  }

  const token = generateAccessToken(user.id, user.telegram_id);
  const newRefreshToken = await issueRefreshToken(db, user.id, row.family_id || '');

  // Clean up old refresh tokens for this user (keep last 5 per user to allow concurrent tabs)
  await db.run(`
    DELETE FROM refresh_tokens WHERE id IN (
      SELECT id FROM refresh_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 5
    )
  `, user.id);

  logger.info({ userId: user.id }, 'Token refreshed');
  res.json({ token, refreshToken: newRefreshToken });
}));

// POST /api/auth/register — complete first-time registration
router.post('/register', registerLimiter, authMiddleware, asyncHandler(async (req, res) => {
  const { nickname, avatar, starterPokemon } = req.body;
  const db = getDB();
  const user = await db.get('SELECT * FROM users WHERE id = ?', req.userId);
  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  if (user.registered) {
    throw new AppError('User already registered', 409, 'CONFLICT');
  }

  // Validate nickname
  if (!nickname || nickname.trim().length === 0) {
    throw new AppError('Nickname is required', 400, 'VALIDATION_FAILED');
  }
  const cleanNick = nickname.trim().substring(0, 20);

  // Validate avatar (must be a valid trainer sprite ID)
  const VALID_AVATARS = ['trainer_f', 'trainer_m', 'ninja', 'sailor', 'super_nerd', 'beauty', 'gentleman'];
  const finalAvatar = avatar && (VALID_AVATARS.includes(avatar) || avatar.startsWith('/avatars/')) ? avatar : 'trainer_f';

  // Validate starter pokemon
  const VALID_STARTERS = ['bulbasaur', 'charmander', 'squirtle', 'chikorita', 'cyndaquil', 'totodile', 'pikachu', 'eevee'];
  const finalStarter = starterPokemon && VALID_STARTERS.includes(starterPokemon) ? starterPokemon : 'pikachu';

  await db.run(`
    UPDATE users
    SET nickname = ?, avatar = ?, starter_pokemon = ?, registered = 1, registered_at = datetime('now')
    WHERE id = ?
  `, cleanNick, finalAvatar, finalStarter, req.userId);

  const updated = await db.get('SELECT * FROM users WHERE id = ?', req.userId);
  logger.info({ userId: req.userId, nickname: cleanNick }, 'User registered');
  res.json({ success: true, user: updated });
}));

// GET /api/auth/is-admin — check admin status
router.get('/is-admin', authMiddleware, asyncHandler(async (req, res) => {
  const db = getDB();
  const user = await db.get('SELECT username FROM users WHERE id = ?', req.userId);
  const isAdmin = user && (
    ADMIN_IDS.includes(Number(req.userId)) ||
    ADMIN_USERNAMES.includes(user.username)
  );
  res.json({ isAdmin: !!isAdmin });
}));

// POST /api/auth/avatar — upload custom avatar image
router.post('/avatar', authMiddleware, asyncHandler(async (req, res) => {
  const { image } = req.body;
  if (!image || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'No valid image provided' });
  }

  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(base64Data, 'base64');

  if (buf.length > 500 * 1024) {
    return res.status(400).json({ error: 'Image too large (max 500KB)' });
  }

  fs.mkdirSync(AVATARS_DIR, { recursive: true });
  const filename = `user_${req.userId}.jpg`;
  fs.writeFileSync(path.join(AVATARS_DIR, filename), buf);

  const avatarUrl = `/avatars/${filename}?t=${Date.now()}`;
  const db = getDB();
  await db.run('UPDATE users SET avatar = ? WHERE id = ?', avatarUrl, req.userId);

  res.json({ success: true, avatarUrl });
}));

// POST /api/auth/logout — invalidate refresh token
router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await getDB().run('DELETE FROM refresh_tokens WHERE token = ?', refreshToken);
    logger.info({ userId: req.userId }, 'User logged out');
  }
  res.json({ success: true });
}));

export default router;
