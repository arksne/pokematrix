import crypto from 'crypto';

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

export function verifyTelegramInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');

  const sorted = [];
  for (const [key, value] of params.entries()) {
    sorted.push(`${key}=${value}`);
  }
  sorted.sort();

  const dataCheckString = sorted.join('\n');

  const secretKey = hmacSha256('WebAppData', botToken);
  const computedHash = hmacSha256(secretKey, dataCheckString);

  if (computedHash !== hash) return null;

  const userStr = params.get('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function parseTestUser() {
  return {
    id: 123456789,
    first_name: 'Test',
    username: 'test_user'
  };
}
