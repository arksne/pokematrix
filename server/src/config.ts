/**
 * Конфигурация сервера из переменных окружения.
 */
import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'test-jwt-secret-league17-local-dev-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiresMs: 30 * 24 * 60 * 60 * 1000,
  botToken: process.env.BOT_TOKEN || '',
  adminPass: process.env.ADMIN_PASS || '',
  allowDevLogin: process.env.ALLOW_DEV_LOGIN === 'true',
  databaseUrl: process.env.DATABASE_URL || '',
  // Каталог собранного клиента. По умолчанию — <корень проекта>/dist, что верно
  // для нативного деплоя (Render). В контейнере путь задаётся явно, потому что
  // там /app/dist уже занят серверным кодом.
  clientDist: process.env.CLIENT_DIST || '',
  // TLS для PostgreSQL: 'auto' (по умолчанию — TLS в production, без TLS локально),
  // 'require', 'disable' или 'no-verify'. Сертификат проверяется всегда, кроме
  // 'no-verify' — он нужен только для self-hosted БД с самоподписанным сертификатом.
  dbSsl: (process.env.DB_SSL || 'auto') as 'require' | 'disable' | 'no-verify' | 'auto',
  // Размер пула. По умолчанию 10 — норма для Neon и любого внешнего Postgres.
  dbPoolMax: Math.max(1, parseInt(process.env.DB_POOL_MAX || '10', 10) || 10),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
  isProduction: process.env.NODE_ENV === 'production',
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  adminIds: new Set((process.env.ADMIN_IDS || '').split(',').filter(Boolean).map(Number)),
};

// В production — требовать обязательные секреты из окружения
if (config.isProduction) {
  if (!process.env.JWT_SECRET) {
    console.error('\x1b[31m[FATAL] JWT_SECRET не задан! Установите JWT_SECRET в переменных окружения для production.\x1b[0m');
    process.exit(1);
  }
  if (!process.env.ADMIN_PASS) {
    console.error('\x1b[31m[FATAL] ADMIN_PASS не задан! Установите ADMIN_PASS в переменных окружения для production.\x1b[0m');
    process.exit(1);
  }
  if (!process.env.BOT_TOKEN) {
    console.error('\x1b[31m[FATAL] BOT_TOKEN не задан! Без него сервер не может проверить подпись Telegram initData, а значит не может отличить подлинный вход от подделки. Задайте BOT_TOKEN или отключите NODE_ENV=production.\x1b[0m');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('\x1b[31m[FATAL] DATABASE_URL не задан! Без него pg подключится к localhost:5432 и все запросы будут падать, а /api/health продолжит отвечать ok.\x1b[0m');
    process.exit(1);
  }
  if (config.allowDevLogin) {
    console.error('\x1b[31m[FATAL] ALLOW_DEV_LOGIN=true в production — это вход без Telegram по initData="test". Задайте ALLOW_DEV_LOGIN=false.\x1b[0m');
    process.exit(1);
  }
} else {
  if (!process.env.JWT_SECRET) {
    console.warn('\x1b[33m[WARN] JWT_SECRET не задан! Используется default-значение. Установите JWT_SECRET в .env для production.\x1b[0m');
  }
  if (!process.env.ADMIN_PASS) {
    console.warn('\x1b[33m[WARN] ADMIN_PASS не задан! Используется default-значение. Установите ADMIN_PASS в .env для production.\x1b[0m');
  }
}
