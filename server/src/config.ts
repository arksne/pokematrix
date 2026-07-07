/**
 * Конфигурация сервера из переменных окружения.
 * Все значения с дефолтами для локальной разработки.
 */
import 'dotenv/config';

export const config = {
  /** Порт сервера (Render присылает PORT env) */
  port: parseInt(process.env.PORT || '3000', 10),

  /** Секретный ключ для JWT */
  jwtSecret: process.env.JWT_SECRET || 'test-jwt-secret-league17-local-dev-2026',

  /** Срок жизни access token (15 мин) */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',

  /** Срок жизни refresh token (30 дней) */
  refreshTokenExpiresMs: 30 * 24 * 60 * 60 * 1000,

  /** Telegram Bot Token — для проверки initData */
  botToken: process.env.BOT_TOKEN || '',

  /** Пароль для админ-панели (совпадает с тем, что шлёт клиент) */
  adminPass: process.env.ADMIN_PASS || 'league17admin2026',

  /** Режим разработки — разрешить дев-логин без Telegram */
  allowDevLogin: process.env.ALLOW_DEV_LOGIN === 'true',

  /** URL базы данных PostgreSQL (Render присылает DATABASE_URL) */
  databaseUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/pokematrix',

  /** Список разрешённых CORS origin */
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),

  /** Режим: продакшн или разработка */
  isProduction: process.env.NODE_ENV === 'production',

  /** Уровень логирования */
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

  /** ID админов (через запятую) */
  adminIds: new Set((process.env.ADMIN_IDS || '').split(',').filter(Boolean).map(Number)),
};
