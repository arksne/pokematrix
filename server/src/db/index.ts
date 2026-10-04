/**
 * Подключение к PostgreSQL + Drizzle ORM.
 * Использует DATABASE_URL из config.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { logger } from '../logger.js';
import * as schema from './schema.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: ReturnType<typeof drizzle<typeof schema>>;
let pool: pg.Pool;

export function connectDb() {
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: resolveDbSsl(),
  });

  // pg.Pool — EventEmitter. Ошибка на idle-клиенте (перезапуск БД, обрыв сети,
  // срабатывание idleTimeoutMillis) эмитится в 'error', а без слушателя Node
  // выбрасывает это как uncaughtException. На serverless-Postgres (Neon, Supabase),
  // который рвёт idle-соединения агрессивно, это происходило само по себе.
  pool.on('error', (err) => {
    logger.error({ err }, '[db] idle pool client error');
  });

  db = drizzle(pool, { schema });
  return { pool, db };
}

/**
 * Режим TLS для подключения к PostgreSQL.
 * - 'disable'   — соединение без TLS (локальная БД, PGlite, self-hosted без SSL)
 * - 'require'   — TLS с проверкой сертификата
 * - 'auto'      — TLS с проверкой в production, без TLS в остальных случаях
 * - 'no-verify' — TLS без проверки сертификата; только для self-hosted БД
 *                 с самоподписанным сертификатом.
 *
 * Проверка сертификата по умолчанию включена: у провайдеров вроде Neon есть
 * валидная цепочка, а rejectUnauthorized: false оставлял соединение открытым
 * к подмене сертификата. Проверено на Neon PostgreSQL 18.6 — connect проходит
 * и с проверкой, и без неё, так что включать её ничего не ломает.
 */
function resolveDbSsl(): false | { rejectUnauthorized: boolean } | undefined {
  if (config.dbSsl === 'disable') return false;
  if (config.dbSsl === 'no-verify') return { rejectUnauthorized: false };
  if (config.dbSsl === 'require') return { rejectUnauthorized: true };
  return config.isProduction ? { rejectUnauthorized: true } : undefined;
}


export function getDb() {
  if (!db) throw new Error('Database not connected. Call connectDb() first.');
  return db;
}


/**
 * Запуск миграций (вызывается при старте сервера).
 */
export async function runMigrations() {
  if (!db) throw new Error('Database not connected');
  await migrate(db, { migrationsFolder: path.resolve(__dirname, 'migrations') });
  console.log('[db] Migrations applied');
}

export async function closeDb() {
  if (pool) await pool.end();
}
