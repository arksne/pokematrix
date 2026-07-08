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
  adminPass: process.env.ADMIN_PASS || 'league17admin2026',
  allowDevLogin: process.env.ALLOW_DEV_LOGIN === 'true',
  databaseUrl: process.env.DATABASE_URL || '',
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
} else {
  if (!process.env.JWT_SECRET) {
    console.warn('\x1b[33m[WARN] JWT_SECRET не задан! Используется default-значение. Установите JWT_SECRET в .env для production.\x1b[0m');
  }
  if (!process.env.ADMIN_PASS) {
    console.warn('\x1b[33m[WARN] ADMIN_PASS не задан! Используется default-значение. Установите ADMIN_PASS в .env для production.\x1b[0m');
  }
}
