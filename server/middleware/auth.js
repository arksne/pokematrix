/**
 * JWT authentication middleware — access (15m) + refresh (30d opaque) token system.
 *
 * - Access tokens: signed JWT, 15 minute expiry, Bearer auth
 * - Refresh tokens: crypto.randomBytes(40) hex, stored in DB, bearer/body
 * - Safe wrappers for Socket.IO and error-prone contexts
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use persistent volume path if available, otherwise fall back to project-relative data dir
const dataDir = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../../data');
const SECRET_FILE = path.join(dataDir, 'jwt_secret');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  try {
    JWT_SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
  } catch {
    JWT_SECRET = crypto.randomBytes(32).toString('hex');
    try {
      fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
      fs.writeFileSync(SECRET_FILE, JWT_SECRET);
      logger.warn('Generated and saved JWT_SECRET to disk. Set JWT_SECRET env var for production.');
    } catch (e) {
      logger.warn({ err: e.message }, 'Could not persist JWT_SECRET to disk — sessions invalidated on restart.');
    }
  }
}

// ── Token lifetime constants ─────────────────────────────────────────
export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY_DAYS = 30;
export const REFRESH_TOKEN_BYTES = 40;

// ── Generate a cryptographically random refresh token ────────────────
export function generateRefreshToken() {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
}

// ── Access token generation ──────────────────────────────────────────
/**
 * Generate short-lived access token (15 minutes).
 * Used for API auth and Socket.IO handshake.
 */
export function generateAccessToken(userId, telegramId) {
  return jwt.sign(
    { userId, telegramId, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate long-lived access token for legacy/development use.
 * Prefer generateAccessToken in production.
 */
export function generateToken(userId, telegramId) {
  return generateAccessToken(userId, telegramId);
}

// ── Token verification ───────────────────────────────────────────────
/**
 * Verify JWT and return decoded payload.
 * Throws on invalid/expired token.
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Safe wrapper — never throws, returns null on failure.
 * Use for Socket.IO middleware where try/catch is awkward.
 */
export function safeVerifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    logger.debug({ err: err.message }, 'safeVerifyToken: token verification failed');
    return null;
  }
}

// ── Express middleware ───────────────────────────────────────────────
/**
 * Express middleware that extracts and verifies Bearer token.
 * Sets req.userId and req.telegramId on success.
 */
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.telegramId = decoded.telegramId;
    next();
  } catch (err) {
    logger.warn({ err: err.message }, 'authMiddleware: invalid or expired token');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export { JWT_SECRET };
