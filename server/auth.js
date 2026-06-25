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

  // Per Telegram docs:
  // secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)  → raw bytes
  // hash       = HMAC_SHA256(key=secret_key,   data=check_string) → hex
  const secretKey = hmacSha256Buffer('WebAppData', botToken);
  const computedHash = hmacSha256Hex(secretKey, dataCheckString);

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
