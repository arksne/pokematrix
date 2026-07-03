import crypto from 'crypto';

// Returns raw Buffer (needed for chained HMAC per Telegram spec)
function hmacSha256Buffer(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

// Returns hex string for final comparison
function hmacSha256Hex(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

export function verifyTelegramInitData(initData, botToken) {
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
  if (!hash) return null;

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
  if (computedHash === hash) {
    // Method 1 (WebAppData) succeeded
  } else {
    // Fallback: try direct HMAC with bot_token as key
    const oldHash = hmacSha256Hex(botToken, dataCheckString);
    if (oldHash === hash) {
      computedHash = hash; // Method 2 (direct) succeeded
    }
  }

  if (computedHash !== hash) {
    // Debug: exact HMAC mismatch details — use the Telegram Desktop debug text
    const debugData = {
      hdr: 'HMAC mismatch',
      keys: dataPairs.map(e => e[0]).join(','),
      all: entries.map(e => e[0]).join(','),
      chk64: dataCheckString.slice(0, 120),
      h64: hash.slice(0, 16),
      c64: computedHash.slice(0, 16),
      hl: hash.length,
      cl: computedHash.length,
      p: entries.length,
    };
    console.warn('HMAC mismatch:', JSON.stringify(debugData));
    return null;
  }

  // Telegram spec: initData expires after 24 hours — reject stale data to prevent replay attacks
  const authDateEntry = entries.find(e => e[0] === 'auth_date');
  if (!authDateEntry) {
    console.warn('verifyTelegramInitData: no auth_date in initData. fields:', entries.map(e => e[0]).join(','));
    return null;
  }
  const authTimestamp = parseInt(authDateEntry[1], 10);
  if (!authTimestamp) {
    console.warn('verifyTelegramInitData: auth_date not parseable:', authDateEntry[1]);
    return null;
  }
  const ageSec = Date.now() / 1000 - authTimestamp;
  if (ageSec > 86400) {
    console.warn('verifyTelegramInitData: auth_date too old:', { authTimestamp, ageSec });
    return null;
  }

  const userEntry = entries.find(e => e[0] === 'user');
  if (!userEntry) return null;

  // URL-decode the user value before JSON.parse
  const userStr = decodeURIComponent(userEntry[1]);

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function parseTestUser(raw) {
  // Support custom test users via `test_{"id":N,"username":"s","first_name":"s"}`
  if (raw && raw.startsWith('{')) {
    try {
      const custom = JSON.parse(raw);
      if (custom && custom.id) return custom;
    } catch (_) {}
  }
  return {
    id: 123456789,
    first_name: 'Test',
    username: 'test_user'
  };
}
