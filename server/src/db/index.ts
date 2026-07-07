/**
 * Подключение к PostgreSQL + Drizzle ORM.
 * Использует DATABASE_URL из config.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';
import * as schema from './schema.js';

const { Pool } = pg;

let db: ReturnType<typeof drizzle<typeof schema>>;
let pool: pg.Pool;

/**
 * Создать подключение к БД.
 * Воркер пула: минимум 1, максимум 2 (free tier Render).
 */
export function connectDb() {
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  db = drizzle(pool, { schema });
  return { pool, db };
}

export function getDb() {
  if (!db) throw new Error('Database not connected. Call connectDb() first.');
  return db;
}

export function getPool() {
  if (!pool) throw new Error('Database not connected. Call connectDb() first.');
  return pool;
}

/**
 * Закрыть все соединения (graceful shutdown).
 */
export async function closeDb() {
  if (pool) await pool.end();
}
