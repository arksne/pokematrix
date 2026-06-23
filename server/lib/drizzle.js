/**
 * Drizzle ORM instance — типизированный доступ к БД.
 * Использует тот же libSQL/SQLite файл, что и legacy db.js.
 * Все новые роуты пишут через drizzle, старые продолжают через db.js.
 *
 * Использование:
 *   import { drizzle, schema } from '../lib/drizzle.js';
 *   const users = await drizzle.select().from(schema.users).all();
 */
import { drizzle as createDrizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../../data');

let _drizzle = null;

export function initDrizzle() {
  if (_drizzle) return _drizzle;

  // Ensure data directory exists (critical for Railway volumes on first deploy)
  mkdirSync(DATA_DIR, { recursive: true });

  const dbPath = path.join(DATA_DIR, 'game.db');
  const client = createClient({ url: 'file:' + dbPath.replace(/\\/g, '/') });
  _drizzle = createDrizzle(client, { schema, logger: process.env.NODE_ENV === 'development' });
  return _drizzle;
}

export function getDrizzle() {
  if (!_drizzle) return initDrizzle();
  return _drizzle;
}

export { schema };
