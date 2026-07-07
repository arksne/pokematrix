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
import * as schema from './schema.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: ReturnType<typeof drizzle<typeof schema>>;
let pool: pg.Pool;

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
