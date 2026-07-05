/**
 * Telegram initData verification — переписано с Pino-логированием.
 *
 * Two HMAC methods (WebAppData + fallback direct) для кросс-платформенной
 * совместимости (Telegram Mini Apps, Desktop WebView2, Bot API).
 */
import crypto from 'crypto';
import { logger } from './lib/logger.js';

// Returns raw Buffer (needed for chained HMAC per Telegram spec)
function hmacSha256Buffer(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

// Returns hex string for final comparison
function hmacSha256Hex(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Verify Telegram initData string.
 *
 * @param {string} initData — raw URL-encoded query string from tgWebAppData
 * @param {string} botToken — Telegram Bot API token
 * @returns {object|null} — parsed user object or null
 */
export function verifyTelegramInitData(initData, botToken) {
  if (!initData || typeof initData !== 'string') {
    logger.warn({ initDataType: typeof initData }, 'verifyTelegramInitData: invalid initData type');
    return null;
  }

  // Parse via URLSearchParams to properly decode URL-encoded values.
  // Telegram hashes the DECODED form — `user={"id":123}` NOT `user=%7B%22id%22%3A123%7D`.
  // Previously we kept the URL-encoded form, which caused permanent HMAC mismatch.
  // We also do NOT exclude 'signature' — Telegram Desktop WebView2 includes it
  // in the initData and it IS part of the hash computation.
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    logger.warn('verifyTelegramInitData: no hash field in initData');
    return null;
  }

  // Telegram hash is always SHA-256 = 64 hex chars. Reject malformed ones early.
  if (hash.length !== 64 || !/^[0-9a-f]{64}$/i.test(hash)) {
    logger.warn({ hashLen: hash.length, hashPre: hash.slice(0, 16) }, 'verifyTelegramInitData: unexpected hash format');
    return null;
  }

  // Build data-check string: all fields EXCEPT hash, sorted alphabetically,
  // values URL-decoded (as Telegram spec requires).
  const pairs = [];
  for (const [key, value] of params) {
    if (key !== 'hash') {
      pairs.push([key, value]); // value is already URL-decoded by URLSearchParams
    }
  }
  pairs.sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = pairs.map(e => `${e[0]}=${e[1]}`).join('\n');

  // Try TWO HMAC methods:
  // 1. WebAppData method (official Telegram Mini App spec):
  //    secret_key = HMAC_SHA256("WebAppData", bot_token)  → bytes
  //    hash       = HMAC_SHA256(secret_key, check_string)  → hex
  // 2. Direct method (older Telegram Bot API / Desktop WebView2):
  //    hash       = HMAC_SHA256(bot_token, check_string)   → hex

  let computedHash = hmacSha256Hex(hmacSha256Buffer('WebAppData', botToken), dataCheckString);
  let methodUsed = 'WebAppData';
  if (computedHash === hash) {
    // Method 1 (WebAppData) succeeded
  } else {
    // Fallback: try direct HMAC with bot_token as key
    const oldHash = hmacSha256Hex(botToken, dataCheckString);
    if (oldHash === hash) {
      computedHash = hash; // Method 2 (direct) succeeded
      methodUsed = 'direct';
    }
  }

  if (computedHash !== hash) {
    // Detailed logging of HMAC mismatch — both methods for debugging
    const webAppHash = hmacSha256Hex(hmacSha256Buffer('WebAppData', botToken), dataCheckString);
    const directHash = hmacSha256Hex(botToken, dataCheckString);
    const allKeys = [];
    for (const [key] of params) allKeys.push(key);
    logger.warn({
      hdr: 'HMAC mismatch',
      keys: pairs.map(e => e[0]).join(','),
      all: allKeys.join(','),
      chk64: dataCheckString.slice(0, 120),
      h64: hash.slice(0, 16),
      method: 'WebAppData',
      c64: webAppHash.slice(0, 16),
      methodDirect: 'direct',
      c64Direct: directHash.slice(0, 16),
      hl: hash.length,
      cl: computedHash.length,
      p: pairs.length,
    }, 'verifyTelegramInitData: HMAC mismatch (both methods logged)');
    return null;
  }

  // Telegram spec: initData expires after 24 hours — reject stale data to prevent replay attacks
  const authDateStr = params.get('auth_date');
  if (!authDateStr) {
    const allKeys = []; for (const [k] of params) allKeys.push(k);
    logger.warn({ fields: allKeys.join(',') }, 'verifyTelegramInitData: no auth_date in initData');
    return null;
  }
  const authTimestamp = parseInt(authDateStr, 10);
  if (!authTimestamp) {
    logger.warn({ raw: authDateStr }, 'verifyTelegramInitData: auth_date not parseable');
    return null;
  }
  const ageSec = Date.now() / 1000 - authTimestamp;
  // Allow 300s clock drift (negative = client clock ahead of server).
  // Reject initData older than 24h OR with a future timestamp >300s away.
  if (ageSec > 86400 || ageSec < -300) {
    logger.warn({
      authTimestamp,
      ageSec,
      drift: ageSec < 0 ? 'clock_ahead' : 'too_old',
      methodUsed,
    }, 'verifyTelegramInitData: auth_date out of range');
    return null;
  }

  const userStr = params.get('user');
  if (!userStr) {
    logger.warn('verifyTelegramInitData: no user field in initData');
    return null;
  }

  try {
    const user = JSON.parse(userStr); // already URL-decoded by URLSearchParams
    logger.info({ userId: user.id, method: methodUsed }, 'Telegram initData verified');
    return user;
  } catch (err) {
    logger.warn({ err: err.message, userStr: userStr?.substring(0, 200) }, 'verifyTelegramInitData: user JSON parse failed');
    return null;
  }
}

/**
 * Parse a test user string for development/testing.
 * Supports custom test users via `test_{"id":N,"username":"s","first_name":"s"}`
 * or returns a default test user.
 *
 * @param {string} [raw] — optional JSON string for custom test user
 * @returns {object} — user object with id, first_name, username
 */
export function parseTestUser(raw) {
  if (raw && raw.startsWith('{')) {
    try {
      const custom = JSON.parse(raw);
      if (custom && custom.id) return custom;
    } catch (_) { /* ignore — fall through to default */ }
  }
  return {
    id: 123456789,
    first_name: 'Test',
    username: 'test_user',
  };
}
