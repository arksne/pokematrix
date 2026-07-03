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

  // Manual parse — preserve URL-encoding. URLSearchParams decodes values
  // (e.g. %7B%22id%22%3A123%7D → {"id":123}), breaking the HMAC comparison
  // because Telegram hashes the ENCODED form.
  const pairs = initData.split('&');
  const entries = pairs.map(p => {
    const idx = p.indexOf('=');
    return idx === -1 ? [p, ''] : [p.slice(0, idx), p.slice(idx + 1)]; // value stays URL-encoded
  });
  const hashEntry = entries.find(e => e[0] === 'hash');
  const hash = hashEntry ? hashEntry[1] : null;
  if (!hash) {
    logger.warn('verifyTelegramInitData: no hash field in initData');
    return null;
  }

  // Telegram hash is always SHA-256 = 64 hex chars. Reject malformed ones early.
  if (hash.length !== 64 || !/^[0-9a-f]{64}$/i.test(hash)) {
    logger.warn({ hashLen: hash.length, hashPre: hash.slice(0, 16) }, 'verifyTelegramInitData: unexpected hash format');
    return null;
  }

  // Filter out fields that aren't part of the original Telegram hash computation.
  // 'hash' is excluded by definition. 'signature' is a client-injected field
  // (Telegram Desktop WebView2 adds it in some contexts) that wasn't in the
  // original payload the server-side hash was computed over.
  const excludeFields = new Set(['hash', 'signature']);
  const dataPairs = entries.filter(e => !excludeFields.has(e[0])).sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = dataPairs.map(e => `${e[0]}=${e[1]}`).join('\n');

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
    logger.warn({
      hdr: 'HMAC mismatch',
      keys: dataPairs.map(e => e[0]).join(','),
      all: entries.map(e => e[0]).join(','),
      chk64: dataCheckString.slice(0, 120),
      h64: hash.slice(0, 16),
      method: 'WebAppData',
      c64: webAppHash.slice(0, 16),
      methodDirect: 'direct',
      c64Direct: directHash.slice(0, 16),
      hl: hash.length,
      cl: computedHash.length,
      p: entries.length,
    }, 'verifyTelegramInitData: HMAC mismatch (both methods logged)');
    return null;
  }

  // Telegram spec: initData expires after 24 hours — reject stale data to prevent replay attacks
  const authDateEntry = entries.find(e => e[0] === 'auth_date');
  if (!authDateEntry) {
    logger.warn({ fields: entries.map(e => e[0]).join(',') }, 'verifyTelegramInitData: no auth_date in initData');
    return null;
  }
  const authTimestamp = parseInt(authDateEntry[1], 10);
  if (!authTimestamp) {
    logger.warn({ raw: authDateEntry[1] }, 'verifyTelegramInitData: auth_date not parseable');
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

  const userEntry = entries.find(e => e[0] === 'user');
  if (!userEntry) {
    logger.warn('verifyTelegramInitData: no user field in initData');
    return null;
  }

  // URL-decode the user value before JSON.parse
  const userStr = decodeURIComponent(userEntry[1]);

  try {
    const user = JSON.parse(userStr);
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
